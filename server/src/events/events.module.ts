import { Module } from '@nestjs/common'
import { EventsController, ProjectsController, ResourcesController } from './events.controller'
import { EventsService } from './events.service'
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard'
import { UploadModule } from '@/upload/upload.module'
import { PointsModule } from '@/points/points.module'

@Module({
  imports: [UploadModule, PointsModule],
  controllers: [EventsController, ProjectsController, ResourcesController],
  providers: [EventsService, AdminAuthGuard, MemberAuthGuard],
})
export class EventsModule {}
