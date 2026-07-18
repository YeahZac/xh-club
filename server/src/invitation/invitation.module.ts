import { Module } from '@nestjs/common'
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard'
import { UploadModule } from '@/upload/upload.module'
import {
  AdminMemberInvitationController,
  InvitationController,
} from './invitation.controller'
import { InvitationEngineService } from './invitation-engine.service'
import { MemberInvitationService } from './member-invitation.service'

@Module({
  imports: [UploadModule],
  controllers: [InvitationController, AdminMemberInvitationController],
  providers: [
    InvitationEngineService,
    MemberInvitationService,
    MemberAuthGuard,
    AdminAuthGuard,
  ],
  exports: [InvitationEngineService, MemberInvitationService],
})
export class InvitationModule {}
