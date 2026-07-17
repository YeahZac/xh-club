import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { MembersModule } from './members/members.module'
import { EventsModule } from './events/events.module'
import { TransactionsModule } from './transactions/transactions.module'
import { CommunityModule } from './community/community.module'
import { MessagesModule } from './messages/messages.module'
import { AdminModule } from './admin/admin.module'
import { MallModule } from './mall/mall.module'
import { UploadModule } from './upload/upload.module'
import { ArticlesModule } from './articles/articles.module'
import { AuthModule } from './auth/auth.module'
import { BannersModule } from './banners/banners.module'
import { EventRegistrationModule } from './event-registration/event-registration.module'
import { HomepageModule } from './homepage/homepage.module'
import { BusinessModule } from './business/business.module'
import { TalentModule } from './talent/talent.module'
import { InvitationModule } from './invitation/invitation.module'
import { PointsModule } from './points/points.module'
import { DealApplicationsModule } from './deal-applications/deal-applications.module'

@Module({
  imports: [
    MembersModule,
    EventsModule,
    TransactionsModule,
    CommunityModule,
    MessagesModule,
    AdminModule,
    MallModule,
    UploadModule,
    ArticlesModule,
    AuthModule,
    BannersModule,
    EventRegistrationModule,
    HomepageModule,
    BusinessModule,
    TalentModule,
    InvitationModule,
    PointsModule,
    DealApplicationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
