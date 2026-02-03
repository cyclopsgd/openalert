import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { eq } from 'drizzle-orm';
import sgMail from '@sendgrid/mail';
import { DatabaseService } from '../database/database.service';
import { NotificationJobData } from './notification.queue';
import { notificationLogs } from '../database/schema';

@Injectable()
export class NotificationWorkerService implements OnModuleInit {
  private readonly logger = new Logger(NotificationWorkerService.name);
  private worker: Worker<NotificationJobData>;
  private connection: IORedis;

  constructor(
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
  ) {
    this.connection = new IORedis({
      host: config.get('REDIS_HOST', 'localhost'),
      port: config.get('REDIS_PORT', 6379),
      maxRetriesPerRequest: null,
    });

    // Initialize SendGrid with API key
    const sendgridApiKey = config.get<string>('SENDGRID_API_KEY');
    if (sendgridApiKey) {
      sgMail.setApiKey(sendgridApiKey);
      this.logger.log('✅ SendGrid email service initialized');
    } else {
      this.logger.warn('⚠️  SENDGRID_API_KEY not configured - email notifications will fail');
    }
  }

  async onModuleInit() {
    this.worker = new Worker<NotificationJobData>(
      'notifications',
      async (job: Job<NotificationJobData>) => {
        return this.processNotification(job);
      },
      {
        connection: this.connection,
        concurrency: 10,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Notification job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Notification job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log('Notification worker started');
  }

  private async processNotification(job: Job<NotificationJobData>): Promise<void> {
    const { incidentId, userId, channel, payload } = job.data;

    this.logger.log(`Processing ${channel} notification for user ${userId}`);

    // Create notification log entry
    const [logEntry] = await this.db.db
      .insert(notificationLogs)
      .values({
        incidentId,
        userId,
        channel,
        status: 'pending',
        metadata: { jobId: job.id },
        createdAt: new Date(),
      })
      .returning();

    try {
      // Route to appropriate channel handler
      switch (channel) {
        case 'email':
          await this.sendEmail(payload);
          break;
        case 'sms':
          await this.sendSms(payload);
          break;
        case 'voice':
          await this.makeVoiceCall(payload);
          break;
        case 'push':
          await this.sendPushNotification(payload);
          break;
        case 'slack':
          await this.sendSlackMessage(payload);
          break;
        case 'teams':
          await this.sendTeamsMessage(payload);
          break;
        default:
          throw new Error(`Unknown notification channel: ${channel}`);
      }

      // Update notification log as sent
      await this.db.db
        .update(notificationLogs)
        .set({
          status: 'sent',
          sentAt: new Date(),
        })
        .where(eq(notificationLogs.id, logEntry.id));
    } catch (error) {
      // Update notification log as failed
      await this.db.db
        .update(notificationLogs)
        .set({
          status: 'failed',
          failureReason: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(notificationLogs.id, logEntry.id));

      throw error;
    }
  }

  /**
   * Send email notification via SendGrid
   */
  private async sendEmail(payload: NotificationJobData['payload']): Promise<void> {
    if (!payload.email) {
      throw new Error('Email address is required for email notifications');
    }

    const fromEmail = this.config.get<string>('SENDGRID_FROM_EMAIL', 'alerts@openalert.io');
    const fromName = this.config.get<string>('SENDGRID_FROM_NAME', 'OpenAlert');

    const msg = {
      to: payload.email,
      from: {
        email: fromEmail,
        name: fromName,
      },
      subject: payload.subject || 'OpenAlert Incident Notification',
      text: payload.message,
      html: this.generateEmailHtml(payload),
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`✅ Email sent successfully to ${payload.email}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send email to ${payload.email}:`, error);
      throw new Error(`SendGrid error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate HTML email template for incident notifications
   */
  private generateEmailHtml(payload: NotificationJobData['payload']): string {
    const incidentUrl = payload.incidentUrl || '#';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${payload.subject || 'Incident Alert'}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                🚨 ${payload.subject || 'Incident Alert'}
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <div style="color: #374151; font-size: 16px; line-height: 1.6;">
                ${payload.message.replace(/\n/g, '<br>')}
              </div>
            </td>
          </tr>

          <!-- Action Button -->
          <tr>
            <td style="padding: 0 32px 32px;">
              <a href="${incidentUrl}"
                 style="display: inline-block; padding: 12px 32px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                View Incident Details
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                This is an automated notification from OpenAlert. Do not reply to this email.
              </p>
              <p style="margin: 8px 0 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} OpenAlert. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  private async sendSms(payload: NotificationJobData['payload']): Promise<void> {
    this.logger.log(`[STUB] Sending SMS to ${payload.phoneNumber}: ${payload.message}`);
    // TODO: Integrate with Twilio
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async makeVoiceCall(payload: NotificationJobData['payload']): Promise<void> {
    this.logger.log(`[STUB] Making voice call to ${payload.phoneNumber}`);
    // TODO: Integrate with Twilio Voice
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async sendPushNotification(
    payload: NotificationJobData['payload'],
  ): Promise<void> {
    this.logger.log(`[STUB] Sending push notification: ${payload.message}`);
    // TODO: Integrate with Firebase Cloud Messaging / APNs
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async sendSlackMessage(payload: NotificationJobData['payload']): Promise<void> {
    this.logger.log(`[STUB] Sending Slack message: ${payload.message}`);
    // TODO: Integrate with Slack API
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async sendTeamsMessage(payload: NotificationJobData['payload']): Promise<void> {
    this.logger.log(`[STUB] Sending Teams message: ${payload.message}`);
    // TODO: Integrate with Microsoft Teams webhooks
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  async close(): Promise<void> {
    await this.worker.close();
    this.logger.log('Notification worker closed');
  }
}
