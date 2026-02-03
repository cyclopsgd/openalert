import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AlertRoutingService } from './alert-routing.service';
import { CreateRoutingRuleDto } from './dto/create-routing-rule.dto';
import { UpdateRoutingRuleDto } from './dto/update-routing-rule.dto';
import { TestRoutingRuleDto } from './dto/test-routing-rule.dto';

@ApiTags('alert-routing')
@Controller('alert-routing')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AlertRoutingController {
  constructor(private readonly alertRoutingService: AlertRoutingService) {}

  @Post('rules')
  @ApiOperation({ summary: 'Create a routing rule' })
  createRule(@Body() dto: CreateRoutingRuleDto) {
    return this.alertRoutingService.create(dto);
  }

  @Get('rules/team/:teamId')
  @ApiOperation({ summary: 'List routing rules for a team' })
  listRulesByTeam(@Param('teamId') teamId: string) {
    return this.alertRoutingService.findByTeam(Number(teamId));
  }

  @Get('rules/:id')
  @ApiOperation({ summary: 'Get routing rule by ID' })
  getRule(@Param('id') id: string) {
    return this.alertRoutingService.findById(Number(id));
  }

  @Put('rules/:id')
  @ApiOperation({ summary: 'Update routing rule' })
  updateRule(@Param('id') id: string, @Body() dto: UpdateRoutingRuleDto) {
    return this.alertRoutingService.update(Number(id), dto);
  }

  @Delete('rules/:id')
  @ApiOperation({ summary: 'Delete routing rule' })
  async deleteRule(@Param('id') id: string) {
    await this.alertRoutingService.delete(Number(id));
    return { success: true };
  }

  @Put('rules/:id/priority')
  @ApiOperation({ summary: 'Update rule priority' })
  updateRulePriority(@Param('id') id: string, @Body() body: { priority: number }) {
    return this.alertRoutingService.updatePriority(Number(id), body.priority);
  }

  @Post('rules/test')
  @ApiOperation({ summary: 'Test a rule against a sample alert' })
  testRule(@Body() dto: TestRoutingRuleDto & { conditions: Record<string, unknown> }) {
    return this.alertRoutingService.testRule(dto.conditions, dto.sampleAlert);
  }

  @Get('rules/:id/matches')
  @ApiOperation({ summary: 'Get alerts matched by a rule' })
  getRuleMatches(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.alertRoutingService.getMatchesByRule(Number(id), limit ? Number(limit) : 50);
  }
}
