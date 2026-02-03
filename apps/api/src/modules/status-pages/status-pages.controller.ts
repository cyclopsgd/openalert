import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TeamMemberGuard } from '../../common/guards/team-member.guard';
import { TeamResourceDecorator } from '../../common/decorators/team-resource.decorator';
import { RequireTeamRoles } from '../../common/decorators/require-team-roles.decorator';
import {
  StatusPagesService,
  CreateStatusPageDto,
  UpdateStatusPageDto,
} from './status-pages.service';
import {
  ComponentsService,
  CreateComponentDto,
  UpdateComponentDto,
} from './components.service';
import {
  StatusPageIncidentsService,
  CreateStatusPageIncidentDto,
  UpdateStatusPageIncidentDto,
  CreateStatusUpdateDto,
} from './incidents.service';

// ============================================
// Authenticated Management Endpoints
// ============================================

@ApiTags('status-pages')
@Controller('status-pages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StatusPagesManagementController {
  constructor(
    private readonly statusPagesService: StatusPagesService,
    private readonly componentsService: ComponentsService,
    private readonly incidentsService: StatusPageIncidentsService,
  ) {}

  // === Status Pages ===

  @Post()
  @ApiOperation({ summary: 'Create a status page' })
  createStatusPage(@Body() dto: CreateStatusPageDto) {
    return this.statusPagesService.create(dto);
  }

  @Get(':id')
  @UseGuards(TeamMemberGuard)
  @TeamResourceDecorator('status-page')
  @ApiOperation({ summary: 'Get status page by ID' })
  getStatusPage(@Param('id') id: string) {
    return this.statusPagesService.findById(Number(id));
  }

  @Get('team/:teamId')
  @ApiOperation({ summary: 'List status pages for a team' })
  listTeamStatusPages(@Param('teamId') teamId: string) {
    return this.statusPagesService.findByTeam(Number(teamId));
  }

  @Patch(':id')
  @UseGuards(TeamMemberGuard)
  @TeamResourceDecorator('status-page')
  @RequireTeamRoles(['admin', 'owner'])
  @ApiOperation({ summary: 'Update status page' })
  updateStatusPage(@Param('id') id: string, @Body() dto: UpdateStatusPageDto) {
    return this.statusPagesService.update(Number(id), dto);
  }

  @Delete(':id')
  @UseGuards(TeamMemberGuard)
  @TeamResourceDecorator('status-page')
  @RequireTeamRoles(['admin', 'owner'])
  @ApiOperation({ summary: 'Delete status page' })
  deleteStatusPage(@Param('id') id: string) {
    return this.statusPagesService.delete(Number(id));
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get overall status for a status page' })
  getOverallStatus(@Param('id') id: string) {
    return this.statusPagesService.getOverallStatus(Number(id));
  }

  // === Components ===

  @Post(':id/components')
  @ApiOperation({ summary: 'Create a component' })
  createComponent(
    @Param('id') statusPageId: string,
    @Body() dto: Omit<CreateComponentDto, 'statusPageId'>,
  ) {
    return this.componentsService.create({
      ...dto,
      statusPageId: Number(statusPageId),
    });
  }

  @Get('components/:componentId')
  @ApiOperation({ summary: 'Get component by ID' })
  getComponent(@Param('componentId') componentId: string) {
    return this.componentsService.findById(Number(componentId));
  }

  @Patch('components/:componentId')
  @ApiOperation({ summary: 'Update component' })
  updateComponent(
    @Param('componentId') componentId: string,
    @Body() dto: UpdateComponentDto,
  ) {
    return this.componentsService.update(Number(componentId), dto);
  }

  @Delete('components/:componentId')
  @ApiOperation({ summary: 'Delete component' })
  deleteComponent(@Param('componentId') componentId: string) {
    return this.componentsService.delete(Number(componentId));
  }

  @Post(':id/components/reorder')
  @ApiOperation({ summary: 'Reorder components' })
  reorderComponents(
    @Param('id') statusPageId: string,
    @Body() dto: { componentIds: number[] },
  ) {
    return this.componentsService.reorder(Number(statusPageId), dto.componentIds);
  }

  // === Incidents ===

  @Post(':id/incidents')
  @ApiOperation({ summary: 'Create a status page incident' })
  createIncident(
    @Param('id') statusPageId: string,
    @Body() dto: Omit<CreateStatusPageIncidentDto, 'statusPageId'>,
  ) {
    return this.incidentsService.createIncident({
      ...dto,
      statusPageId: Number(statusPageId),
    });
  }

  @Get('incidents/:incidentId')
  @ApiOperation({ summary: 'Get incident by ID' })
  getIncident(@Param('incidentId') incidentId: string) {
    return this.incidentsService.findIncidentById(Number(incidentId));
  }

  @Patch('incidents/:incidentId')
  @ApiOperation({ summary: 'Update incident' })
  updateIncident(
    @Param('incidentId') incidentId: string,
    @Body() dto: UpdateStatusPageIncidentDto,
  ) {
    return this.incidentsService.updateIncident(Number(incidentId), dto);
  }

  @Delete('incidents/:incidentId')
  @ApiOperation({ summary: 'Delete incident' })
  deleteIncident(@Param('incidentId') incidentId: string) {
    return this.incidentsService.deleteIncident(Number(incidentId));
  }

  @Post('incidents/:incidentId/updates')
  @ApiOperation({ summary: 'Post an update to an incident' })
  postUpdate(
    @Param('incidentId') incidentId: string,
    @Body() dto: Omit<CreateStatusUpdateDto, 'incidentId'>,
  ) {
    return this.incidentsService.postUpdate({
      ...dto,
      incidentId: Number(incidentId),
    });
  }

  @Post('incidents/:incidentId/resolve')
  @ApiOperation({ summary: 'Resolve an incident' })
  resolveIncident(
    @Param('incidentId') incidentId: string,
    @Body() dto: { message: string },
  ) {
    return this.incidentsService.resolveIncident(Number(incidentId), dto.message);
  }
}

// ============================================
// Public Status Page Endpoints (No Auth)
// ============================================

@ApiTags('public-status')
@Controller('public/status')
export class PublicStatusController {
  constructor(
    private readonly statusPagesService: StatusPagesService,
    private readonly componentsService: ComponentsService,
    private readonly incidentsService: StatusPageIncidentsService,
  ) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Get public status page by slug' })
  async getPublicStatusPage(@Param('slug') slug: string) {
    const statusPage = await this.statusPagesService.findBySlug(slug);
    if (!statusPage || !statusPage.isPublic) {
      return { error: 'Status page not found' };
    }

    const overallStatus = await this.statusPagesService.getOverallStatus(statusPage.id);

    return {
      ...statusPage,
      overallStatus,
    };
  }

  @Get(':slug/components')
  @ApiOperation({ summary: 'Get components for a status page' })
  async getComponents(@Param('slug') slug: string) {
    const statusPage = await this.statusPagesService.findBySlug(slug);
    if (!statusPage || !statusPage.isPublic) {
      return { error: 'Status page not found' };
    }

    return this.componentsService.findByStatusPage(statusPage.id);
  }

  @Get(':slug/incidents')
  @ApiOperation({ summary: 'Get incidents for a status page' })
  async getIncidents(
    @Param('slug') slug: string,
    @Query('includeResolved') includeResolved?: string,
    @Query('limit') limit?: string,
  ) {
    const statusPage = await this.statusPagesService.findBySlug(slug);
    if (!statusPage || !statusPage.isPublic) {
      return { error: 'Status page not found' };
    }

    return this.incidentsService.findByStatusPage(statusPage.id, {
      includeResolved: includeResolved === 'true',
      limit: limit ? Number(limit) : 50,
    });
  }

  @Get(':slug/incidents/:incidentId')
  @ApiOperation({ summary: 'Get incident details (public)' })
  async getIncidentDetails(@Param('slug') slug: string, @Param('incidentId') incidentId: string) {
    const statusPage = await this.statusPagesService.findBySlug(slug);
    if (!statusPage || !statusPage.isPublic) {
      return { error: 'Status page not found' };
    }

    const incident = await this.incidentsService.findIncidentById(Number(incidentId));

    // Verify incident belongs to this status page
    if (incident.statusPageId !== statusPage.id) {
      return { error: 'Incident not found' };
    }

    return incident;
  }
}
