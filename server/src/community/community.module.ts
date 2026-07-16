import { Module } from '@nestjs/common'
import { CommunityController } from './community.controller'
import { CommunityService } from './community.service'
import { MemberAuthGuard } from '@/auth/auth.guard'

@Module({
  controllers: [CommunityController],
  providers: [CommunityService, MemberAuthGuard],
})
export class CommunityModule {}
