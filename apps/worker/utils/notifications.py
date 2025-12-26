"""
Notification Utilities

This module provides utilities for sending notifications via email,
webhooks, and other channels.
"""

import smtplib
import json
import httpx
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import List, Optional, Dict, Any
import structlog

logger = structlog.get_logger(__name__)


def send_email(
    to_addresses: List[str],
    subject: str,
    body: str,
    smtp_host: str,
    smtp_port: int = 587,
    username: Optional[str] = None,
    password: Optional[str] = None,
    use_tls: bool = True,
    cc_addresses: Optional[List[str]] = None,
    bcc_addresses: Optional[List[str]] = None,
    reply_to: Optional[str] = None,
    html_body: Optional[str] = None
) -> Dict[str, Any]:
    """
    Send an email notification
    
    Args:
        to_addresses: List of recipient email addresses
        subject: Email subject
        body: Plain text email body
        smtp_host: SMTP server hostname
        smtp_port: SMTP server port (default: 587)
        username: SMTP username (optional)
        password: SMTP password (optional)
        use_tls: Whether to use TLS (default: True)
        cc_addresses: List of CC recipients (optional)
        bcc_addresses: List of BCC recipients (optional)
        reply_to: Reply-to address (optional)
        html_body: HTML email body (optional)
    
    Returns:
        Dictionary with send status and details
    """
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = username or 'analytics@example.com'
        msg['To'] = ', '.join(to_addresses)
        
        if cc_addresses:
            msg['Cc'] = ', '.join(cc_addresses)
        
        if reply_to:
            msg['Reply-To'] = reply_to
        
        # Add plain text part
        text_part = MIMEText(body, 'plain')
        msg.attach(text_part)
        
        # Add HTML part if provided
        if html_body:
            html_part = MIMEText(html_body, 'html')
            msg.attach(html_part)
        
        # Combine all recipients
        all_recipients = to_addresses.copy()
        if cc_addresses:
            all_recipients.extend(cc_addresses)
        if bcc_addresses:
            all_recipients.extend(bcc_addresses)
        
        # Send email
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            if use_tls:
                server.starttls()
            
            if username and password:
                server.login(username, password)
            
            server.send_message(msg, to_addrs=all_recipients)
        
        result = {
            "status": "success",
            "message": "Email sent successfully",
            "recipients": all_recipients,
            "subject": subject
        }
        
        logger.info("Email sent successfully", 
                   recipients=len(all_recipients), subject=subject)
        return result
        
    except Exception as exc:
        logger.error("Failed to send email", 
                   recipients=to_addresses, subject=subject, error=str(exc))
        return {
            "status": "failed",
            "message": f"Failed to send email: {str(exc)}",
            "recipients": to_addresses,
            "subject": subject
        }


def send_email_with_attachment(
    to_address: str,
    subject: str,
    body: str,
    attachment_path: str,
    smtp_host: str,
    smtp_port: int = 587,
    username: Optional[str] = None,
    password: Optional[str] = None,
    use_tls: bool = True
) -> Dict[str, Any]:
    """
    Send an email with an attachment
    
    Args:
        to_address: Recipient email address
        subject: Email subject
        body: Email body
        attachment_path: Path to file to attach
        smtp_host: SMTP server hostname
        smtp_port: SMTP server port (default: 587)
        username: SMTP username (optional)
        password: SMTP password (optional)
        use_tls: Whether to use TLS (default: True)
    
    Returns:
        Dictionary with send status and details
    """
    try:
        # Create message
        msg = MIMEMultipart()
        msg['Subject'] = subject
        msg['From'] = username or 'analytics@example.com'
        msg['To'] = to_address
        
        # Add body
        msg.attach(MIMEText(body, 'plain'))
        
        # Add attachment
        with open(attachment_path, 'rb') as attachment:
            part = MIMEBase('application', 'octet-stream')
            part.set_payload(attachment.read())
        
        encoders.encode_base64(part)
        
        import os
        filename = os.path.basename(attachment_path)
        part.add_header(
            'Content-Disposition',
            f'attachment; filename= {filename}'
        )
        
        msg.attach(part)
        
        # Send email
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            if use_tls:
                server.starttls()
            
            if username and password:
                server.login(username, password)
            
            server.send_message(msg, to_addrs=[to_address])
        
        result = {
            "status": "success",
            "message": "Email with attachment sent successfully",
            "recipient": to_address,
            "subject": subject,
            "attachment": attachment_path
        }
        
        logger.info("Email with attachment sent successfully", 
                   recipient=to_address, attachment=attachment_path)
        return result
        
    except Exception as exc:
        logger.error("Failed to send email with attachment", 
                   recipient=to_address, attachment_path=attachment_path, error=str(exc))
        return {
            "status": "failed",
            "message": f"Failed to send email with attachment: {str(exc)}",
            "recipient": to_address,
            "attachment": attachment_path
        }


def send_webhook(url: str, payload: Dict[str, Any], 
                method: str = 'POST', headers: Optional[Dict[str, str]] = None,
                timeout: int = 30) -> Dict[str, Any]:
    """
    Send a webhook notification
    
    Args:
        url: Webhook URL
        payload: Data to send
        method: HTTP method (default: POST)
        headers: Additional headers (optional)
        timeout: Request timeout in seconds (default: 30)
    
    Returns:
        Dictionary with send status and details
    """
    try:
        if headers is None:
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'Analytics-Worker/1.0'
            }
        
        with httpx.Client(timeout=timeout) as client:
            response = client.request(
                method=method,
                url=url,
                json=payload,
                headers=headers
            )
            
            response.raise_for_status()
            
            result = {
                "status": "success",
                "message": "Webhook sent successfully",
                "url": url,
                "method": method,
                "status_code": response.status_code,
                "response_body": response.text if response.text else None
            }
            
            logger.info("Webhook sent successfully", 
                       url=url, status_code=response.status_code)
            return result
            
    except httpx.HTTPStatusError as exc:
        logger.error("HTTP error sending webhook", 
                   url=url, status_code=exc.response.status_code, error=str(exc))
        return {
            "status": "failed",
            "message": f"HTTP error: {exc.response.status_code}",
            "url": url,
            "status_code": exc.response.status_code,
            "response_body": exc.response.text if exc.response.text else None
        }
        
    except Exception as exc:
        logger.error("Failed to send webhook", url=url, error=str(exc))
        return {
            "status": "failed",
            "message": f"Failed to send webhook: {str(exc)}",
            "url": url
        }


def send_slack_message(webhook_url: str, message: str, 
                      channel: Optional[str] = None, 
                      username: Optional[str] = None,
                      icon_emoji: Optional[str] = None) -> Dict[str, Any]:
    """
    Send a message to Slack via webhook
    
    Args:
        webhook_url: Slack webhook URL
        message: Message to send
        channel: Channel to send to (optional)
        username: Bot username (optional)
        icon_emoji: Bot icon emoji (optional)
    
    Returns:
        Dictionary with send status and details
    """
    try:
        payload = {
            "text": message
        }
        
        if channel:
            payload["channel"] = channel
        
        if username:
            payload["username"] = username
        
        if icon_emoji:
            payload["icon_emoji"] = icon_emoji
        
        return send_webhook(webhook_url, payload)
        
    except Exception as exc:
        logger.error("Failed to send Slack message", error=str(exc))
        return {
            "status": "failed",
            "message": f"Failed to send Slack message: {str(exc)}"
        }


def format_alert_email_html(alert_data: Dict[str, Any], current_value: float) -> str:
    """
    Format alert email as HTML
    
    Args:
        alert_data: Alert configuration data
        current_value: Current alert value
    
    Returns:
        HTML string for email body
    """
    severity = alert_data.get('threshold_type', 'warning').upper()
    color = 'red' if severity == 'CRITICAL' else 'orange'
    
    html = f"""
    <html>
    <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: {color}; color: white; padding: 20px; text-align: center;">
                <h1>🚨 {severity} ALERT</h1>
                <h2>{alert_data['name']}</h2>
            </div>
            
            <div style="padding: 20px; background-color: #f5f5f5;">
                <h3>Alert Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Current Value:</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #ddd;">{current_value}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Threshold:</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #ddd;">{alert_data['threshold']} {alert_data['operator']}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Time:</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #ddd;">{alert_data.get('timestamp', 'Unknown')}</td>
                    </tr>
                </table>
            </div>
            
            <div style="padding: 20px; background-color: #e9ecef;">
                <p><em>This is an automated alert from the Analytics Platform.</em></p>
                <p><small>If you believe this is an error, please contact your system administrator.</small></p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return html.strip()


def validate_email_config(smtp_host: str, smtp_port: int = 587,
                         username: Optional[str] = None, 
                         password: Optional[str] = None) -> Dict[str, Any]:
    """
    Validate email configuration
    
    Args:
        smtp_host: SMTP server hostname
        smtp_port: SMTP server port
        username: SMTP username (optional)
        password: SMTP password (optional)
    
    Returns:
        Dictionary with validation result
    """
    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            # Try to start TLS
            server.starttls()
            
            # Try to authenticate if credentials provided
            if username and password:
                server.login(username, password)
            
            return {
                "status": "success",
                "message": "Email configuration is valid"
            }
            
    except Exception as exc:
        return {
            "status": "failed",
            "message": f"Email configuration validation failed: {str(exc)}"
        }


def validate_webhook_config(url: str) -> Dict[str, Any]:
    """
    Validate webhook configuration
    
    Args:
        url: Webhook URL to validate
    
    Returns:
        Dictionary with validation result
    """
    try:
        # Send a test ping
        test_payload = {
            "test": True,
            "message": "Webhook configuration test",
            "timestamp": "2023-01-01T00:00:00Z"
        }
        
        result = send_webhook(url, test_payload)
        
        if result["status"] == "success":
            return {
                "status": "success",
                "message": "Webhook configuration is valid"
            }
        else:
            return {
                "status": "failed",
                "message": result["message"]
            }
            
    except Exception as exc:
        return {
            "status": "failed",
            "message": f"Webhook configuration validation failed: {str(exc)}"
        }