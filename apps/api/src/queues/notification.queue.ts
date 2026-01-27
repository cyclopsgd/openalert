import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Job } from 'bullmq';
import IORedis from 'ioredis';

export type NotificationChannel = 'email' | 'sms' | 'voice' | 'push' | 'slack' | 'teams';
export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';

export interface NotificationJobData {
  incidentId: number;
  userId: number;
  channel: NotificationChannel;
  priority: NotificationPriority;
  payload: {
    subject?: string;
    message: string;
    incidentUrl?: string;
    phoneNumber?: string;
    email?: string;
  };
}

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);
  public queue: Queue<NotificationJobData>;
  private connection: IORedis;

  constructor(private readonly config: ConfigService) {
    this.connection = new IORedis({
      host: config.get('REDIS_HOST', 'localhost'),
      port: config.get('REDIS_PORT', 6379),
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue<NotificationJobData>('notifications', {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400, count: 5000 },
      },
    });
  }

  /**
   * Queue a single notification
   */
  async queueNotification(data: NotificationJobData): Promise<Job<NotificationJobData>> {
    const priorityMap: Record<NotificationPriority, number> = {
      critical: 1,
      high: 2,
      medium: 5,
      low: 10,
    };

    const attemptsByChannel: Record<NotificationChannel, number> = {
      email: 5,
      sms: 4,
      voice: 3,
      push: 4,
      slack: 5,
      teams: 5,
    };

    const job = await this.queue.add(data.channel, data, {
      priority: priorityMap[data.priority],
      attempts: attemptsByChannel[data.channel],
      backoff: { type: 'exponential', delay: 2000 },
    });

    this.logger.log(
      `Queued ${data.channel} notification for user ${data.userId} (incident ${data.incidentId})`,
    );

    return job;
  }

  /**
   * Queue multiple notifications in bulk
   */
  async queueBulkNotifications(
    notifications: NotificationJobData[],
  ): Promise<Job<NotificationJobData>[]> {
    return Promise.all(notifications.map((n) => this.queueNotification(n)));
  }

  /**
   * Get notification stats
   */
  async getStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }
}
