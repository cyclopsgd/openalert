import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users with filters' })
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
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results per page' })
  @ApiQuery({ name: 'offset', required: false, description: 'Offset for pagination' })
  async list(
    @Query('authProvider') authProvider?: string,
    @Query('isActive') isActive?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.usersService.list({
      authProvider,
      isActive: isActive ? isActive === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  async getById(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findById(id);
  }

  @Patch(':id/activate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Activate a user' })
  async activate(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.activate(id);
  }

  @Patch(':id/deactivate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Deactivate a user' })
  async deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.deactivate(id);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reset password for a local user (sends reset email)' })
  async resetPassword(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.initiatePasswordReset(id);
  }
}
