import { Controller, Get, Param, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IncidentsService } from './incidents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TeamMemberGuard } from '../../common/guards/team-member.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { TeamResourceDecorator } from '../../common/decorators/team-resource.decorator';

@ApiTags('incidents')
@Controller('incidents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @ApiOperation({ summary: 'List incidents' })
  async list(
    @Query('status') status?: 'triggered' | 'acknowledged' | 'resolved',
    @Query('serviceId') serviceId?: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.incidentsService.list({
      status,
      serviceId: serviceId ? Number(serviceId) : undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
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
  async acknowledge(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.incidentsService.acknowledge(Number(id), user.id);
  }

  @Patch(':id/resolve')
  @UseGuards(TeamMemberGuard)
  @TeamResourceDecorator('incident')
  @ApiOperation({ summary: 'Resolve an incident' })
  async resolve(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.incidentsService.resolve(Number(id), user.id);
  }
}
