import nodemailer from 'nodemailer';
import axios from 'axios';
import config from '../config';
import logger from '../utils/logger';
import { ChannelConfig, SlackChannelConfig, EmailChannelConfig, WebhookChannelConfig } from '../types';

export class NotificationService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeEmailTransporter();
  }

  private initializeEmailTransporter(): void {
    if (config.notifications.smtp.user && config.notifications.smtp.password) {
      this.transporter = nodemailer.createTransport({
        host: config.notifications.smtp.host,
        port: config.notifications.smtp.port,
        secure: config.notifications.smtp.secure,
        auth: {
          user: config.notifications.smtp.user,
          pass: config.notifications.smtp.password,
        },
      });
    }
  }

  async send(channel: ChannelConfig, subject: string, message: string, attachments?: any[]): Promise<void> {
    switch (channel.type) {
      case 'slack':
        return this.sendSlack(channel as SlackChannelConfig, subject, message);
      case 'email':
        return this.sendEmail(channel as EmailChannelConfig, subject, message, attachments);
      case 'webhook':
        return this.sendWebhook(channel as WebhookChannelConfig, subject, message);
      default:
        throw new Error(`Unknown channel type: ${(channel as any).type}`);
    }
  }

  private async sendSlack(channel: SlackChannelConfig, subject: string, message: string): Promise<void> {
    try {
      const payload = {
        text: `*${subject}*\n${message}`,
        channel: channel.channel,
        username: channel.username || 'Analytics Bot',
        icon_emoji: channel.iconEmoji || ':chart_with_upwards_trend:',
      };

      await axios.post(channel.webhookUrl, payload);
      logger.info('Slack notification sent', { channel: channel.channel, subject });
    } catch (error) {
      logger.error('Failed to send Slack notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        channel: channel.channel,
      });
      throw error;
    }
  }

  private async sendEmail(
    channel: EmailChannelConfig,
    subject: string,
    message: string,
    attachments?: any[]
  ): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email transporter not configured');
    }

    try {
      const mailOptions = {
        from: config.notifications.smtp.from,
        to: channel.recipients.join(', '),
        subject: channel.subject || subject,
        text: message,
        html: this.formatEmailHTML(subject, message),
        cc: channel.cc?.join(', '),
        bcc: channel.bcc?.join(', '),
        attachments: attachments || [],
      };

      await this.transporter.sendMail(mailOptions);
      logger.info('Email notification sent', {
        recipients: channel.recipients,
        subject,
      });
    } catch (error) {
      logger.error('Failed to send email notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        recipients: channel.recipients,
      });
      throw error;
    }
  }

  private async sendWebhook(channel: WebhookChannelConfig, subject: string, message: string): Promise<void> {
    try {
      const payload = {
        subject,
        message,
        timestamp: new Date().toISOString(),
      };

      await axios({
        method: channel.method || 'POST',
        url: channel.url,
        headers: channel.headers || { 'Content-Type': 'application/json' },
        data: payload,
      });

      logger.info('Webhook notification sent', { url: channel.url, subject });
    } catch (error) {
      logger.error('Failed to send webhook notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        url: channel.url,
      });
      throw error;
    }
  }

  private formatEmailHTML(subject: string, message: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4A90E2; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${subject}</h1>
            </div>
            <div class="content">
              <p>${message.replace(/\n/g, '<br>')}</p>
            </div>
            <div class="footer">
              <p>This is an automated notification from Analytics Service</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  async testConnection(channel: ChannelConfig): Promise<boolean> {
    try {
      await this.send(channel, 'Test Notification', 'This is a test notification.');
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const notificationService = new NotificationService();
