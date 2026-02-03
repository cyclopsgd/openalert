import { Controller, Get, Put, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SystemSettingsService } from './system-settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { UpdateSSOConfigDto } from './dto/update-sso-config.dto';
import { UpdateGeneralSettingsDto } from './dto/update-general-settings.dto';

@ApiTags('system-settings')
@Controller('system-settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SystemSettingsController {
  constructor(private readonly settingsService: SystemSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all system settings' })
  async getAll() {
    return this.settingsService.getAll();
  }

  @Get('sso')
  @ApiOperation({ summary: 'Get SSO configuration' })
  async getSSOConfig() {
    return this.settingsService.getSSOConfig();
  }

  @Put('sso')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update SSO configuration' })
  async updateSSOConfig(@Body() dto: UpdateSSOConfigDto) {
    return this.settingsService.updateSSOConfig(dto);
  }

  @Get('general')
  @ApiOperation({ summary: 'Get general settings' })
  async getGeneralSettings() {
    return this.settingsService.getGeneralSettings();
  }

  @Put('general')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update general settings' })
  async updateGeneralSettings(@Body() dto: UpdateGeneralSettingsDto) {
    return this.settingsService.updateGeneralSettings(dto);
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a single setting by key' })
  async getByKey(@Param('key') key: string) {
    return this.settingsService.getByKey(key);
  }

  @Put(':key')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update a setting' })
  async updateSetting(@Param('key') key: string, @Body() dto: UpdateSettingDto) {
    return this.settingsService.set(key, dto.value, dto.description);
  }
}
