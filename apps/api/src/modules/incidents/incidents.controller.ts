import { Controller, Get, Param, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IncidentsService } from './incidents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TeamMemberGuard } from '../../common/guards/team-member.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { TeamResourceDecorator } from '../../common/decorators/team-resource.decorator';
import { ListIncidentsDto } from './dto/list-incidents.dto';
import { AcknowledgeIncidentDto } from './dto/acknowledge-incident.dto';
import { ResolveIncidentDto } from './dto/resolve-incident.dto';

@ApiTags('incidents')
@Controller('incidents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @ApiOperation({ summary: 'List incidents' })
  @ApiQuery({ type: ListIncidentsDto })
  async list(@Query() query: ListIncidentsDto) {
    return this.incidentsService.list({
      status: query.status,
      serviceId: query.serviceId,
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
}
