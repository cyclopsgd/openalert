import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('metrics')
@Controller('metrics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard metrics' })
  async getDashboardMetrics() {
    return this.metricsService.getDashboardMetrics();
  }

  @Get('incidents/trends')
  @ApiOperation({ summary: 'Get incident trends over time' })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days (default: 30)',
  })
  async getIncidentTrends(@Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number) {
    // Limit to reasonable range
    const validDays = Math.min(Math.max(days, 1), 90);
    return this.metricsService.getIncidentTrends(validDays);
  }

  @Get('incidents/response-times')
  @ApiOperation({ summary: 'Get response time distribution' })
  async getResponseTimes() {
    return this.metricsService.getResponseTimes();
  }
}
