import { Module } from '@nestjs/common'
import { AdminModule } from '@/admin/admin.module'
import { InvitationController } from './invitation.controller'

@Module({
  imports: [AdminModule],
  controllers: [InvitationController],
})
export class InvitationModule {}
