import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { AddDependencyDto } from './dto/add-dependency.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('services')
@UseGuards(JwtAuthGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  create(@Body() createServiceDto: CreateServiceDto) {
    return this.servicesService.create(createServiceDto);
  }

  @Get()
  findAll(@Query('teamId') teamId?: string) {
    const parsedTeamId = teamId ? parseInt(teamId, 10) : undefined;
    return this.servicesService.findAll(parsedTeamId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.servicesService.findOne(id);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateServiceDto: UpdateServiceDto) {
    return this.servicesService.update(id, updateServiceDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.servicesService.remove(id);
  }

  @Post(':id/dependencies')
  addDependency(
    @Param('id', ParseIntPipe) id: number,
    @Body() addDependencyDto: AddDependencyDto,
  ) {
    return this.servicesService.addDependency(id, addDependencyDto.dependsOnServiceId);
  }

  @Delete(':id/dependencies/:dependencyId')
  removeDependency(
    @Param('id', ParseIntPipe) id: number,
    @Param('dependencyId', ParseIntPipe) dependencyId: number,
  ) {
    return this.servicesService.removeDependency(id, dependencyId);
  }

  @Get(':id/health')
  getHealth(@Param('id', ParseIntPipe) id: number) {
    return this.servicesService.getHealth(id);
  }

  @Get(':id/dependency-graph')
  getDependencyGraph(@Param('id', ParseIntPipe) id: number) {
    return this.servicesService.getDependencyGraph(id);
  }
}
