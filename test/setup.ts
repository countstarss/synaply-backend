import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

let app: INestApplication;

// 全局清理数据库的函数
async function cleanDatabase(prisma: PrismaService) {
  // 从依赖最深的表开始删除
  await prisma.issueDependency.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.issueActivity.deleteMany({});
  await prisma.issue.deleteMany({});
  await prisma.workflowStep.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.chatMember.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.chat.deleteMany({});
  await prisma.teamMember.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.user.deleteMany({});
}

global.beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  await app.init();

  const prisma = app.get(PrismaService);
  await cleanDatabase(prisma);

  // 将 app 实例暴露给所有测试文件
  global.app = app;
  global.prisma = prisma;
});

global.afterAll(async () => {
  await app.close();
});
