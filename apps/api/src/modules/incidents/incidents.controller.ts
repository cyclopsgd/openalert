import { Controller, Get, Param, Patch, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IncidentsService } from './incidents.service';

@ApiTags('incidents')
@Controller('incidents')
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
  @ApiOperation({ summary: 'Get incident by ID' })
  async findById(@Param('id') id: string) {
    return this.incidentsService.findById(Number(id));
  }

  @Patch(':id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge an incident' })
  async acknowledge(@Param('id') id: string, @Body('userId') userId: number) {
    return this.incidentsService.acknowledge(Number(id), userId);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Resolve an incident' })
  async resolve(@Param('id') id: string, @Body('userId') userId: number) {
    return this.incidentsService.resolve(Number(id), userId);
  }
}
