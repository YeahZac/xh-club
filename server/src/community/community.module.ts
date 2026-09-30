import { Module } from '@nestjs/common'
import { CommunityController } from './community.controller'
import { CommunityService } from './community.service'
import { MemberAuthGuard } from '@/auth/auth.guard'
import { PointsModule } from '@/points/points.module'
import { InvitationModule } from '@/invitation/invitation.module'
import { WechatModule } from '@/wechat/wechat.module'

@Module({
  imports: [PointsModule, InvitationModule, WechatModule],
  controllers: [CommunityController],
  providers: [CommunityService, MemberAuthGuard],
})
export class CommunityModule {}
