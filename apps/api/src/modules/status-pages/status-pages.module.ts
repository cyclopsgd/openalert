import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import {
  StatusPagesManagementController,
  PublicStatusController,
} from './status-pages.controller';
import { StatusPagesService } from './status-pages.service';
import { ComponentsService } from './components.service';
import { StatusPageIncidentsService } from './incidents.service';

@Module({
  imports: [DatabaseModule],
  controllers: [StatusPagesManagementController, PublicStatusController],
  providers: [StatusPagesService, ComponentsService, StatusPageIncidentsService],
  exports: [StatusPagesService, ComponentsService, StatusPageIncidentsService],
})
export class StatusPagesModule {}
