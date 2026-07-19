import { Module } from '@nestjs/common'
import { MembersController } from './members.controller'
import { MembersService } from './members.service'
import { MemberAuthGuard } from '@/auth/auth.guard'
import { UploadModule } from '@/upload/upload.module'

@Module({
  imports: [UploadModule],
  controllers: [MembersController],
  providers: [MembersService, MemberAuthGuard],
  exports: [MembersService],
})
export class MembersModule {}
