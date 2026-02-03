import { Injectable, Logger } from '@nestjs/common';
import { sql, eq, and, gte, lt, count } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { incidents } from '../../database/schema';

export interface DashboardMetrics {
  activeCount: number;
  mtta: string; // Mean Time To Acknowledge
  mttr: string; // Mean Time To Resolve
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  statusBreakdown: {
    triggered: number;
    acknowledged: number;
    resolved: number;
  };
  onCallEngineer?: {
    name: string;
    email: string;
  };
}

export interface IncidentTrend {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

export interface ResponseTimeBucket {
  bucket: string;
  count: number;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get all dashboard metrics in one call
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const [activeCount, mtta, mttr, severityBreakdown, statusBreakdown] = await Promise.all([
      this.getActiveIncidentsCount(),
      this.calculateMTTA(),
      this.calculateMTTR(),
      this.getSeverityBreakdown(),
      this.getStatusBreakdown(),
    ]);

    return {
      activeCount,
      mtta: this.formatDuration(mtta),
      mttr: this.formatDuration(mttr),
      severityBreakdown,
      statusBreakdown,
      onCallEngineer: undefined, // TODO: Implement when schedules are ready
    };
  }

  /**
   * Get active incidents count (triggered + acknowledged)
   */
  private async getActiveIncidentsCount(): Promise<number> {
    const result = await this.db.db
      .select({ count: count() })
      .from(incidents)
      .where(sql`${incidents.status} IN ('triggered', 'acknowledged')`);

    return result[0]?.count || 0;
  }

  /**
   * Calculate Mean Time To Acknowledge (in minutes)
   */
  private async calculateMTTA(): Promise<number> {
    const result = await this.db.db.execute<{ avg: string }>(sql`
      SELECT
        COALESCE(
          AVG(
            EXTRACT(EPOCH FROM (acknowledged_at - triggered_at)) / 60
          )::integer,
          0
        ) as avg
      FROM incidents
      WHERE acknowledged_at IS NOT NULL
        AND triggered_at IS NOT NULL
        AND acknowledged_at >= NOW() - INTERVAL '30 days'
    `);

    return Number(result.rows[0]?.avg || 0);
  }

  /**
   * Calculate Mean Time To Resolve (in minutes)
   */
  private async calculateMTTR(): Promise<number> {
    const result = await this.db.db.execute<{ avg: string }>(sql`
      SELECT
        COALESCE(
          AVG(
            EXTRACT(EPOCH FROM (resolved_at - triggered_at)) / 60
          )::integer,
          0
        ) as avg
      FROM incidents
      WHERE resolved_at IS NOT NULL
        AND triggered_at IS NOT NULL
        AND resolved_at >= NOW() - INTERVAL '30 days'
    `);

    return Number(result.rows[0]?.avg || 0);
  }

  /**
   * Get breakdown of active incidents by severity
   */
  private async getSeverityBreakdown(): Promise<DashboardMetrics['severityBreakdown']> {
    const result = await this.db.db.execute<{ severity: string; count: string }>(sql`
      SELECT
        severity,
        COUNT(*)::integer as count
      FROM incidents
      WHERE status IN ('triggered', 'acknowledged')
      GROUP BY severity
    `);

    const breakdown = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    for (const row of result.rows) {
      const severity = row.severity as keyof typeof breakdown;
      breakdown[severity] = Number(row.count);
    }

    return breakdown;
  }

  /**
   * Get breakdown by status
   */
  private async getStatusBreakdown(): Promise<DashboardMetrics['statusBreakdown']> {
    const result = await this.db.db.execute<{ status: string; count: string }>(sql`
      SELECT
        status,
        COUNT(*)::integer as count
      FROM incidents
      GROUP BY status
    `);

    const breakdown = {
      triggered: 0,
      acknowledged: 0,
      resolved: 0,
    };

    for (const row of result.rows) {
      const status = row.status as keyof typeof breakdown;
      breakdown[status] = Number(row.count);
    }

    return breakdown;
  }

  /**
   * Get incident trends for the last N days
   */
  async getIncidentTrends(days: number = 30): Promise<IncidentTrend[]> {
    const result = await this.db.db.execute<{
      date: string;
      severity: string;
      count: string;
    }>(sql`
      SELECT
        DATE(triggered_at) as date,
        severity,
        COUNT(*)::integer as count
      FROM incidents
      WHERE triggered_at >= NOW() - INTERVAL '${sql.raw(days.toString())} days'
      GROUP BY DATE(triggered_at), severity
      ORDER BY date ASC
    `);

    // Group by date and build trend data
    const trendsMap = new Map<string, IncidentTrend>();

    for (const row of result.rows) {
      const date = row.date;
      if (!trendsMap.has(date)) {
        trendsMap.set(date, {
          date,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
          total: 0,
        });
      }

      const trend = trendsMap.get(date)!;
      const severity = row.severity as keyof Omit<IncidentTrend, 'date' | 'total'>;
      const countValue = Number(row.count);
      trend[severity] = countValue;
      trend.total += countValue;
    }

    // Fill in missing dates with zeros
    const trends: IncidentTrend[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      trends.push(
        trendsMap.get(dateStr) || {
          date: dateStr,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
          total: 0,
        },
      );
    }

    return trends;
  }

  /**
   * Get response time distribution in buckets
   */
  async getResponseTimes(): Promise<ResponseTimeBucket[]> {
    const result = await this.db.db.execute<{
      bucket: string;
      count: string;
    }>(sql`
      SELECT
        CASE
          WHEN EXTRACT(EPOCH FROM (acknowledged_at - triggered_at)) / 60 < 5 THEN '<5min'
          WHEN EXTRACT(EPOCH FROM (acknowledged_at - triggered_at)) / 60 < 15 THEN '5-15min'
          WHEN EXTRACT(EPOCH FROM (acknowledged_at - triggered_at)) / 60 < 60 THEN '15-60min'
          ELSE '>60min'
        END as bucket,
        COUNT(*)::integer as count
      FROM incidents
      WHERE acknowledged_at IS NOT NULL
        AND triggered_at IS NOT NULL
        AND acknowledged_at >= NOW() - INTERVAL '30 days'
      GROUP BY bucket
      ORDER BY
        CASE bucket
          WHEN '<5min' THEN 1
          WHEN '5-15min' THEN 2
          WHEN '15-60min' THEN 3
          WHEN '>60min' THEN 4
        END
    `);

    // Ensure all buckets are present
    const buckets = ['<5min', '5-15min', '15-60min', '>60min'];
    const bucketMap = new Map<string, number>();

    for (const row of result.rows) {
      bucketMap.set(row.bucket, Number(row.count));
    }

    return buckets.map((bucket) => ({
      bucket,
      count: bucketMap.get(bucket) || 0,
    }));
  }

  /**
   * Format duration in minutes to human-readable string
   */
  private formatDuration(minutes: number): string {
    if (minutes === 0) return '0m';

    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
    }

    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }

    return `${mins}m`;
  }
}
