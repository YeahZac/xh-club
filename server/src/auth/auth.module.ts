import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { MemberAuthGuard } from './auth.guard'
import { PointsModule } from '@/points/points.module'
import { InvitationModule } from '@/invitation/invitation.module'

@Module({
  imports: [PointsModule, InvitationModule],
  controllers: [AuthController],
  providers: [AuthService, MemberAuthGuard],
  exports: [AuthService],
})
export class AuthModule {}
