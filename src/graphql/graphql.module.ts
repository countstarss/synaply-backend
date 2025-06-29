import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { QueryResolver } from './resolvers/query.resolver';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [QueryResolver],
})
export class GraphqlModule {}
