import { Module } from '@nestjs/common'
import { AdminModule } from '@/admin/admin.module'
import { InvitationController } from './invitation.controller'
import { InvitationEngineService } from './invitation-engine.service'

@Module({
  imports: [AdminModule],
  controllers: [InvitationController],
  providers: [InvitationEngineService],
  exports: [InvitationEngineService],
})
export class InvitationModule {}
