import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { User, Team, TeamMember } from '@prisma/client';

export {}; // This ensures the file is treated as a module.

// The 'declare global' is a necessary workaround for sharing the app instance
// in a Jest environment without complex setup. We can ignore the linter warning here.

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace NodeJS {
    interface Global {
      app: INestApplication;
      prisma: PrismaService;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

describe('GraphQL API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let testUser: User;
  let testTeam: Team;
  let testTeamMember: TeamMember;
  let testAccessToken: string;

  beforeAll(async () => {
    // 从全局设置中获取 app 和 prisma 实例
    app = global.app;
    prisma = global.prisma;
    jwtService = app.get<JwtService>(JwtService);

    // 创建测试数据
    testUser = await prisma.user.create({
      data: { email: 'graphql-e2e@test.com' },
    });
    testTeam = await prisma.team.create({ data: { name: 'GraphQL E2E Team' } });
    testTeamMember = await prisma.teamMember.create({
      data: { userId: testUser.id, teamId: testTeam.id },
    });

    // 创建 JWT
    testAccessToken = jwtService.sign({
      sub: testUser.id,
      email: testUser.email,
      teamMemberId: testTeamMember.id,
    });
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.teamMember.deleteMany({});
    await prisma.team.deleteMany({});
    await prisma.user.deleteMany({});
  });

  // 测试一个简单的根查询
  it('should return current user for "me" query', () => {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${testAccessToken}`)
      .send({
        query: `
          query GetMe {
            me {
              id
              email
            }
          }
        `,
      })
      .expect(200)
      .then((res) => {
        expect(res.body.data.me.id).toBe(testUser.id);
        expect(res.body.data.me.email).toBe(testUser.email);
      });
  });

  // 测试一个需要字段解析器的复杂查询
  it('should resolve team members for "myWorkspaces" query', async () => {
    // 创建一个与团队关联的工作空间
    await prisma.workspace.create({
      data: {
        name: 'GraphQL Test Workspace',
        type: 'TEAM',
        teamId: testTeam.id,
      },
    });

    return request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${testAccessToken}`)
      .send({
        query: `
          query GetMyWorkspaces {
            myWorkspaces {
              id
              name
              team {
                id
                name
                members {
                  id
                  role
                }
              }
            }
          }
        `,
      })
      .expect(200)
      .then((res) => {
        const workspaces = res.body.data.myWorkspaces;
        expect(workspaces.length).toBeGreaterThan(0);
        expect(workspaces[0].team.id).toBe(testTeam.id);
        expect(workspaces[0].team.members[0].id).toBe(testTeamMember.id);
      });
  });
});
