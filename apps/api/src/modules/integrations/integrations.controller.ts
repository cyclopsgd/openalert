import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateIntegrationDto } from './dto/create-integration.dto';
import { UpdateIntegrationDto } from './dto/update-integration.dto';

@ApiTags('integrations')
@Controller('integrations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all integrations' })
  async list() {
    return this.integrationsService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get integration by ID' })
  async findById(@Param('id') id: string) {
    return this.integrationsService.findById(Number(id));
  }

  @Post()
  @ApiOperation({ summary: 'Create a new integration' })
  async create(@Body() dto: CreateIntegrationDto) {
    return this.integrationsService.create(dto);
  }

  @Put(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update an integration' })
  async update(@Param('id') id: string, @Body() dto: UpdateIntegrationDto) {
    return this.integrationsService.update(Number(id), dto);
  }

  @Post(':id/regenerate-key')
  @HttpCode(200)
  @ApiOperation({ summary: 'Regenerate integration key' })
  async regenerateKey(@Param('id') id: string) {
    return this.integrationsService.regenerateKey(Number(id));
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an integration' })
  async delete(@Param('id') id: string) {
    await this.integrationsService.delete(Number(id));
  }

  @Get(':id/webhook-logs')
  @ApiOperation({ summary: 'Get webhook logs for an integration' })
  async getWebhookLogs(@Param('id') id: string) {
    const integration = await this.integrationsService.findById(Number(id));
    return this.integrationsService.getWebhookLogs(integration.integrationKey);
  }
}
