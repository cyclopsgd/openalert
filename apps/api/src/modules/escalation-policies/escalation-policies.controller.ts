import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { EscalationPoliciesService } from './escalation-policies.service';
import { CreateEscalationPolicyDto } from './dto/create-escalation-policy.dto';
import { UpdateEscalationPolicyDto } from './dto/update-escalation-policy.dto';

@ApiTags('escalation-policies')
@Controller('escalation-policies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EscalationPoliciesController {
  constructor(private readonly escalationPoliciesService: EscalationPoliciesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new escalation policy' })
  create(@Body() dto: CreateEscalationPolicyDto) {
    return this.escalationPoliciesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all escalation policies' })
  findAll() {
    return this.escalationPoliciesService.findAll();
  }

  @Get('team/:teamId')
  @ApiOperation({ summary: 'List escalation policies for a team' })
  findByTeam(@Param('teamId') teamId: string) {
    return this.escalationPoliciesService.findByTeam(Number(teamId));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get escalation policy by ID' })
  findOne(@Param('id') id: string) {
    return this.escalationPoliciesService.findById(Number(id));
  }

  @Get(':id/path')
  @ApiOperation({ summary: 'Get escalation path for a policy' })
  getPath(@Param('id') id: string) {
    return this.escalationPoliciesService.getEscalationPath(Number(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update escalation policy' })
  update(@Param('id') id: string, @Body() dto: UpdateEscalationPolicyDto) {
    return this.escalationPoliciesService.update(Number(id), dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete escalation policy' })
  remove(@Param('id') id: string) {
    return this.escalationPoliciesService.delete(Number(id));
  }
}
