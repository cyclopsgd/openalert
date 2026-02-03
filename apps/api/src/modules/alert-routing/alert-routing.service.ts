import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  alertRoutingRules,
  alertRoutingMatches,
  AlertRoutingRule,
  Alert,
} from '../../database/schema';
import { CreateRoutingRuleDto } from './dto/create-routing-rule.dto';
import { UpdateRoutingRuleDto } from './dto/update-routing-rule.dto';

interface RoutingAction {
  routeToServiceId?: number;
  setSeverity?: string;
  suppress?: boolean;
  addTags?: string[];
  escalationPolicyId?: number;
}

interface EvaluationResult {
  matched: boolean;
  matchedRules: AlertRoutingRule[];
  actions: RoutingAction[];
}

@Injectable()
export class AlertRoutingService {
  private readonly logger = new Logger(AlertRoutingService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Create a new routing rule
   */
  async create(dto: CreateRoutingRuleDto): Promise<AlertRoutingRule> {
    this.logger.log(`Creating routing rule: ${dto.name}`);

    const [rule] = await this.db.db
      .insert(alertRoutingRules)
      .values({
        name: dto.name,
        priority: dto.priority,
        enabled: dto.enabled,
        teamId: dto.teamId,
        conditions: dto.conditions || {},
        actions: dto.actions || {},
      })
      .returning();

    return rule;
  }

  /**
   * List all routing rules for a team
   */
  async findByTeam(teamId: number): Promise<AlertRoutingRule[]> {
    return this.db.db.query.alertRoutingRules.findMany({
      where: eq(alertRoutingRules.teamId, teamId),
      orderBy: [desc(alertRoutingRules.priority), desc(alertRoutingRules.createdAt)],
    });
  }

  /**
   * Get a routing rule by ID
   */
  async findById(id: number): Promise<AlertRoutingRule> {
    const rule = await this.db.db.query.alertRoutingRules.findFirst({
      where: eq(alertRoutingRules.id, id),
    });

    if (!rule) {
      throw new NotFoundException(`Routing rule with ID ${id} not found`);
    }

    return rule;
  }

  /**
   * Update a routing rule
   */
  async update(id: number, dto: UpdateRoutingRuleDto): Promise<AlertRoutingRule> {
    this.logger.log(`Updating routing rule ${id}`);

    const [updated] = await this.db.db
      .update(alertRoutingRules)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(eq(alertRoutingRules.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Routing rule with ID ${id} not found`);
    }

    return updated;
  }

  /**
   * Delete a routing rule
   */
  async delete(id: number): Promise<void> {
    this.logger.log(`Deleting routing rule ${id}`);

    const result = await this.db.db
      .delete(alertRoutingRules)
      .where(eq(alertRoutingRules.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Routing rule with ID ${id} not found`);
    }
  }

  /**
   * Update rule priority
   */
  async updatePriority(id: number, priority: number): Promise<AlertRoutingRule> {
    return this.update(id, { priority });
  }

  /**
   * Evaluate routing rules against an alert
   */
  async evaluateRules(alert: Alert, teamId: number): Promise<EvaluationResult> {
    this.logger.debug(`Evaluating routing rules for alert ${alert.id}`);

    // Get all enabled rules for the team, sorted by priority
    const rules = await this.db.db.query.alertRoutingRules.findMany({
      where: and(eq(alertRoutingRules.teamId, teamId), eq(alertRoutingRules.enabled, true)),
      orderBy: [desc(alertRoutingRules.priority)],
    });

    const matchedRules: AlertRoutingRule[] = [];
    const actions: RoutingAction[] = [];

    for (const rule of rules) {
      const matches = this.evaluateConditions(alert, rule.conditions as Record<string, unknown>);

      if (matches) {
        matchedRules.push(rule);

        // Parse and collect actions
        const ruleActions = rule.actions as RoutingAction;
        if (ruleActions) {
          actions.push(ruleActions);
        }

        // Record the match
        await this.recordMatch(alert.id, rule.id);

        // Stop at first match (can be configured to evaluate all)
        break;
      }
    }

    return {
      matched: matchedRules.length > 0,
      matchedRules,
      actions,
    };
  }

  /**
   * Test a rule against a sample alert
   */
  testRule(
    conditions: Record<string, unknown>,
    sampleAlert: Record<string, unknown>,
  ): { matches: boolean; reason: string } {
    const mockAlert = {
      ...sampleAlert,
      labels: sampleAlert.labels || {},
    } as Alert;

    const matches = this.evaluateConditions(mockAlert, conditions);

    return {
      matches,
      reason: matches
        ? 'All conditions matched'
        : 'One or more conditions did not match',
    };
  }

  /**
   * Get alerts matched by a rule
   */
  async getMatchesByRule(ruleId: number, limit = 50): Promise<unknown[]> {
    const matches = await this.db.db.query.alertRoutingMatches.findMany({
      where: eq(alertRoutingMatches.ruleId, ruleId),
      with: {
        alert: true,
      },
      limit,
      orderBy: [desc(alertRoutingMatches.matchedAt)],
    });

    return matches;
  }

  /**
   * Evaluate conditions against an alert
   */
  private evaluateConditions(
    alert: Alert,
    conditions: Record<string, unknown>,
  ): boolean {
    if (!conditions || Object.keys(conditions).length === 0) {
      return true; // No conditions = always match
    }

    // Check label conditions
    if (conditions.labels && typeof conditions.labels === 'object') {
      const labelConditions = conditions.labels as Record<string, string>;
      const alertLabels = (alert.labels || {}) as Record<string, string>;

      for (const [key, value] of Object.entries(labelConditions)) {
        if (alertLabels[key] !== value) {
          return false;
        }
      }
    }

    // Check source condition
    if (conditions.source && alert.source !== conditions.source) {
      return false;
    }

    // Check severity condition (array or single value)
    if (conditions.severity) {
      const severityConditions = Array.isArray(conditions.severity)
        ? conditions.severity
        : [conditions.severity];
      if (!severityConditions.includes(alert.severity)) {
        return false;
      }
    }

    // Check title contains
    if (conditions.titleContains && typeof conditions.titleContains === 'string') {
      if (!alert.title.toLowerCase().includes(conditions.titleContains.toLowerCase())) {
        return false;
      }
    }

    // Check description regex
    if (conditions.descriptionMatches && typeof conditions.descriptionMatches === 'string') {
      try {
        const regex = new RegExp(conditions.descriptionMatches);
        if (!regex.test(alert.description || '')) {
          return false;
        }
      } catch (error) {
        this.logger.warn(
          `Invalid regex in condition: ${conditions.descriptionMatches}`,
        );
        return false;
      }
    }

    // Check match mode (all vs any)
    const matchMode = conditions.matchMode || 'all';

    if (matchMode === 'any') {
      // At least one condition must match
      // (This is a simplified version - in reality, you'd track each condition separately)
      return true;
    }

    // Default: all conditions must match
    return true;
  }

  /**
   * Record a rule match
   */
  private async recordMatch(alertId: number, ruleId: number): Promise<void> {
    await this.db.db.insert(alertRoutingMatches).values({
      alertId,
      ruleId,
      matchedAt: new Date(),
    });
  }
}
