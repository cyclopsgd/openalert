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
import { SchedulesService, CreateScheduleDto, UpdateScheduleDto } from './schedules.service';
import { RotationsService, CreateRotationDto, UpdateRotationDto } from './rotations.service';
import { OverridesService, CreateOverrideDto, UpdateOverrideDto } from './overrides.service';
import { OnCallResolverService } from './oncall-resolver.service';

@ApiTags('schedules')
@Controller('schedules')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SchedulesController {
  constructor(
    private readonly schedulesService: SchedulesService,
    private readonly rotationsService: RotationsService,
    private readonly overridesService: OverridesService,
    private readonly onCallResolver: OnCallResolverService,
  ) {}

  // === Schedules ===

  @Post()
  @ApiOperation({ summary: 'Create a new on-call schedule' })
  createSchedule(@Body() dto: CreateScheduleDto) {
    return this.schedulesService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get schedule by ID' })
  getSchedule(@Param('id') id: string) {
    return this.schedulesService.findById(Number(id));
  }

  @Get('team/:teamId')
  @ApiOperation({ summary: 'List schedules for a team' })
  listTeamSchedules(@Param('teamId') teamId: string) {
    return this.schedulesService.findByTeam(Number(teamId));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update schedule' })
  updateSchedule(@Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    return this.schedulesService.update(Number(id), dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete schedule' })
  deleteSchedule(@Param('id') id: string) {
    return this.schedulesService.delete(Number(id));
  }

  // === On-Call Resolution ===

  @Get(':id/oncall')
  @ApiOperation({ summary: 'Get who is currently on call for this schedule' })
  getOnCall(
    @Param('id') id: string,
    @Query('at') at?: string, // ISO 8601 datetime
  ) {
    const atDate = at ? new Date(at) : new Date();
    return this.onCallResolver.resolveOnCall(Number(id), atDate);
  }

  // === Rotations ===

  @Post(':id/rotations')
  @ApiOperation({ summary: 'Create a rotation for a schedule' })
  createRotation(@Param('id') scheduleId: string, @Body() dto: Omit<CreateRotationDto, 'scheduleId'>) {
    return this.rotationsService.create({
      ...dto,
      scheduleId: Number(scheduleId),
    });
  }

  @Get('rotations/:rotationId')
  @ApiOperation({ summary: 'Get rotation by ID' })
  getRotation(@Param('rotationId') rotationId: string) {
    return this.rotationsService.findById(Number(rotationId));
  }

  @Patch('rotations/:rotationId')
  @ApiOperation({ summary: 'Update rotation' })
  updateRotation(@Param('rotationId') rotationId: string, @Body() dto: UpdateRotationDto) {
    return this.rotationsService.update(Number(rotationId), dto);
  }

  @Delete('rotations/:rotationId')
  @ApiOperation({ summary: 'Delete rotation' })
  deleteRotation(@Param('rotationId') rotationId: string) {
    return this.rotationsService.delete(Number(rotationId));
  }

  @Patch('rotations/:rotationId/members')
  @ApiOperation({ summary: 'Update rotation members and order' })
  updateRotationMembers(
    @Param('rotationId') rotationId: string,
    @Body() dto: { userIds: number[] },
  ) {
    return this.rotationsService.updateMembers(Number(rotationId), dto.userIds);
  }

  @Post('rotations/:rotationId/members')
  @ApiOperation({ summary: 'Add a member to rotation' })
  addRotationMember(
    @Param('rotationId') rotationId: string,
    @Body() dto: { userId: number },
  ) {
    return this.rotationsService.addMember(Number(rotationId), dto.userId);
  }

  @Delete('rotations/:rotationId/members/:userId')
  @ApiOperation({ summary: 'Remove a member from rotation' })
  removeRotationMember(
    @Param('rotationId') rotationId: string,
    @Param('userId') userId: string,
  ) {
    return this.rotationsService.removeMember(Number(rotationId), Number(userId));
  }

  // === Overrides ===

  @Post(':id/overrides')
  @ApiOperation({ summary: 'Create a schedule override' })
  createOverride(
    @Param('id') scheduleId: string,
    @Body() dto: Omit<CreateOverrideDto, 'scheduleId'>,
  ) {
    return this.overridesService.create({
      ...dto,
      scheduleId: Number(scheduleId),
    });
  }

  @Get(':id/overrides')
  @ApiOperation({ summary: 'List overrides for a schedule' })
  listOverrides(
    @Param('id') scheduleId: string,
    @Query('includePast') includePast?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.overridesService.findBySchedule(Number(scheduleId), {
      includePast: includePast === 'true',
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('overrides/:overrideId')
  @ApiOperation({ summary: 'Get override by ID' })
  getOverride(@Param('overrideId') overrideId: string) {
    return this.overridesService.findById(Number(overrideId));
  }

  @Patch('overrides/:overrideId')
  @ApiOperation({ summary: 'Update override' })
  updateOverride(@Param('overrideId') overrideId: string, @Body() dto: UpdateOverrideDto) {
    return this.overridesService.update(Number(overrideId), dto);
  }

  @Delete('overrides/:overrideId')
  @ApiOperation({ summary: 'Delete override' })
  deleteOverride(@Param('overrideId') overrideId: string) {
    return this.overridesService.delete(Number(overrideId));
  }
}
