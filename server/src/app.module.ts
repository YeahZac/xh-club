import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { MembersModule } from './members/members.module'
import { EventsModule } from './events/events.module'
import { TransactionsModule } from './transactions/transactions.module'
import { CommunityModule } from './community/community.module'
import { MessagesModule } from './messages/messages.module'
import { AdminModule } from './admin/admin.module'

@Module({
  imports: [
    MembersModule,
    EventsModule,
    TransactionsModule,
    CommunityModule,
    MessagesModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
