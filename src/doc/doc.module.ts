import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { DocController } from './doc.controller';
import { DocService } from './doc.service';

@Module({
  imports: [PrismaModule, AuthModule, CommonModule],
  controllers: [DocController],
  providers: [DocService],
  exports: [DocService],
})
export class DocModule {}
