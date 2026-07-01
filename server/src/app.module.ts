import { Module } from '@nestjs/common';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { EventRegistrationModule } from '@/event-registration/event-registration.module';

@Module({
  imports: [EventRegistrationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
