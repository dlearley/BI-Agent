"""
Data Export Utilities

This module provides utilities for exporting data to various formats.
"""

import csv
import json
import os
from typing import List, Dict, Any, Union
import structlog

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

logger = structlog.get_logger(__name__)


def export_to_csv(data: List[Dict[str, Any]], file_path: str) -> Dict[str, Any]:
    """
    Export data to CSV format
    
    Args:
        data: List of dictionaries to export
        file_path: Output file path
    
    Returns:
        Dictionary with export status and details
    """
    try:
        if not data:
            raise ValueError("No data to export")
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # Get fieldnames from first row
        fieldnames = list(data[0].keys())
        
        with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)
        
        result = {
            "status": "success",
            "message": f"Data exported to CSV: {file_path}",
            "file_path": file_path,
            "row_count": len(data),
            "format": "csv"
        }
        
        logger.info("Data exported to CSV", file_path=file_path, row_count=len(data))
        return result
        
    except Exception as exc:
        logger.error("Failed to export CSV", file_path=file_path, error=str(exc))
        return {
            "status": "failed",
            "message": f"Failed to export CSV: {str(exc)}",
            "file_path": file_path
        }


def export_to_json(data: List[Dict[str, Any]], file_path: str, 
                  pretty_print: bool = True) -> Dict[str, Any]:
    """
    Export data to JSON format
    
    Args:
        data: List of dictionaries to export
        file_path: Output file path
        pretty_print: Whether to format JSON with indentation (default: True)
    
    Returns:
        Dictionary with export status and details
    """
    try:
        if not data:
            raise ValueError("No data to export")
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        with open(file_path, 'w', encoding='utf-8') as jsonfile:
            if pretty_print:
                json.dump(data, jsonfile, indent=2, ensure_ascii=False, default=str)
            else:
                json.dump(data, jsonfile, ensure_ascii=False, default=str)
        
        result = {
            "status": "success",
            "message": f"Data exported to JSON: {file_path}",
            "file_path": file_path,
            "row_count": len(data),
            "format": "json"
        }
        
        logger.info("Data exported to JSON", file_path=file_path, row_count=len(data))
        return result
        
    except Exception as exc:
        logger.error("Failed to export JSON", file_path=file_path, error=str(exc))
        return {
            "status": "failed",
            "message": f"Failed to export JSON: {str(exc)}",
            "file_path": file_path
        }


def export_to_excel(data: List[Dict[str, Any]], file_path: str, 
                   sheet_name: str = "Data") -> Dict[str, Any]:
    """
    Export data to Excel format
    
    Args:
        data: List of dictionaries to export
        file_path: Output file path
        sheet_name: Name of the Excel sheet (default: "Data")
    
    Returns:
        Dictionary with export status and details
    """
    try:
        if not data:
            raise ValueError("No data to export")
        
        if not PANDAS_AVAILABLE:
            raise ImportError("pandas is required for Excel export. Install with: pip install pandas openpyxl")
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # Convert to DataFrame
        df = pd.DataFrame(data)
        
        # Export to Excel
        df.to_excel(file_path, sheet_name=sheet_name, index=False)
        
        result = {
            "status": "success",
            "message": f"Data exported to Excel: {file_path}",
            "file_path": file_path,
            "row_count": len(data),
            "format": "excel",
            "sheet_name": sheet_name
        }
        
        logger.info("Data exported to Excel", file_path=file_path, row_count=len(data))
        return result
        
    except ImportError as exc:
        logger.error("Excel export failed - pandas not available", error=str(exc))
        return {
            "status": "failed",
            "message": f"Excel export requires pandas: {str(exc)}",
            "file_path": file_path
        }
        
    except Exception as exc:
        logger.error("Failed to export Excel", file_path=file_path, error=str(exc))
        return {
            "status": "failed",
            "message": f"Failed to export Excel: {str(exc)}",
            "file_path": file_path
        }


def export_to_parquet(data: List[Dict[str, Any]], file_path: str) -> Dict[str, Any]:
    """
    Export data to Parquet format
    
    Args:
        data: List of dictionaries to export
        file_path: Output file path
    
    Returns:
        Dictionary with export status and details
    """
    try:
        if not data:
            raise ValueError("No data to export")
        
        if not PANDAS_AVAILABLE:
            raise ImportError("pandas is required for Parquet export. Install with: pip install pandas pyarrow")
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # Convert to DataFrame
        df = pd.DataFrame(data)
        
        # Export to Parquet
        df.to_parquet(file_path, index=False)
        
        result = {
            "status": "success",
            "message": f"Data exported to Parquet: {file_path}",
            "file_path": file_path,
            "row_count": len(data),
            "format": "parquet"
        }
        
        logger.info("Data exported to Parquet", file_path=file_path, row_count=len(data))
        return result
        
    except ImportError as exc:
        logger.error("Parquet export failed - pandas/pyarrow not available", error=str(exc))
        return {
            "status": "failed",
            "message": f"Parquet export requires pandas and pyarrow: {str(exc)}",
            "file_path": file_path
        }
        
    except Exception as exc:
        logger.error("Failed to export Parquet", file_path=file_path, error=str(exc))
        return {
            "status": "failed",
            "message": f"Failed to export Parquet: {str(exc)}",
            "file_path": file_path
        }


def auto_export(data: List[Dict[str, Any]], file_path: str) -> Dict[str, Any]:
    """
    Auto-detect format from file extension and export data
    
    Args:
        data: List of dictionaries to export
        file_path: Output file path (format determined by extension)
    
    Returns:
        Dictionary with export status and details
    """
    try:
        if not data:
            raise ValueError("No data to export")
        
        # Determine format from file extension
        _, ext = os.path.splitext(file_path.lower())
        
        if ext == '.csv':
            return export_to_csv(data, file_path)
        elif ext == '.json':
            return export_to_json(data, file_path)
        elif ext in ['.xlsx', '.xls']:
            return export_to_excel(data, file_path)
        elif ext == '.parquet':
            return export_to_parquet(data, file_path)
        else:
            raise ValueError(f"Unsupported file format: {ext}")
            
    except Exception as exc:
        logger.error("Auto export failed", file_path=file_path, error=str(exc))
        return {
            "status": "failed",
            "message": f"Auto export failed: {str(exc)}",
            "file_path": file_path
        }


def validate_export_data(data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Validate data for export
    
    Args:
        data: Data to validate
    
    Returns:
        Dictionary with validation result
    """
    try:
        if not data:
            return {
                "valid": False,
                "message": "No data to export"
            }
        
        if not isinstance(data, list):
            return {
                "valid": False,
                "message": "Data must be a list of dictionaries"
            }
        
        # Check first item
        first_item = data[0]
        if not isinstance(first_item, dict):
            return {
                "valid": False,
                "message": "Data items must be dictionaries"
            }
        
        # Check for consistent keys
        first_keys = set(first_item.keys())
        for i, item in enumerate(data[1:], 1):
            if not isinstance(item, dict):
                return {
                    "valid": False,
                    "message": f"Item {i} is not a dictionary"
                }
            
            current_keys = set(item.keys())
            if current_keys != first_keys:
                return {
                    "valid": False,
                    "message": f"Item {i} has different keys than first item"
                }
        
        return {
            "valid": True,
            "message": "Data is valid for export",
            "row_count": len(data),
            "column_count": len(first_keys),
            "columns": list(first_keys)
        }
        
    except Exception as exc:
        return {
            "valid": False,
            "message": f"Data validation failed: {str(exc)}"
        }


def get_file_info(file_path: str) -> Dict[str, Any]:
    """
    Get information about an exported file
    
    Args:
        file_path: Path to the file
    
    Returns:
        Dictionary with file information
    """
    try:
        if not os.path.exists(file_path):
            return {
                "exists": False,
                "file_path": file_path
            }
        
        stat = os.stat(file_path)
        
        return {
            "exists": True,
            "file_path": file_path,
            "size_bytes": stat.st_size,
            "size_mb": round(stat.st_size / (1024 * 1024), 2),
            "created_at": stat.st_ctime,
            "modified_at": stat.st_mtime,
            "readable": os.access(file_path, os.R_OK)
        }
        
    except Exception as exc:
        return {
            "exists": False,
            "file_path": file_path,
            "error": str(exc)
        }


def cleanup_old_exports(directory: str, max_age_days: int = 30) -> Dict[str, Any]:
    """
    Clean up old export files
    
    Args:
        directory: Directory to clean
        max_age_days: Maximum age in days (default: 30)
    
    Returns:
        Dictionary with cleanup results
    """
    try:
        import time
        
        if not os.path.exists(directory):
            return {
                "status": "success",
                "message": f"Directory does not exist: {directory}",
                "files_deleted": 0
            }
        
        current_time = time.time()
        max_age_seconds = max_age_days * 24 * 60 * 60
        deleted_files = []
        
        for filename in os.listdir(directory):
            file_path = os.path.join(directory, filename)
            
            if os.path.isfile(file_path):
                file_age = current_time - os.path.getmtime(file_path)
                
                if file_age > max_age_seconds:
                    try:
                        os.remove(file_path)
                        deleted_files.append(file_path)
                    except Exception as remove_exc:
                        logger.error("Failed to delete file", 
                                   file_path=file_path, error=str(remove_exc))
        
        return {
            "status": "success",
            "message": f"Cleaned up {len(deleted_files)} old files",
            "directory": directory,
            "files_deleted": len(deleted_files),
            "deleted_files": deleted_files
        }
        
    except Exception as exc:
        logger.error("Export cleanup failed", directory=directory, error=str(exc))
        return {
            "status": "failed",
            "message": f"Cleanup failed: {str(exc)}",
            "directory": directory
        }