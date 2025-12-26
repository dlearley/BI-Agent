"""
Alert Tasks for Celery Worker

This module contains tasks for processing analytics alerts,
checking threshold conditions, and sending notifications.
"""

import asyncio
import smtplib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import json
import httpx
import structlog

from ..celery_app import celery_app, db_circuit_breaker
from ..settings import settings
from ..utils.metrics import metrics_collector
from ..utils.database import get_db_connection
from ..utils.notifications import send_email, send_webhook

logger = structlog.get_logger(__name__)


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    retry_backoff=True
)
def process_pending_alerts(self) -> Dict[str, Any]:
    """
    Process all pending alerts that need to be evaluated
    """
    task_name = "process_pending_alerts"
    
    try:
        with metrics_collector.task_duration(task_name):
            logger.info("Processing pending alerts")
            
            with db_circuit_breaker:
                conn = get_db_connection()
                cursor = conn.cursor()
                
                # Get pending alerts
                cursor.execute("""
                    SELECT id, name, query, threshold, operator, 
                           notification_channels, last_triggered, is_active
                    FROM analytics_alerts 
                    WHERE is_active = true 
                      AND (last_triggered IS NULL 
                           OR last_triggered < NOW() - INTERVAL '1 hour')
                    ORDER BY priority DESC, created_at ASC
                """)
                
                pending_alerts = cursor.fetchall()
                
                if not pending_alerts:
                    cursor.close()
                    conn.close()
                    
                    result = {
                        "status": "success",
                        "message": "No pending alerts to process",
                        "timestamp": datetime.utcnow().isoformat(),
                        "alerts_processed": 0
                    }
                    
                    logger.info("No pending alerts found")
                    return result
                
                processed_alerts = []
                triggered_alerts = []
                
                for alert in pending_alerts:
                    alert_id = alert[0]
                    alert_data = {
                        'id': alert_id,
                        'name': alert[1],
                        'query': alert[2],
                        'threshold': alert[3],
                        'operator': alert[4],
                        'notification_channels': alert[5],
                        'last_triggered': alert[6],
                        'is_active': alert[7]
                    }
                    
                    try:
                        # Evaluate the alert condition
                        should_trigger = evaluate_alert_condition(alert_data)
                        
                        if should_trigger:
                            # Trigger the alert
                            trigger_alert.delay(alert_data)
                            triggered_alerts.append(alert_id)
                            
                            # Update last triggered timestamp
                            cursor.execute("""
                                UPDATE analytics_alerts 
                                SET last_triggered = NOW(),
                                    trigger_count = COALESCE(trigger_count, 0) + 1
                                WHERE id = %s
                            """, (alert_id,))
                        
                        processed_alerts.append(alert_id)
                        
                    except Exception as alert_exc:
                        logger.error("Failed to process alert", 
                                   alert_id=alert_id, error=str(alert_exc))
                
                conn.commit()
                cursor.close()
                conn.close()
                
                metrics_collector.task_completed(task_name)
                
                result = {
                    "status": "success",
                    "message": f"Processed {len(processed_alerts)} alerts, triggered {len(triggered_alerts)}",
                    "timestamp": datetime.utcnow().isoformat(),
                    "alerts_processed": len(processed_alerts),
                    "alerts_triggered": len(triggered_alerts),
                    "triggered_alert_ids": triggered_alerts
                }
                
                logger.info("Alert processing completed", **result)
                return result
                
    except Exception as exc:
        logger.error("Alert processing failed", error=str(exc))
        metrics_collector.task_failed(task_name, str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    max_retries=2,
    default_retry_delay=30
)
def trigger_alert(self, alert_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Trigger an alert and send notifications
    """
    task_name = "trigger_alert"
    alert_id = alert_data['id']
    
    try:
        with metrics_collector.task_duration(task_name):
            logger.info("Triggering alert", alert_id=alert_id, alert_name=alert_data['name'])
            
            # Get current alert value
            current_value = get_alert_current_value(alert_data['query'])
            
            # Prepare alert message
            alert_message = format_alert_message(alert_data, current_value)
            
            # Send notifications through configured channels
            notification_results = []
            notification_channels = alert_data.get('notification_channels', [])
            
            for channel in notification_channels:
                try:
                    if channel['type'] == 'email':
                        result = send_email_alert(channel, alert_message, alert_data)
                        notification_results.append(result)
                    elif channel['type'] == 'webhook':
                        result = send_webhook_alert(channel, alert_message, alert_data)
                        notification_results.append(result)
                    elif channel['type'] == 'slack':
                        result = send_slack_alert(channel, alert_message, alert_data)
                        notification_results.append(result)
                    
                except Exception as notif_exc:
                    logger.error("Failed to send notification", 
                               channel_type=channel['type'], error=str(notif_exc))
                    notification_results.append({
                        "channel_type": channel['type'],
                        "status": "failed",
                        "error": str(notif_exc)
                    })
            
            # Log alert trigger in database
            with db_circuit_breaker:
                conn = get_db_connection()
                cursor = conn.cursor()
                
                cursor.execute("""
                    INSERT INTO analytics_alert_logs (
                        alert_id, triggered_at, current_value, 
                        threshold_value, operator, notification_results
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    alert_id,
                    datetime.utcnow(),
                    current_value,
                    alert_data['threshold'],
                    alert_data['operator'],
                    json.dumps(notification_results)
                ))
                
                conn.commit()
                cursor.close()
                conn.close()
            
            metrics_collector.task_completed(task_name)
            
            result = {
                "status": "success",
                "message": f"Alert '{alert_data['name']}' triggered successfully",
                "timestamp": datetime.utcnow().isoformat(),
                "alert_id": alert_id,
                "current_value": current_value,
                "notification_results": notification_results
            }
            
            logger.info("Alert triggered successfully", alert_id=alert_id)
            return result
            
    except Exception as exc:
        logger.error("Alert trigger failed", alert_id=alert_id, error=str(exc))
        metrics_collector.task_failed(task_name, str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    max_retries=2,
    default_retry_delay=60
)
def check_threshold_conditions(self) -> Dict[str, Any]:
    """
    Check threshold conditions for all active metrics
    """
    task_name = "check_threshold_conditions"
    
    try:
        with metrics_collector.task_duration(task_name):
            logger.info("Checking threshold conditions")
            
            with db_circuit_breaker:
                conn = get_db_connection()
                cursor = conn.cursor()
                
                # Get all threshold configurations
                cursor.execute("""
                    SELECT id, metric_name, query, warning_threshold, 
                           critical_threshold, comparison_operator
                    FROM analytics_thresholds
                    WHERE is_active = true
                """)
                
                thresholds = cursor.fetchall()
                
                if not thresholds:
                    cursor.close()
                    conn.close()
                    
                    result = {
                        "status": "success",
                        "message": "No active thresholds configured",
                        "timestamp": datetime.utcnow().isoformat(),
                        "thresholds_checked": 0
                    }
                    
                    logger.info("No active thresholds found")
                    return result
                
                threshold_results = []
                
                for threshold in thresholds:
                    threshold_id = threshold[0]
                    threshold_data = {
                        'id': threshold_id,
                        'metric_name': threshold[1],
                        'query': threshold[2],
                        'warning_threshold': threshold[3],
                        'critical_threshold': threshold[4],
                        'comparison_operator': threshold[5]
                    }
                    
                    try:
                        # Get current metric value
                        current_value = get_alert_current_value(threshold_data['query'])
                        
                        # Evaluate thresholds
                        status = evaluate_threshold_status(threshold_data, current_value)
                        
                        if status in ['warning', 'critical']:
                            # Create alert if threshold is breached
                            create_threshold_alert.delay(threshold_data, current_value, status)
                        
                        threshold_results.append({
                            'threshold_id': threshold_id,
                            'metric_name': threshold_data['metric_name'],
                            'current_value': current_value,
                            'status': status
                        })
                        
                    except Exception as thresh_exc:
                        logger.error("Failed to check threshold", 
                                   threshold_id=threshold_id, error=str(thresh_exc))
                        threshold_results.append({
                            'threshold_id': threshold_id,
                            'error': str(thresh_exc)
                        })
                
                cursor.close()
                conn.close()
                
                metrics_collector.task_completed(task_name)
                
                result = {
                    "status": "success",
                    "message": f"Checked {len(threshold_results)} thresholds",
                    "timestamp": datetime.utcnow().isoformat(),
                    "thresholds_checked": len(threshold_results),
                    "results": threshold_results
                }
                
                logger.info("Threshold check completed", thresholds_checked=len(threshold_results))
                return result
                
    except Exception as exc:
        logger.error("Threshold check failed", error=str(exc))
        metrics_collector.task_failed(task_name, str(exc))
        raise self.retry(exc=exc)


@celery_app.task(bind=True)
def create_threshold_alert(self, threshold_data: Dict[str, Any], 
                          current_value: float, status: str) -> Dict[str, Any]:
    """
    Create and trigger an alert for threshold breach
    """
    task_name = "create_threshold_alert"
    threshold_id = threshold_data['id']
    
    try:
        with metrics_collector.task_duration(task_name):
            logger.info("Creating threshold alert", 
                       threshold_id=threshold_id, status=status)
            
            # Create alert data
            alert_data = {
                'id': f"threshold_{threshold_id}_{int(datetime.utcnow().timestamp())}",
                'name': f"Threshold Alert: {threshold_data['metric_name']}",
                'query': threshold_data['query'],
                'threshold': threshold_data['critical_threshold'] if status == 'critical' else threshold_data['warning_threshold'],
                'operator': threshold_data['comparison_operator'],
                'notification_channels': get_default_notification_channels(),
                'threshold_type': status,
                'metric_name': threshold_data['metric_name']
            }
            
            # Trigger the alert
            result = trigger_alert(alert_data)
            
            metrics_collector.task_completed(task_name)
            
            logger.info("Threshold alert created successfully", 
                       threshold_id=threshold_id, status=status)
            
            return result
            
    except Exception as exc:
        logger.error("Threshold alert creation failed", 
                   threshold_id=threshold_id, error=str(exc))
        metrics_collector.task_failed(task_name, str(exc))
        return {
            "status": "error",
            "message": f"Failed to create threshold alert: {str(exc)}",
            "timestamp": datetime.utcnow().isoformat()
        }


def evaluate_alert_condition(alert_data: Dict[str, Any]) -> bool:
    """Evaluate if alert condition is met"""
    try:
        current_value = get_alert_current_value(alert_data['query'])
        threshold = alert_data['threshold']
        operator = alert_data['operator']
        
        if operator == '>':
            return current_value > threshold
        elif operator == '<':
            return current_value < threshold
        elif operator == '>=':
            return current_value >= threshold
        elif operator == '<=':
            return current_value <= threshold
        elif operator == '==':
            return current_value == threshold
        elif operator == '!=':
            return current_value != threshold
        else:
            raise ValueError(f"Unknown operator: {operator}")
            
    except Exception as exc:
        logger.error("Failed to evaluate alert condition", error=str(exc))
        return False


def get_alert_current_value(query: str) -> float:
    """Execute alert query and return the current value"""
    with db_circuit_breaker:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(query)
        result = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        if result and len(result) > 0:
            return float(result[0])
        else:
            raise ValueError("Query returned no results")


def evaluate_threshold_status(threshold_data: Dict[str, Any], current_value: float) -> str:
    """Evaluate threshold status (ok, warning, critical)"""
    operator = threshold_data['comparison_operator']
    warning_threshold = threshold_data['warning_threshold']
    critical_threshold = threshold_data['critical_threshold']
    
    # Simple evaluation - can be enhanced for more complex scenarios
    if operator == '>':
        if current_value > critical_threshold:
            return 'critical'
        elif current_value > warning_threshold:
            return 'warning'
    elif operator == '<':
        if current_value < critical_threshold:
            return 'critical'
        elif current_value < warning_threshold:
            return 'warning'
    
    return 'ok'


def format_alert_message(alert_data: Dict[str, Any], current_value: float) -> str:
    """Format alert message"""
    threshold_type = alert_data.get('threshold_type', 'alert')
    metric_name = alert_data.get('metric_name', alert_data['name'])
    
    message = f"""
🚨 {threshold_type.upper()}: {metric_name}

Current Value: {current_value}
Threshold: {alert_data['threshold']} {alert_data['operator']}
Alert Name: {alert_data['name']}
Time: {datetime.utcnow().isoformat()}

This is an automated alert from the Analytics Platform.
    """.strip()
    
    return message


def send_email_alert(channel: Dict[str, Any], message: str, alert_data: Dict[str, Any]) -> Dict[str, Any]:
    """Send email alert"""
    try:
        recipients = channel.get('recipients', [])
        if not recipients:
            return {"channel_type": "email", "status": "skipped", "reason": "no recipients"}
        
        subject = f"Alert: {alert_data['name']}"
        
        send_email(
            to_addresses=recipients,
            subject=subject,
            body=message,
            smtp_host=settings.alert_email_smtp_host,
            smtp_port=settings.alert_email_smtp_port,
            username=settings.alert_email_username,
            password=settings.alert_email_password
        )
        
        return {
            "channel_type": "email",
            "status": "success",
            "recipients": recipients
        }
        
    except Exception as exc:
        return {
            "channel_type": "email",
            "status": "failed",
            "error": str(exc)
        }


def send_webhook_alert(channel: Dict[str, Any], message: str, alert_data: Dict[str, Any]) -> Dict[str, Any]:
    """Send webhook alert"""
    try:
        webhook_url = channel.get('url')
        if not webhook_url:
            return {"channel_type": "webhook", "status": "skipped", "reason": "no URL"}
        
        payload = {
            "alert_name": alert_data['name'],
            "message": message,
            "current_value": get_alert_current_value(alert_data['query']),
            "threshold": alert_data['threshold'],
            "operator": alert_data['operator'],
            "timestamp": datetime.utcnow().isoformat()
        }
        
        send_webhook(webhook_url, payload)
        
        return {
            "channel_type": "webhook",
            "status": "success",
            "url": webhook_url
        }
        
    except Exception as exc:
        return {
            "channel_type": "webhook",
            "status": "failed",
            "error": str(exc)
        }


def send_slack_alert(channel: Dict[str, Any], message: str, alert_data: Dict[str, Any]) -> Dict[str, Any]:
    """Send Slack alert"""
    try:
        webhook_url = channel.get('webhook_url')
        if not webhook_url:
            return {"channel_type": "slack", "status": "skipped", "reason": "no webhook URL"}
        
        payload = {
            "text": f"🚨 Alert: {alert_data['name']}",
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"🚨 *{alert_data['name']}*"
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": f"*Current Value:*\n{get_alert_current_value(alert_data['query'])}"
                        },
                        {
                            "type": "mrkdwn", 
                            "text": f"*Threshold:*\n{alert_data['threshold']} {alert_data['operator']}"
                        }
                    ]
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Time:*\n{datetime.utcnow().isoformat()}"
                    }
                }
            ]
        }
        
        send_webhook(webhook_url, payload)
        
        return {
            "channel_type": "slack",
            "status": "success",
            "webhook_url": webhook_url
        }
        
    except Exception as exc:
        return {
            "channel_type": "slack",
            "status": "failed",
            "error": str(exc)
        }


def get_default_notification_channels() -> List[Dict[str, Any]]:
    """Get default notification channels from settings or environment"""
    channels = []
    
    # Add email channel if configured
    if settings.alert_email_smtp_host and settings.alert_email_username:
        channels.append({
            'type': 'email',
            'recipients': ['admin@example.com']  # Should be configurable
        })
    
    # Add webhook channel if configured
    if settings.alert_webhook_url:
        channels.append({
            'type': 'webhook',
            'url': settings.alert_webhook_url
        })
    
    return channels