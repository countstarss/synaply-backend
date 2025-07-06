import { Module } from '@nestjs/common';
import { TeamMemberService } from './services/team-member.service';
import { PermissionService } from './services/permission.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [TeamMemberService, PermissionService],
  exports: [TeamMemberService, PermissionService],
})
export class CommonModule {}
