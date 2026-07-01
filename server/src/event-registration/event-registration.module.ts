import { Module } from '@nestjs/common';
import { EventRegistrationController } from './event-registration.controller';
import { EventRegistrationService } from './event-registration.service';

@Module({
  controllers: [EventRegistrationController],
  providers: [EventRegistrationService],
})
export class EventRegistrationModule {}
