import { Module } from '@nestjs/common'
import { EventsController, ProjectsController, ResourcesController } from './events.controller'
import { EventsService } from './events.service'

@Module({
  controllers: [EventsController, ProjectsController, ResourcesController],
  providers: [EventsService],
})
export class EventsModule {}
