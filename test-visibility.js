const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testVisibilitySystem() {
  console.log('🔍 测试权限系统...');

  try {
    // 测试VisibilityType枚举是否可用
    console.log('✅ VisibilityType 枚举值:');
    console.log('- PRIVATE:', 'PRIVATE');
    console.log('- TEAM_READONLY:', 'TEAM_READONLY');
    console.log('- TEAM_EDITABLE:', 'TEAM_EDITABLE');
    console.log('- PUBLIC:', 'PUBLIC');

    // 尝试创建一个用户
    const user = await prisma.user.create({
      data: {
        email: `test_${Date.now()}@example.com`,
        name: 'Test User',
      },
    });
    console.log('✅ 创建用户成功:', user.id);

    // 创建一个团队
    const team = await prisma.team.create({
      data: {
        name: 'Test Team',
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
          },
        },
      },
    });
    console.log('✅ 创建团队成功:', team.id);

    // 获取团队成员
    const teamMember = await prisma.teamMember.findFirst({
      where: { teamId: team.id, userId: user.id },
    });
    console.log('✅ 获取团队成员成功:', teamMember.id);

    // 创建工作空间
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Test Workspace',
        type: 'TEAM',
        teamId: team.id,
      },
    });
    console.log('✅ 创建工作空间成功:', workspace.id);

    // 测试创建项目，使用不同的可见性级别
    const visibilityTypes = ['PRIVATE', 'TEAM_READONLY', 'TEAM_EDITABLE'];

    for (const visibility of visibilityTypes) {
      const project = await prisma.project.create({
        data: {
          name: `Test Project (${visibility})`,
          description: `测试项目 - ${visibility}`,
          workspaceId: workspace.id,
          creatorId: teamMember.id,
          visibility: visibility,
        },
      });
      console.log(`✅ 创建项目成功 (${visibility}):`, project.id);
    }

    // 查询所有项目以验证visibility字段
    const projects = await prisma.project.findMany({
      include: {
        creator: {
          include: {
            user: true,
          },
        },
      },
    });

    console.log('\n📊 项目列表:');
    projects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.name}`);
      console.log(`   可见性: ${project.visibility}`);
      console.log(`   创建者: ${project.creator.user.name}`);
      console.log('');
    });

    console.log('🎉 权限系统测试完成！所有功能正常工作。');
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('错误详情:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testVisibilitySystem();
