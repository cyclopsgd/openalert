import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Job } from 'bullmq';
import IORedis from 'ioredis';

export interface EscalationJobData {
  incidentId: number;
  escalationPolicyId: number;
  currentLevel: number;
  attempt: number;
}

@Injectable()
export class EscalationQueueService implements OnModuleInit {
  private readonly logger = new Logger(EscalationQueueService.name);
  public queue: Queue<EscalationJobData>;
  private connection: IORedis;

  constructor(private readonly config: ConfigService) {
    this.connection = new IORedis({
      host: config.get('REDIS_HOST', 'localhost'),
      port: config.get('REDIS_PORT', 6379),
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue<EscalationJobData>('escalations', {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }

  async onModuleInit() {
    this.logger.log('Escalation queue initialized');
  }

  /**
   * Schedule an escalation for a specific level
   */
  async scheduleEscalation(
    incidentId: number,
    escalationPolicyId: number,
    level: number,
    delayMinutes: number,
  ): Promise<Job<EscalationJobData>> {
    const jobId = `escalation:${incidentId}:level-${level}`;

    // Remove existing job if any (prevents duplicates)
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      await existing.remove();
      this.logger.debug(`Removed existing escalation job: ${jobId}`);
    }

    const job = await this.queue.add(
      'escalate',
      {
        incidentId,
        escalationPolicyId,
        currentLevel: level,
        attempt: 1,
      },
      {
        jobId,
        delay: delayMinutes * 60 * 1000,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    this.logger.log(
      `Scheduled escalation for incident ${incidentId} level ${level} in ${delayMinutes} minutes`,
    );

    return job;
  }

  /**
   * Cancel all escalation jobs for an incident
   */
  async cancelEscalation(incidentId: number): Promise<void> {
    // Cancel all levels for this incident
    for (let level = 1; level <= 10; level++) {
      const jobId = `escalation:${incidentId}:level-${level}`;
      const job = await this.queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (['delayed', 'waiting', 'active'].includes(state)) {
          await job.remove();
          this.logger.log(`Cancelled escalation job: ${jobId}`);
        }
      }
    }
  }

  /**
   * Get pending escalations for an incident
   */
  async getPendingEscalations(incidentId: number): Promise<Job<EscalationJobData>[]> {
    const jobs: Job<EscalationJobData>[] = [];

    for (let level = 1; level <= 10; level++) {
      const jobId = `escalation:${incidentId}:level-${level}`;
      const job = await this.queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (['delayed', 'waiting', 'active'].includes(state)) {
          jobs.push(job);
        }
      }
    }

    return jobs;
  }
}
