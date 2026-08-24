import { Module } from '@nestjs/common'
import { MembersController } from './members.controller'
import { MembersService } from './members.service'
import { MemberAuthGuard } from '@/auth/auth.guard'
import { AuthModule } from '@/auth/auth.module'
import { UploadModule } from '@/upload/upload.module'

@Module({
  imports: [UploadModule, AuthModule],
  controllers: [MembersController],
  providers: [MembersService, MemberAuthGuard],
  exports: [MembersService],
})
export class MembersModule {}
