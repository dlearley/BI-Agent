"""
Report Tasks for Celery Worker

This module contains tasks for generating scheduled reports,
exporting data, and managing report delivery.
"""

import os
import csv
import json
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import structlog

from ..celery_app import celery_app, db_circuit_breaker
from ..settings import settings
from ..utils.metrics import metrics_collector
from ..utils.database import get_db_connection
from ..utils.exports import export_to_csv, export_to_json, export_to_excel
from ..utils.notifications import send_email_with_attachment

logger = structlog.get_logger(__name__)


@celery_app.task(
    bind=True,
    max_retries=2,
    default_retry_delay=120,
    retry_backoff=True
)
def generate_scheduled_reports(self, schedule_type: str = 'daily') -> Dict[str, Any]:
    """
    Generate scheduled reports based on schedule type
    
    Args:
        schedule_type: 'daily', 'weekly', 'monthly'
    """
    task_name = "generate_scheduled_reports"
    
    try:
        with metrics_collector.task_duration(task_name):
            logger.info("Generating scheduled reports", schedule_type=schedule_type)
            
            with db_circuit_breaker:
                conn = get_db_connection()
                cursor = conn.cursor()
                
                # Get reports that match the schedule type
                cursor.execute("""
                    SELECT id, name, report_type, query, format, recipients,
                           schedule_config, is_active, last_generated
                    FROM analytics_reports
                    WHERE is_active = true 
                      AND schedule_type = %s
                      AND (last_generated IS NULL 
                           OR last_generated < NOW() - INTERVAL '1 day')
                """, (schedule_type,))
                
                scheduled_reports = cursor.fetchall()
                
                if not scheduled_reports:
                    cursor.close()
                    conn.close()
                    
                    result = {
                        "status": "success",
                        "message": f"No scheduled {schedule_type} reports found",
                        "timestamp": datetime.utcnow().isoformat(),
                        "reports_generated": 0
                    }
                    
                    logger.info(f"No {schedule_type} reports found")
                    return result
                
                report_results = []
                
                for report in scheduled_reports:
                    report_id = report[0]
                    report_data = {
                        'id': report_id,
                        'name': report[1],
                        'report_type': report[2],
                        'query': report[3],
                        'format': report[4],
                        'recipients': report[5],
                        'schedule_config': report[6],
                        'is_active': report[7],
                        'last_generated': report[8]
                    }
                    
                    try:
                        # Generate the report
                        result = generate_single_report.delay(report_data)
                        report_results.append({
                            'report_id': report_id,
                            'task_id': result.id,
                            'status': 'queued'
                        })
                        
                    except Exception as report_exc:
                        logger.error("Failed to queue report generation", 
                                   report_id=report_id, error=str(report_exc))
                        report_results.append({
                            'report_id': report_id,
                            'status': 'failed',
                            'error': str(report_exc)
                        })
                
                cursor.close()
                conn.close()
                
                metrics_collector.task_completed(task_name)
                
                result = {
                    "status": "success",
                    "message": f"Queued {len(report_results)} {schedule_type} reports for generation",
                    "timestamp": datetime.utcnow().isoformat(),
                    "reports_queued": len(report_results),
                    "report_results": report_results
                }
                
                logger.info("Scheduled reports queued", schedule_type=schedule_type, count=len(report_results))
                return result
                
    except Exception as exc:
        logger.error("Scheduled report generation failed", 
                   schedule_type=schedule_type, error=str(exc))
        metrics_collector.task_failed(task_name, str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    max_retries=2,
    default_retry_delay=60,
    retry_backoff=True
)
def generate_single_report(self, report_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate a single report
    """
    task_name = "generate_single_report"
    report_id = report_data['id']
    
    try:
        with metrics_collector.task_duration(task_name):
            logger.info("Generating report", report_id=report_id, report_name=report_data['name'])
            
            # Execute report query
            report_data_result = execute_report_query(report_data['query'])
            
            if not report_data_result['data']:
                raise ValueError("Report query returned no data")
            
            # Generate report file
            file_path = generate_report_file(report_data, report_data_result['data'])
            
            # Update report metadata
            with db_circuit_breaker:
                conn = get_db_connection()
                cursor = conn.cursor()
                
                cursor.execute("""
                    UPDATE analytics_reports
                    SET last_generated = NOW(),
                        file_path = %s,
                        row_count = %s,
                        generation_time_seconds = %s,
                        status = 'completed'
                    WHERE id = %s
                """, (
                    file_path,
                    len(report_data_result['data']),
                    report_data_result['execution_time'],
                    report_id
                ))
                
                conn.commit()
                cursor.close()
                conn.close()
            
            # Send report to recipients
            delivery_results = []
            recipients = report_data.get('recipients', [])
            
            for recipient in recipients:
                try:
                    result = deliver_report(report_data, file_path, recipient)
                    delivery_results.append(result)
                except Exception as delivery_exc:
                    logger.error("Failed to deliver report", 
                               recipient=recipient, error=str(delivery_exc))
                    delivery_results.append({
                        'recipient': recipient,
                        'status': 'failed',
                        'error': str(delivery_exc)
                    })
            
            metrics_collector.task_completed(task_name)
            
            result = {
                "status": "success",
                "message": f"Report '{report_data['name']}' generated successfully",
                "timestamp": datetime.utcnow().isoformat(),
                "report_id": report_id,
                "file_path": file_path,
                "row_count": len(report_data_result['data']),
                "execution_time": report_data_result['execution_time'],
                "delivery_results": delivery_results
            }
            
            logger.info("Report generated successfully", 
                       report_id=report_id, file_path=file_path, row_count=len(report_data_result['data']))
            return result
            
    except Exception as exc:
        logger.error("Report generation failed", report_id=report_id, error=str(exc))
        metrics_collector.task_failed(task_name, str(exc))
        
        # Update report status to failed
        try:
            with db_circuit_breaker:
                conn = get_db_connection()
                cursor = conn.cursor()
                
                cursor.execute("""
                    UPDATE analytics_reports
                    SET status = 'failed',
                        error_message = %s,
                        last_attempt = NOW()
                    WHERE id = %s
                """, (str(exc), report_id))
                
                conn.commit()
                cursor.close()
                conn.close()
        except Exception as update_exc:
            logger.error("Failed to update report status", error=str(update_exc))
        
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    max_retries=1,
    default_retry_delay=30
)
def cleanup_old_reports(self) -> Dict[str, Any]:
    """
    Clean up old report files based on retention policy
    """
    task_name = "cleanup_old_reports"
    
    try:
        with metrics_collector.task_duration(task_name):
            logger.info("Cleaning up old report files")
            
            # Get cutoff date based on retention policy
            cutoff_date = datetime.utcnow() - timedelta(days=settings.report_retention_days)
            
            with db_circuit_breaker:
                conn = get_db_connection()
                cursor = conn.cursor()
                
                # Get old reports
                cursor.execute("""
                    SELECT id, name, file_path
                    FROM analytics_reports
                    WHERE last_generated < %s
                      AND file_path IS NOT NULL
                """, (cutoff_date,))
                
                old_reports = cursor.fetchall()
                
                deleted_files = []
                updated_reports = []
                
                for report in old_reports:
                    report_id = report[0]
                    report_name = report[1]
                    file_path = report[2]
                    
                    try:
                        # Delete file if it exists
                        if os.path.exists(file_path):
                            os.remove(file_path)
                            deleted_files.append(file_path)
                        
                        # Update report record
                        cursor.execute("""
                            UPDATE analytics_reports
                            SET file_path = NULL,
                                status = 'archived'
                            WHERE id = %s
                        """, (report_id,))
                        
                        updated_reports.append(report_id)
                        
                    except Exception as file_exc:
                        logger.error("Failed to delete report file", 
                                   report_id=report_id, file_path=file_path, error=str(file_exc))
                
                conn.commit()
                cursor.close()
                conn.close()
                
                metrics_collector.task_completed(task_name)
                
                result = {
                    "status": "success",
                    "message": f"Cleaned up {len(deleted_files)} old report files",
                    "timestamp": datetime.utcnow().isoformat(),
                    "files_deleted": len(deleted_files),
                    "reports_updated": len(updated_reports),
                    "deleted_files": deleted_files
                }
                
                logger.info("Old reports cleaned up", files_deleted=len(deleted_files))
                return result
                
    except Exception as exc:
        logger.error("Report cleanup failed", error=str(exc))
        metrics_collector.task_failed(task_name, str(exc))
        return {
            "status": "error",
            "message": f"Cleanup failed: {str(exc)}",
            "timestamp": datetime.utcnow().isoformat()
        }


@celery_app.task(bind=True)
def generate_ad_hoc_report(self, report_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate an ad-hoc report based on provided configuration
    """
    task_name = "generate_ad_hoc_report"
    
    try:
        with metrics_collector.task_duration(task_name):
            logger.info("Generating ad-hoc report", report_name=report_config.get('name'))
            
            # Execute report query
            report_data_result = execute_report_query(report_config['query'])
            
            if not report_data_result['data']:
                raise ValueError("Report query returned no data")
            
            # Generate report file
            file_path = generate_report_file(report_config, report_data_result['data'])
            
            metrics_collector.task_completed(task_name)
            
            result = {
                "status": "success",
                "message": f"Ad-hoc report '{report_config.get('name', 'unnamed')}' generated successfully",
                "timestamp": datetime.utcnow().isoformat(),
                "file_path": file_path,
                "row_count": len(report_data_result['data']),
                "execution_time": report_data_result['execution_time']
            }
            
            logger.info("Ad-hoc report generated successfully", file_path=file_path)
            return result
            
    except Exception as exc:
        logger.error("Ad-hoc report generation failed", error=str(exc))
        metrics_collector.task_failed(task_name, str(exc))
        raise


def execute_report_query(query: str) -> Dict[str, Any]:
    """Execute report query and return data with metadata"""
    start_time = datetime.utcnow()
    
    with db_circuit_breaker:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(query)
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        
        cursor.close()
        conn.close()
    
    end_time = datetime.utcnow()
    execution_time = (end_time - start_time).total_seconds()
    
    # Convert to list of dictionaries
    data = []
    for row in rows:
        data.append(dict(zip(columns, row)))
    
    return {
        'data': data,
        'columns': columns,
        'row_count': len(data),
        'execution_time': execution_time
    }


def generate_report_file(report_data: Dict[str, Any], data: List[Dict[str, Any]]) -> str:
    """Generate report file in specified format"""
    
    # Create output directory if it doesn't exist
    os.makedirs(settings.report_output_dir, exist_ok=True)
    
    # Generate filename
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    safe_name = "".join(c for c in report_data['name'] if c.isalnum() or c in (' ', '-', '_')).rstrip()
    filename = f"{safe_name}_{timestamp}"
    
    file_format = report_data.get('format', 'csv').lower()
    
    if file_format == 'csv':
        file_path = os.path.join(settings.report_output_dir, f"{filename}.csv")
        export_to_csv(data, file_path)
    elif file_format == 'json':
        file_path = os.path.join(settings.report_output_dir, f"{filename}.json")
        export_to_json(data, file_path)
    elif file_format == 'excel':
        file_path = os.path.join(settings.report_output_dir, f"{filename}.xlsx")
        export_to_excel(data, file_path)
    else:
        raise ValueError(f"Unsupported format: {file_format}")
    
    return file_path


def deliver_report(report_data: Dict[str, Any], file_path: str, recipient: str) -> Dict[str, Any]:
    """Deliver report to recipient"""
    
    delivery_method = report_data.get('delivery_method', 'email')
    
    if delivery_method == 'email':
        return deliver_report_email(report_data, file_path, recipient)
    elif delivery_method == 's3':
        return deliver_report_s3(report_data, file_path, recipient)
    else:
        raise ValueError(f"Unsupported delivery method: {delivery_method}")


def deliver_report_email(report_data: Dict[str, Any], file_path: str, recipient: str) -> Dict[str, Any]:
    """Deliver report via email"""
    try:
        subject = f"Report: {report_data['name']}"
        body = f"""
Hello,

Please find attached the report: {report_data['name']}

Generated at: {datetime.utcnow().isoformat()}
Row count: {report_data.get('row_count', 'Unknown')}

Best regards,
Analytics Platform
        """.strip()
        
        send_email_with_attachment(
            to_address=recipient,
            subject=subject,
            body=body,
            attachment_path=file_path,
            smtp_host=settings.alert_email_smtp_host,
            smtp_port=settings.alert_email_smtp_port,
            username=settings.alert_email_username,
            password=settings.alert_email_password
        )
        
        return {
            'recipient': recipient,
            'delivery_method': 'email',
            'status': 'success',
            'file_path': file_path
        }
        
    except Exception as exc:
        return {
            'recipient': recipient,
            'delivery_method': 'email',
            'status': 'failed',
            'error': str(exc)
        }


def deliver_report_s3(report_data: Dict[str, Any], file_path: str, recipient: str) -> Dict[str, Any]:
    """Deliver report to S3 (placeholder implementation)"""
    # This would integrate with boto3 for S3 upload
    # For now, return a placeholder result
    return {
        'recipient': recipient,
        'delivery_method': 's3',
        'status': 'not_implemented',
        'message': 'S3 delivery not yet implemented'
    }