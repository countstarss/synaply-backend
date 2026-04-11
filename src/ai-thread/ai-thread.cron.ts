import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AiThreadService } from './ai-thread.service';

@Injectable()
export class AiThreadCron {
  private readonly logger = new Logger(AiThreadCron.name);

  constructor(private readonly aiThreadService: AiThreadService) {}

  @Cron('*/10 * * * *')
  async sweepExpiredApprovals() {
    try {
      const expiredCount = await this.aiThreadService.sweepExpiredApprovals();

      if (expiredCount > 0) {
        this.logger.log(`Swept ${expiredCount} expired AI approvals`);
      }
    } catch (error) {
      this.logger.error('Failed to sweep expired AI approvals', error);
    }
  }
}
