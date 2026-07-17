import { Module } from '@nestjs/common'
import { AdminModule } from '@/admin/admin.module'
import { AdminAuthGuard, MemberAuthGuard } from '@/auth/auth.guard'
import {
  AdminMemberInvitationController,
  InvitationController,
} from './invitation.controller'
import { InvitationEngineService } from './invitation-engine.service'
import { MemberInvitationService } from './member-invitation.service'

@Module({
  imports: [AdminModule],
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
