import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VisibilityType, Role } from '../../../prisma/generated/prisma/client';

@Injectable()
export class PermissionService {
  constructor(private prisma: PrismaService) {}

  /**
   * 检查用户是否有权限访问指定资源
   * @param userId 用户ID
   * @param resourceType 资源类型
   * @param resourceId 资源ID
   * @param operation 操作类型 ('read' | 'write' | 'delete')
   * @returns boolean
   */
  async checkResourcePermission(
    userId: string,
    resourceType: 'project' | 'workflow' | 'issue',
    resourceId: string,
    operation: 'read' | 'write' | 'delete' = 'read',
  ): Promise<boolean> {
    try {
      switch (resourceType) {
        case 'project':
          return await this.checkProjectPermission(
            userId,
            resourceId,
            operation,
          );
        case 'workflow':
          return await this.checkWorkflowPermission(
            userId,
            resourceId,
            operation,
          );
        case 'issue':
          return await this.checkIssuePermission(userId, resourceId, operation);
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查项目权限
   */
  private async checkProjectPermission(
    userId: string,
    projectId: string,
    operation: 'read' | 'write' | 'delete',
  ): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
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
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    const creatorUserId = await this.resolveCreatorUserId(project.creatorId);
    const ownerUserId = await this.resolveProjectOwnerUserId(projectId);

    if (ownerUserId === userId) {
      if (operation === 'delete') {
        return this.hasAdminPermission(userId, project.workspace);
      }

      return true;
    }

    return this.evaluatePermission(
      userId,
      creatorUserId,
      project.visibility,
      project.workspace,
      operation,
    );
  }

  private async resolveProjectOwnerUserId(
    projectId: string,
  ): Promise<string | null> {
    const records = await this.prisma.$queryRaw<Array<{ user_id: string | null }>>`
      SELECT tm."user_id"
      FROM "projects" p
      LEFT JOIN "team_members" tm ON tm."id" = p."owner_member_id"
      WHERE p."id" = ${projectId}
      LIMIT 1
    `;

    return records[0]?.user_id ?? null;
  }

  /**
   * 检查工作流权限
   */
  private async checkWorkflowPermission(
    userId: string,
    workflowId: string,
    operation: 'read' | 'write' | 'delete',
  ): Promise<boolean> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
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
        creator: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!workflow) {
      throw new NotFoundException('工作流不存在');
    }

    return this.evaluatePermission(
      userId,
      workflow.creator.userId,
      workflow.visibility,
      workflow.workspace,
      operation,
    );
  }

  /**
   * 检查任务权限
   */
  private async checkIssuePermission(
    userId: string,
    issueId: string,
    operation: 'read' | 'write' | 'delete',
  ): Promise<boolean> {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: {
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
        creatorMember: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!issue) {
      throw new NotFoundException('任务不存在');
    }

    return this.evaluatePermission(
      userId,
      issue.creatorMember?.userId ?? null,
      issue.visibility,
      issue.workspace,
      operation,
    );
  }

  private async resolveCreatorUserId(
    creatorMemberId: string | null | undefined,
  ): Promise<string | null> {
    if (!creatorMemberId) {
      return null;
    }

    const creator = await this.prisma.teamMember.findUnique({
      where: { id: creatorMemberId },
      select: { userId: true },
    });

    return creator?.userId ?? null;
  }

  /**
   * 评估权限
   */
  private evaluatePermission(
    userId: string,
    creatorUserId: string | null,
    visibility: VisibilityType,
    workspace: any,
    operation: 'read' | 'write' | 'delete',
  ): boolean {
    // 创建者拥有全部权限
    if (creatorUserId === userId) {
      return true;
    }

    if (visibility === VisibilityType.PUBLIC && operation === 'read') {
      return true;
    }

    // 检查用户是否有权限访问工作空间
    const hasWorkspaceAccess = this.hasWorkspaceAccess(userId, workspace);
    if (!hasWorkspaceAccess) {
      return false;
    }

    // 根据可见性类型判断权限
    switch (visibility) {
      case VisibilityType.PRIVATE:
        // 私有：只有创建者可以访问 (已在前面处理)
        return false;

      case VisibilityType.TEAM_READONLY:
        // 团队只读：团队成员可以查看，但不能编辑。管理员/所有者可以编辑。
        if (operation === 'read') {
          return true;
        }
        // 对于 write/delete 操作，检查是否是管理员/所有者
        return this.hasAdminPermission(userId, workspace);

      case VisibilityType.TEAM_EDITABLE:
        // 团队可编辑：团队成员可以查看和编辑
        if (operation === 'delete') {
          // 删除权限需要管理员权限
          return this.hasAdminPermission(userId, workspace);
        }
        return true;

      case VisibilityType.PUBLIC:
        // 公开：所有人都可以访问
        if (operation === 'delete') {
          return this.hasAdminPermission(userId, workspace);
        }
        if (operation === 'write') {
          return hasWorkspaceAccess;
        }
        return true;

      default:
        return false;
    }
  }

  /**
   * 检查用户是否有工作空间访问权限
   */
  private hasWorkspaceAccess(userId: string, workspace: any): boolean {
    if (workspace.type === 'PERSONAL') {
      return workspace.userId === userId;
    }

    if (workspace.type === 'TEAM') {
      return workspace.team.members.some(
        (member: any) => member.userId === userId,
      );
    }

    return false;
  }

  /**
   * 检查用户是否有管理员权限
   */
  private hasAdminPermission(userId: string, workspace: any): boolean {
    if (workspace.type === 'PERSONAL') {
      return workspace.userId === userId;
    }

    if (workspace.type === 'TEAM') {
      const userMember = workspace.team.members.find(
        (member: any) => member.userId === userId,
      );
      return (
        userMember &&
        (userMember.role === Role.OWNER || userMember.role === Role.ADMIN)
      );
    }

    return false;
  }

  /**
   * 验证并抛出权限错误
   */
  async validateResourcePermission(
    userId: string,
    resourceType: 'project' | 'workflow' | 'issue',
    resourceId: string,
    operation: 'read' | 'write' | 'delete' = 'read',
  ): Promise<void> {
    const hasPermission = await this.checkResourcePermission(
      userId,
      resourceType,
      resourceId,
      operation,
    );

    if (!hasPermission) {
      throw new ForbiddenException(`无权限执行 ${operation} 操作`);
    }
  }
}
