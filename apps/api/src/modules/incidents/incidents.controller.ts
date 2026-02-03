import { Controller, Get, Param, Patch, Body, Query, UseGuards, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IncidentsService } from './incidents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TeamMemberGuard } from '../../common/guards/team-member.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { TeamResourceDecorator } from '../../common/decorators/team-resource.decorator';
import { ListIncidentsDto } from './dto/list-incidents.dto';
import { AcknowledgeIncidentDto } from './dto/acknowledge-incident.dto';
import { ResolveIncidentDto } from './dto/resolve-incident.dto';
import { BulkAcknowledgeDto } from './dto/bulk-acknowledge.dto';
import { BulkResolveDto } from './dto/bulk-resolve.dto';

@ApiTags('incidents')
@Controller('incidents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @ApiOperation({ summary: 'List incidents with advanced filtering' })
  @ApiQuery({ type: ListIncidentsDto })
  async list(@Query() query: ListIncidentsDto) {
    return this.incidentsService.list({
      status: query.status,
      severity: query.severity,
      serviceId: query.serviceId,
      assigneeId: query.assigneeId,
      search: query.search,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      sortBy: query.sortBy,
      limit: query.limit || 50,
      offset: query.offset || 0,
    });
  }

  @Get(':id')
  @UseGuards(TeamMemberGuard)
  @TeamResourceDecorator('incident')
  @ApiOperation({ summary: 'Get incident by ID' })
  async findById(@Param('id') id: string) {
    return this.incidentsService.findById(Number(id));
  }

  @Patch(':id/acknowledge')
  @UseGuards(TeamMemberGuard)
  @TeamResourceDecorator('incident')
  @ApiOperation({ summary: 'Acknowledge an incident' })
  async acknowledge(
    @Param('id') id: string,
    @Body() dto: AcknowledgeIncidentDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.incidentsService.acknowledge(Number(id), user.id);
  }

  @Patch(':id/resolve')
  @UseGuards(TeamMemberGuard)
  @TeamResourceDecorator('incident')
  @ApiOperation({ summary: 'Resolve an incident' })
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolveIncidentDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.incidentsService.resolve(Number(id), user.id);
  }

  @Post('bulk/acknowledge')
  @ApiOperation({ summary: 'Bulk acknowledge multiple incidents' })
  async bulkAcknowledge(
    @Body() dto: BulkAcknowledgeDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.incidentsService.bulkAcknowledge(dto.incidentIds, user.id);
  }

  @Post('bulk/resolve')
  @ApiOperation({ summary: 'Bulk resolve multiple incidents' })
  async bulkResolve(
    @Body() dto: BulkResolveDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.incidentsService.bulkResolve(dto.incidentIds, user.id);
  }
}
