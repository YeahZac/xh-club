import { Module } from '@nestjs/common'
import { EventsController, ProjectsController, ResourcesController } from './events.controller'
import { EventsService } from './events.service'
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard'
import { UploadModule } from '@/upload/upload.module'
import { PointsModule } from '@/points/points.module'
import { InvitationModule } from '@/invitation/invitation.module'
import { TalentModule } from '@/talent/talent.module'

@Module({
  imports: [UploadModule, PointsModule, InvitationModule, TalentModule],
  controllers: [EventsController, ProjectsController, ResourcesController],
  providers: [EventsService, AdminAuthGuard, MemberAuthGuard],
})
export class EventsModule {}
