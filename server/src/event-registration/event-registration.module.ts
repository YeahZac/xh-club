import { Module } from '@nestjs/common';
import { EventRegistrationController } from './event-registration.controller';
import { EventRegistrationService } from './event-registration.service';
import { AdminAuthGuard } from '@/auth/auth.guard';

@Module({
  controllers: [EventRegistrationController],
  providers: [EventRegistrationService, AdminAuthGuard],
})
export class EventRegistrationModule {}
