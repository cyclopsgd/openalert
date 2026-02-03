import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users with filters' })
  @RequireRole('superadmin', 'admin')
  @ApiQuery({
    name: 'authProvider',
    required: false,
    description: 'Filter by auth provider (local, azure_ad)',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    description: 'Filter by active status (true/false)',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    description: 'Filter by role (superadmin, admin, responder, observer)',
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results per page' })
  @ApiQuery({ name: 'offset', required: false, description: 'Offset for pagination' })
  async list(
    @Query('authProvider') authProvider?: string,
    @Query('isActive') isActive?: string,
    @Query('role') role?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.usersService.list({
      authProvider,
      isActive: isActive ? isActive === 'true' : undefined,
      role,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @RequireRole('superadmin', 'admin')
  async getById(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findById(id);
  }

  @Get(':id/teams')
  @ApiOperation({ summary: 'Get user team memberships' })
  @RequireRole('superadmin', 'admin')
  async getUserTeams(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUserTeams(id);
  }

  @Patch(':id/role')
  @HttpCode(200)
  @ApiOperation({ summary: 'Change user role (superadmin only)' })
  @RequireRole('superadmin')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          enum: ['superadmin', 'admin', 'responder', 'observer'],
        },
      },
    },
  })
  async changeRole(
    @Param('id', ParseIntPipe) id: number,
    @Body('role') role: string,
    @CurrentUser() currentUser: CurrentUserData,
  ) {
    return this.usersService.changeRole(id, role, currentUser.id);
  }

  @Patch(':id/activate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Activate a user' })
  @RequireRole('superadmin', 'admin')
  async activate(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.activate(id);
  }

  @Patch(':id/deactivate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Deactivate a user' })
  @RequireRole('superadmin', 'admin')
  async deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.deactivate(id);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reset password for a local user (sends reset email)' })
  @RequireRole('superadmin', 'admin')
  async resetPassword(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.initiatePasswordReset(id);
  }
}
