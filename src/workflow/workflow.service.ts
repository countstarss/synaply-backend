import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { WorkflowStatus, VisibilityType, Role } from '@prisma/client';
import { TeamMemberService } from '../common/services/team-member.service';
import { PermissionService } from '../common/services/permission.service';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamMemberService: TeamMemberService,
    private readonly permissionService: PermissionService,
  ) {}

  /**
   * MARK: - 创建工作流
   * @description
   * 思考过程:
   * 1. 目标: 在指定工作空间下创建一个新的工作流。
   * 2. 权限: 验证用户对工作空间的访问权限，并确保在团队工作空间中只有 OWNER 或 ADMIN 可以创建工作流。
   * 3. 关联: 将工作流与创建者 (TeamMember) 和工作空间关联起来。
   * 4. 默认值: `visibility` 字段可以有默认值。
   * @param workspaceId 工作空间 ID
   * @param createWorkflowDto 创建工作流的数据
   * @param userId 当前认证用户 ID (Supabase User ID)
   * @returns 创建的工作流对象
   */
  async create(
    workspaceId: string,
    createWorkflowDto: CreateWorkflowDto,
    userId: string,
  ) {
    const { name, visibility = VisibilityType.PRIVATE } = createWorkflowDto;

    // 验证工作空间访问权限并获取TeamMember ID
    const { workspace, teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    // 检查创建权限：个人工作空间或团队工作空间的 OWNER/ADMIN
    if (workspace.type === 'TEAM') {
      const member = workspace.team.members.find(
        (m: any) => m.userId === userId,
      );
      if (!member || member.role === Role.MEMBER) {
        throw new ForbiddenException('只有 OWNER 或 ADMIN 可以创建工作流');
      }
    }

    return this.prisma.workflow.create({
      data: {
        name,
        visibility,
        workspace: {
          connect: { id: workspaceId },
        },
        creator: {
          connect: { id: teamMemberId },
        },
      },
      include: {
        creator: {
          include: { user: true },
        },
        workspace: true,
      },
    });
  }

  /**
   * MARK: - 获取工作流列表
   * @description
   * 思考过程:
   * 1. 目标: 获取指定工作空间下，当前用户有权限查看的所有工作流列表。
   * 2. 权限: 首先验证用户对工作空间的访问权限。然后，对于每个工作流，使用 `PermissionService` 检查用户是否有读取权限。
   * 3. 关联: 包含创建者和工作空间信息。
   * 4. 排序: 默认按创建时间倒序排列。
   * @param workspaceId 工作空间 ID
   * @param userId 当前认证用户 ID (Supabase User ID)
   * @returns 工作流列表
   */
  async findAll(workspaceId: string, userId: string) {
    // 验证用户有权访问该工作空间
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    // 获取用户有权限查看的工作流
    const workflows = await this.prisma.workflow.findMany({
      where: { workspaceId },
      include: {
        creator: {
          include: { user: true },
        },
        workspace: {
          include: {
            team: {
              include: {
                members: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 过滤用户有权限查看的工作流
    const filteredWorkflows = [];
    for (const workflow of workflows) {
      const hasPermission =
        await this.permissionService.checkResourcePermission(
          userId,
          'workflow',
          workflow.id,
          'read',
        );
      if (hasPermission) {
        filteredWorkflows.push(workflow);
      }
    }

    return filteredWorkflows;
  }

  /**
   * MARK: - 获取工作流详情
   * @description
   * 思考过程:
   * 1. 目标: 获取单个工作流的详细信息，包括其步骤、创建者和所属工作空间。
   * 2. 权限: 验证用户对该工作流的读取权限。
   * 3. 验证: 如果工作流不存在，抛出 `NotFoundException`。
   * 4. 关联: 包含 `steps`、`creator` 和 `workspace` 信息。
   * 5. 排序: 步骤按 `order` 字段升序排列。
   * @param id 工作流 ID
   * @param userId 当前认证用户 ID (Supabase User ID)
   * @returns 工作流对象
   */
  async findOne(id: string, userId: string) {
    // 验证权限
    await this.permissionService.validateResourcePermission(
      userId,
      'workflow',
      id,
      'read',
    );

    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { order: 'asc' } },
        creator: {
          include: { user: true },
        },
        workspace: true,
      },
    });

    if (!workflow) {
      throw new NotFoundException(`工作流 ${id} 不存在`);
    }

    return workflow;
  }

  /**
   * MARK: - 更新工作流
   * @description
   * 思考过程:
   * 1. 目标: 更新指定工作流的名称、状态和步骤。
   * 2. 权限: 验证用户对该工作流的写入权限。
   * 3. 事务性: 工作流和其步骤的更新应是原子操作，使用 Prisma 事务确保数据一致性。
   * 4. 步骤管理: 需要处理步骤的创建、更新和删除。通过比较现有步骤和传入的步骤列表来确定哪些需要操作。
   * 5. 关联: 步骤的 `assignee` 可以连接或断开。
   * @param id 工作流 ID
   * @param updateWorkflowDto 更新工作流的数据
   * @param userId 当前认证用户 ID (Supabase User ID)
   * @returns 更新后的工作流对象
   */

  /**
   * MARK: - 删除工作流
   * @description
   * 思考过程:
   * 1. 目标: 删除指定的工作流及其所有关联的步骤。
   * 2. 权限: 验证用户对该工作流的删除权限。
   * 3. 级联删除: Prisma 默认不支持多级级联删除，所以需要手动先删除子记录（步骤），再删除父记录（工作流）。
   * @param id 工作流 ID
   * @param userId 当前认证用户 ID (Supabase User ID)
   */
  async remove(id: string, userId: string) {
    // 验证权限
    await this.permissionService.validateResourcePermission(
      userId,
      'workflow',
      id,
      'delete',
    );

    // First, delete all associated workflow steps
    await this.prisma.workflowStep.deleteMany({
      where: { workflowId: id },
    });

    // Then, delete the workflow itself
    return this.prisma.workflow.delete({
      where: { id },
    });
  }

  /**
   * MARK: - 发布工作流
   * @description
   * 思考过程:
   * 1. 目标: 将一个草稿状态的工作流发布为已发布状态。
   * 2. 权限: 验证用户对该工作流的写入权限。
   * 3. 业务逻辑: 只有包含至少一个步骤的工作流才能被发布，防止发布空的工作流。
   * 4. 状态更新: 将 `status` 字段更新为 `PUBLISHED`。
   * @param id 工作流 ID
   * @param userId 当前认证用户 ID (Supabase User ID)
   * @returns 发布后的工作流对象
   */
  async publish(id: string, userId: string) {
    // 验证权限
    await this.permissionService.validateResourcePermission(
      userId,
      'workflow',
      id,
      'write',
    );

    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: { steps: true },
    });

    if (!workflow) {
      throw new NotFoundException(`工作流 ${id} 不存在`);
    }

    if (workflow.steps.length === 0) {
      throw new ForbiddenException('不能发布没有步骤的工作流');
    }

    return this.prisma.workflow.update({
      where: { id },
      data: { status: WorkflowStatus.PUBLISHED },
      include: {
        steps: { orderBy: { order: 'asc' } },
        creator: {
          include: { user: true },
        },
        workspace: true,
      },
    });
  }
}
