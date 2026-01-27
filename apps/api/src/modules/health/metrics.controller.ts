import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { DatabaseService } from '../../database/database.service';
import { incidents, alerts } from '../../database/schema';
import { eq, sql } from 'drizzle-orm';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiExcludeEndpoint()
  async getMetrics() {
    const metrics: string[] = [];

    try {
      // Incident metrics by status
      const incidentsByStatus = await this.db.db
        .select({
          status: incidents.status,
          count: sql<number>`count(*)::int`,
        })
        .from(incidents)
        .groupBy(incidents.status);

      metrics.push('# HELP openalert_incidents_total Total number of incidents by status');
      metrics.push('# TYPE openalert_incidents_total gauge');
      for (const row of incidentsByStatus) {
        metrics.push(`openalert_incidents_total{status="${row.status}"} ${row.count}`);
      }

      // Incident metrics by severity
      const incidentsBySeverity = await this.db.db
        .select({
          severity: incidents.severity,
          count: sql<number>`count(*)::int`,
        })
        .from(incidents)
        .groupBy(incidents.severity);

      metrics.push('# HELP openalert_incidents_by_severity Incidents grouped by severity');
      metrics.push('# TYPE openalert_incidents_by_severity gauge');
      for (const row of incidentsBySeverity) {
        metrics.push(
          `openalert_incidents_by_severity{severity="${row.severity}"} ${row.count}`,
        );
      }

      // Alert metrics by status
      const alertsByStatus = await this.db.db
        .select({
          status: alerts.status,
          count: sql<number>`count(*)::int`,
        })
        .from(alerts)
        .groupBy(alerts.status);

      metrics.push('# HELP openalert_alerts_total Total number of alerts by status');
      metrics.push('# TYPE openalert_alerts_total gauge');
      for (const row of alertsByStatus) {
        metrics.push(`openalert_alerts_total{status="${row.status}"} ${row.count}`);
      }

      // Active incidents (triggered + acknowledged)
      const activeIncidents = await this.db.db
        .select({ count: sql<number>`count(*)::int` })
        .from(incidents)
        .where(
          sql`${incidents.status} IN ('triggered', 'acknowledged')`,
        );

      metrics.push('# HELP openalert_active_incidents Number of active incidents');
      metrics.push('# TYPE openalert_active_incidents gauge');
      metrics.push(`openalert_active_incidents ${activeIncidents[0]?.count || 0}`);

      // Critical active incidents
      const criticalIncidents = await this.db.db
        .select({ count: sql<number>`count(*)::int` })
        .from(incidents)
        .where(
          sql`${incidents.severity} = 'critical' AND ${incidents.status} IN ('triggered', 'acknowledged')`,
        );

      metrics.push('# HELP openalert_critical_incidents Number of critical active incidents');
      metrics.push('# TYPE openalert_critical_incidents gauge');
      metrics.push(`openalert_critical_incidents ${criticalIncidents[0]?.count || 0}`);

      // Mean time to acknowledge (MTTA)
      const mtta = await this.db.db
        .select({
          avgSeconds: sql<number>`AVG(EXTRACT(EPOCH FROM (acknowledged_at - triggered_at)))::int`,
        })
        .from(incidents)
        .where(sql`${incidents.acknowledgedAt} IS NOT NULL`);

      if (mtta[0]?.avgSeconds) {
        metrics.push('# HELP openalert_mtta_seconds Mean time to acknowledge in seconds');
        metrics.push('# TYPE openalert_mtta_seconds gauge');
        metrics.push(`openalert_mtta_seconds ${mtta[0].avgSeconds}`);
      }

      // Mean time to resolve (MTTR)
      const mttr = await this.db.db
        .select({
          avgSeconds: sql<number>`AVG(EXTRACT(EPOCH FROM (resolved_at - triggered_at)))::int`,
        })
        .from(incidents)
        .where(sql`${incidents.resolvedAt} IS NOT NULL`);

      if (mttr[0]?.avgSeconds) {
        metrics.push('# HELP openalert_mttr_seconds Mean time to resolve in seconds');
        metrics.push('# TYPE openalert_mttr_seconds gauge');
        metrics.push(`openalert_mttr_seconds ${mttr[0].avgSeconds}`);
      }

      // Process metrics
      const memoryUsage = process.memoryUsage();
      metrics.push('# HELP nodejs_memory_heap_used_bytes Node.js heap memory used');
      metrics.push('# TYPE nodejs_memory_heap_used_bytes gauge');
      metrics.push(`nodejs_memory_heap_used_bytes ${memoryUsage.heapUsed}`);

      metrics.push('# HELP nodejs_memory_heap_total_bytes Node.js total heap memory');
      metrics.push('# TYPE nodejs_memory_heap_total_bytes gauge');
      metrics.push(`nodejs_memory_heap_total_bytes ${memoryUsage.heapTotal}`);

      metrics.push('# HELP nodejs_memory_rss_bytes Node.js RSS memory');
      metrics.push('# TYPE nodejs_memory_rss_bytes gauge');
      metrics.push(`nodejs_memory_rss_bytes ${memoryUsage.rss}`);

      // Uptime
      metrics.push('# HELP process_uptime_seconds Process uptime in seconds');
      metrics.push('# TYPE process_uptime_seconds counter');
      metrics.push(`process_uptime_seconds ${process.uptime()}`);

    } catch (error) {
      metrics.push(`# Error gathering metrics: ${error.message}`);
    }

    return metrics.join('\n') + '\n';
  }
}
