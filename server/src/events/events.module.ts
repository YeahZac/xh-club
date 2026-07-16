import { Module } from '@nestjs/common'
import { EventsController, ProjectsController, ResourcesController } from './events.controller'
import { EventsService } from './events.service'
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard'
import { UploadModule } from '@/upload/upload.module'

@Module({
  imports: [UploadModule],
  controllers: [EventsController, ProjectsController, ResourcesController],
  providers: [EventsService, AdminAuthGuard, MemberAuthGuard],
})
export class EventsModule {}
