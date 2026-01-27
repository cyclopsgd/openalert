import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { eq } from 'drizzle-orm';
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

  // Stub implementations - these will be replaced with real integrations

  private async sendEmail(payload: NotificationJobData['payload']): Promise<void> {
    this.logger.log(
      `[STUB] Sending email to ${payload.email}: ${payload.subject}`,
    );
    // TODO: Integrate with SendGrid/AWS SES
    // For now, just simulate success
    await new Promise((resolve) => setTimeout(resolve, 100));
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
