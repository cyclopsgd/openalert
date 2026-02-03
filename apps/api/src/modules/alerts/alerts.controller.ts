import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  HttpCode,
  Logger,
  Get,
  Query,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AlertsService } from './alerts.service';
import { WebhookTransformerService } from './webhook-transformer.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('webhooks')
@Controller('webhooks')
@Throttle({ default: { ttl: 60000, limit: 100 } }) // 100 webhooks per minute per integration key
export class AlertsController {
  private readonly logger = new Logger(AlertsController.name);

  constructor(
    private readonly alertsService: AlertsService,
    private readonly transformer: WebhookTransformerService,
  ) {}

  @Post('v1/:integrationKey')
  @HttpCode(202)
  @ApiOperation({ summary: 'Receive webhook from any monitoring system' })
  @ApiResponse({ status: 202, description: 'Webhook accepted for processing' })
  async receiveWebhook(
    @Param('integrationKey') integrationKey: string,
    @Body() payload: any,
    @Headers('content-type') contentType: string,
    @Headers('user-agent') userAgent: string,
  ) {
    this.logger.log(`Received webhook for integration: ${integrationKey}`);
    this.logger.debug(`User-Agent: ${userAgent}`);

    // Detect source and transform to standard format
    const alerts = this.transformer.transform(payload, userAgent);

    // Ingest each alert
    const results = await Promise.all(
      alerts.map((alert) => this.alertsService.ingestAlert(integrationKey, alert)),
    );

    return {
      status: 'accepted',
      alertsProcessed: results.length,
      alertIds: results.map((a) => a.id),
    };
  }

  @Post('prometheus/:integrationKey')
  @HttpCode(202)
  @ApiOperation({ summary: 'Receive webhook from Prometheus Alertmanager' })
  async receivePrometheus(@Param('integrationKey') integrationKey: string, @Body() payload: any) {
    this.logger.log(`Received Prometheus webhook for integration: ${integrationKey}`);

    const alerts = this.transformer.transformPrometheus(payload);
    const results = await Promise.all(
      alerts.map((alert) => this.alertsService.ingestAlert(integrationKey, alert)),
    );

    return { status: 'accepted', alertsProcessed: results.length };
  }

  @Post('grafana/:integrationKey')
  @HttpCode(202)
  @ApiOperation({ summary: 'Receive webhook from Grafana Alerting' })
  async receiveGrafana(@Param('integrationKey') integrationKey: string, @Body() payload: any) {
    this.logger.log(`Received Grafana webhook for integration: ${integrationKey}`);

    const alerts = this.transformer.transformGrafana(payload);
    const results = await Promise.all(
      alerts.map((alert) => this.alertsService.ingestAlert(integrationKey, alert)),
    );

    return { status: 'accepted', alertsProcessed: results.length };
  }

  @Post('azure/:integrationKey')
  @HttpCode(202)
  @ApiOperation({ summary: 'Receive webhook from Azure Monitor' })
  async receiveAzure(@Param('integrationKey') integrationKey: string, @Body() payload: any) {
    this.logger.log(`Received Azure Monitor webhook for integration: ${integrationKey}`);

    const alerts = this.transformer.transformAzureMonitor(payload);
    const results = await Promise.all(
      alerts.map((alert) => this.alertsService.ingestAlert(integrationKey, alert)),
    );

    return { status: 'accepted', alertsProcessed: results.length };
  }

  @Post('datadog/:integrationKey')
  @HttpCode(202)
  @ApiOperation({ summary: 'Receive webhook from Datadog' })
  async receiveDatadog(@Param('integrationKey') integrationKey: string, @Body() payload: any) {
    this.logger.log(`Received Datadog webhook for integration: ${integrationKey}`);

    const alerts = this.transformer.transformDatadog(payload);
    const results = await Promise.all(
      alerts.map((alert) => this.alertsService.ingestAlert(integrationKey, alert)),
    );

    return { status: 'accepted', alertsProcessed: results.length };
  }
}

@ApiTags('alerts')
@Controller('alerts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AlertsManagementController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'List alerts' })
  async list(
    @Query('status') status?: 'firing' | 'acknowledged' | 'resolved' | 'suppressed',
    @Query('incidentId') incidentId?: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.alertsService.list({
      status,
      incidentId: incidentId ? Number(incidentId) : undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get alert by ID' })
  async findById(@Param('id') id: string) {
    return this.alertsService.findById(Number(id));
  }

  @Patch(':id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge an alert' })
  async acknowledge(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.alertsService.acknowledge(Number(id), user.id);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Resolve an alert' })
  async resolve(@Param('id') id: string) {
    return this.alertsService.resolve(Number(id));
  }
}
