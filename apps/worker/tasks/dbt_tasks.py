"""
dbt Tasks for Celery Worker

This module contains tasks related to running dbt transformations,
tests, and other dbt operations.
"""

import subprocess
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
import structlog

from ..celery_app import celery_app, dbt_circuit_breaker
from ..settings import settings
from ..utils.metrics import metrics_collector

logger = structlog.get_logger(__name__)


@celery_app.task(
    bind=True,
    max_retries=2,
    default_retry_delay=120,
    retry_backoff=True,
    retry_backoff_max=600
)
def run_dbt_models(self, dbt_args: List[str] = None) -> Dict[str, Any]:
    """
    Run dbt models with specified arguments
    
    Args:
        dbt_args: List of dbt command arguments (e.g., ['--models', 'staging'])
    """
    task_name = "run_dbt_models"
    
    if dbt_args is None:
        dbt_args = []
    
    try:
        with metrics_collector.task_duration(task_name):
            logger.info("Starting dbt run", dbt_args=dbt_args)
            
            with dbt_circuit_breaker:
                # Set up environment variables for dbt
                env = os.environ.copy()
                env['DBT_PROJECT_DIR'] = settings.dbt_project_path
                env['DBT_PROFILES_DIR'] = settings.dbt_profiles_dir
                
                # Build dbt command
                cmd = ['dbt', 'run'] + dbt_args
                
                # Change to dbt project directory
                original_cwd = os.getcwd()
                os.chdir(settings.dbt_project_path)
                
                try:
                    # Run dbt command
                    result = subprocess.run(
                        cmd,
                        capture_output=True,
                        text=True,
                        env=env,
                        timeout=3600  # 1 hour timeout
                    )
                    
                    # Parse dbt results
                    dbt_result = parse_dbt_run_result(result.stdout, result.stderr, result.returncode)
                    
                    if result.returncode == 0:
                        metrics_collector.task_completed(task_name)
                        
                        result_data = {
                            "status": "success",
                            "message": "dbt models executed successfully",
                            "timestamp": datetime.utcnow().isoformat(),
                            "dbt_args": dbt_args,
                            "dbt_result": dbt_result
                        }
                        
                        logger.info("dbt run completed successfully", **dbt_result)
                        return result_data
                    else:
                        raise Exception(f"dbt run failed: {result.stderr}")
                        
                finally:
                    os.chdir(original_cwd)
                
    except subprocess.TimeoutExpired as exc:
        logger.error("dbt run timed out", dbt_args=dbt_args)
        metrics_collector.task_failed(task_name, "timeout")
        raise self.retry(exc=exc)
        
    except Exception as exc:
        logger.error("dbt run failed", dbt_args=dbt_args, error=str(exc))
        metrics_collector.task_failed(task_name, str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    max_retries=2,
    default_retry_delay=60,
    retry_backoff=True
)
def run_dbt_tests(self, dbt_args: List[str] = None) -> Dict[str, Any]:
    """
    Run dbt tests
    
    Args:
        dbt_args: List of dbt test arguments
    """
    task_name = "run_dbt_tests"
    
    if dbt_args is None:
        dbt_args = []
    
    try:
        with metrics_collector.task_duration(task_name):
            logger.info("Starting dbt test", dbt_args=dbt_args)
            
            with dbt_circuit_breaker:
                env = os.environ.copy()
                env['DBT_PROJECT_DIR'] = settings.dbt_project_path
                env['DBT_PROFILES_DIR'] = settings.dbt_profiles_dir
                
                cmd = ['dbt', 'test'] + dbt_args
                
                original_cwd = os.getcwd()
                os.chdir(settings.dbt_project_path)
                
                try:
                    result = subprocess.run(
                        cmd,
                        capture_output=True,
                        text=True,
                        env=env,
                        timeout=1800  # 30 minutes timeout
                    )
                    
                    dbt_result = parse_dbt_test_result(result.stdout, result.stderr, result.returncode)
                    
                    metrics_collector.task_completed(task_name)
                    
                    result_data = {
                        "status": "success",
                        "message": "dbt tests completed",
                        "timestamp": datetime.utcnow().isoformat(),
                        "dbt_args": dbt_args,
                        "dbt_result": dbt_result
                    }
                    
                    logger.info("dbt tests completed", **dbt_result)
                    return result_data
                    
                finally:
                    os.chdir(original_cwd)
                
    except subprocess.TimeoutExpired as exc:
        logger.error("dbt test timed out", dbt_args=dbt_args)
        metrics_collector.task_failed(task_name, "timeout")
        raise self.retry(exc=exc)
        
    except Exception as exc:
        logger.error("dbt test failed", dbt_args=dbt_args, error=str(exc))
        metrics_collector.task_failed(task_name, str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    max_retries=1,
    default_retry_delay=30
)
def dbt_docs_generate(self) -> Dict[str, Any]:
    """
    Generate dbt documentation
    """
    task_name = "dbt_docs_generate"
    
    try:
        with metrics_collector.task_duration(task_name):
            logger.info("Generating dbt documentation")
            
            with dbt_circuit_breaker:
                env = os.environ.copy()
                env['DBT_PROJECT_DIR'] = settings.dbt_project_path
                env['DBT_PROFILES_DIR'] = settings.dbt_profiles_dir
                
                cmd = ['dbt', 'docs', 'generate']
                
                original_cwd = os.getcwd()
                os.chdir(settings.dbt_project_path)
                
                try:
                    result = subprocess.run(
                        cmd,
                        capture_output=True,
                        text=True,
                        env=env,
                        timeout=600  # 10 minutes timeout
                    )
                    
                    if result.returncode == 0:
                        metrics_collector.task_completed(task_name)
                        
                        result_data = {
                            "status": "success",
                            "message": "dbt documentation generated successfully",
                            "timestamp": datetime.utcnow().isoformat(),
                            "output": result.stdout
                        }
                        
                        logger.info("dbt documentation generated successfully")
                        return result_data
                    else:
                        raise Exception(f"dbt docs generate failed: {result.stderr}")
                        
                finally:
                    os.chdir(original_cwd)
                
    except subprocess.TimeoutExpired as exc:
        logger.error("dbt docs generate timed out")
        metrics_collector.task_failed(task_name, "timeout")
        raise self.retry(exc=exc)
        
    except Exception as exc:
        logger.error("dbt docs generate failed", error=str(exc))
        metrics_collector.task_failed(task_name, str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    max_retries=1,
    default_retry_delay=30
)
def dbt_freshness_check(self, source_names: List[str] = None) -> Dict[str, Any]:
    """
    Check data freshness for dbt sources
    
    Args:
        source_names: Optional list of specific sources to check
    """
    task_name = "dbt_freshness_check"
    
    try:
        with metrics_collector.task_duration(task_name):
            logger.info("Checking dbt source freshness", source_names=source_names)
            
            with dbt_circuit_breaker:
                env = os.environ.copy()
                env['DBT_PROJECT_DIR'] = settings.dbt_project_path
                env['DBT_PROFILES_DIR'] = settings.dbt_profiles_dir
                
                cmd = ['dbt', 'source', 'freshness']
                if source_names:
                    cmd.extend(['--select', ','.join(source_names)])
                
                original_cwd = os.getcwd()
                os.chdir(settings.dbt_project_path)
                
                try:
                    result = subprocess.run(
                        cmd,
                        capture_output=True,
                        text=True,
                        env=env,
                        timeout=300  # 5 minutes timeout
                    )
                    
                    freshness_result = parse_dbt_freshness_result(result.stdout, result.stderr, result.returncode)
                    
                    metrics_collector.task_completed(task_name)
                    
                    result_data = {
                        "status": "success",
                        "message": "dbt freshness check completed",
                        "timestamp": datetime.utcnow().isoformat(),
                        "source_names": source_names,
                        "freshness_result": freshness_result
                    }
                    
                    logger.info("dbt freshness check completed", **freshness_result)
                    return result_data
                    
                finally:
                    os.chdir(original_cwd)
                
    except subprocess.TimeoutExpired as exc:
        logger.error("dbt freshness check timed out", source_names=source_names)
        metrics_collector.task_failed(task_name, "timeout")
        raise self.retry(exc=exc)
        
    except Exception as exc:
        logger.error("dbt freshness check failed", source_names=source_names, error=str(exc))
        metrics_collector.task_failed(task_name, str(exc))
        raise self.retry(exc=exc)


def parse_dbt_run_result(stdout: str, stderr: str, returncode: int) -> Dict[str, Any]:
    """Parse dbt run output and extract key metrics"""
    try:
        # Look for run results in stdout
        lines = stdout.split('\n')
        result = {
            "returncode": returncode,
            "models_executed": 0,
            "models_passed": 0,
            "models_failed": 0,
            "execution_time": 0,
            "errors": []
        }
        
        for line in lines:
            if "Run" in line and "models" in line:
                # Extract model counts from summary line
                if "completed successfully" in line:
                    result["models_passed"] = result["models_executed"]
                elif "failed" in line:
                    parts = line.split()
                    for i, part in enumerate(parts):
                        if part == "failed" and i > 0:
                            try:
                                result["models_failed"] = int(parts[i-1])
                            except ValueError:
                                pass
            
            if "elapsed" in line.lower() or "time" in line.lower():
                # Extract execution time
                try:
                    time_str = line.split()[-1]
                    if time_str.endswith('s'):
                        result["execution_time"] = float(time_str[:-1])
                except (ValueError, IndexError):
                    pass
        
        if returncode != 0:
            result["errors"] = [stderr]
        
        return result
        
    except Exception:
        return {
            "returncode": returncode,
            "raw_output": stdout,
            "error_output": stderr,
            "parsing_failed": True
        }


def parse_dbt_test_result(stdout: str, stderr: str, returncode: int) -> Dict[str, Any]:
    """Parse dbt test output"""
    try:
        lines = stdout.split('\n')
        result = {
            "returncode": returncode,
            "tests_passed": 0,
            "tests_failed": 0,
            "tests_warned": 0,
            "execution_time": 0,
            "errors": []
        }
        
        for line in lines:
            if "PASS" in line:
                result["tests_passed"] += 1
            elif "FAIL" in line:
                result["tests_failed"] += 1
            elif "WARN" in line:
                result["tests_warned"] += 1
        
        if returncode != 0:
            result["errors"] = [stderr]
        
        return result
        
    except Exception:
        return {
            "returncode": returncode,
            "raw_output": stdout,
            "error_output": stderr,
            "parsing_failed": True
        }


def parse_dbt_freshness_result(stdout: str, stderr: str, returncode: int) -> Dict[str, Any]:
    """Parse dbt source freshness output"""
    try:
        lines = stdout.split('\n')
        result = {
            "returncode": returncode,
            "sources_checked": 0,
            "sources_fresh": 0,
            "sources_stale": 0,
            "errors": []
        }
        
        for line in lines:
            if "fresh" in line.lower():
                result["sources_fresh"] += 1
            elif "stale" in line.lower():
                result["sources_stale"] += 1
        
        result["sources_checked"] = result["sources_fresh"] + result["sources_stale"]
        
        if returncode != 0:
            result["errors"] = [stderr]
        
        return result
        
    except Exception:
        return {
            "returncode": returncode,
            "raw_output": stdout,
            "error_output": stderr,
            "parsing_failed": True
        }