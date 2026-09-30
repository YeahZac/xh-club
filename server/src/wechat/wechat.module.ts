import { Module } from '@nestjs/common'
import { WechatSecurityService } from './wechat-security.service'

@Module({
  providers: [WechatSecurityService],
  exports: [WechatSecurityService],
})
export class WechatModule {}
