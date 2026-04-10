import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import {
  Prisma,
  WorkflowStatus,
  VisibilityType,
  Role,
} from '../../prisma/generated/prisma/client';
import { TeamMemberService } from '../common/services/team-member.service';
import { PermissionService } from '../common/services/permission.service';

interface WorkflowNodeData {
  label?: string;
  assignee?: string;
  assigneeId?: string;
  assigneeName?: string;
}

interface WorkflowNode {
  id: string;
  data?: WorkflowNodeData;
}

interface WorkflowEdge {
  source: string;
  target: string;
}

interface NormalizedWorkflowJson {
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  [key: string]: unknown;
}

function parseWorkflowJsonInput(
  json: UpdateWorkflowDto['json'] | null | undefined,
): Record<string, unknown> | null {
  if (json == null) {
    return null;
  }

  if (typeof json === 'string') {
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>;
      return parsed;
    } catch {
      throw new BadRequestException('工作流数据格式不正确');
    }
  }

  return json;
}

function normalizeWorkflowJson(
  json: Record<string, unknown> | null | undefined,
  name: string,
  description?: string | null,
): NormalizedWorkflowJson {
  const nodes = Array.isArray(json?.nodes)
    ? (json?.nodes as WorkflowNode[])
    : [];
  const edges = Array.isArray(json?.edges)
    ? (json?.edges as WorkflowEdge[])
    : [];

  return {
    ...(json || {}),
    name,
    description:
      typeof description === 'string'
        ? description
        : typeof json?.description === 'string'
          ? (json.description as string)
          : '',
    nodes,
    edges,
  };
}

function buildWorkflowAssigneeMap(json: NormalizedWorkflowJson) {
  return json.nodes.reduce<Record<string, string>>((acc, node) => {
    const rawAssignee =
      node.data?.assigneeId || node.data?.assignee || node.data?.assigneeName;

    if (rawAssignee) {
      acc[node.id] = rawAssignee;
    }

    return acc;
  }, {});
}

function bumpWorkflowVersion(version: string | null | undefined) {
  const numericVersion = Number(version?.replace(/^v/i, '') || '1');
  return `v${Number.isFinite(numericVersion) ? numericVersion + 1 : 1}`;
}

function validateWorkflowTemplateStructure(json: NormalizedWorkflowJson) {
  const errors: string[] = [];
  const { nodes, edges } = json;

  if (nodes.length === 0) {
    errors.push('工作流至少需要一个节点');
  }

  const nodesWithoutLabel = nodes.filter((node) => !node.data?.label?.trim());
  if (nodesWithoutLabel.length > 0) {
    errors.push(`存在 ${nodesWithoutLabel.length} 个节点缺少名称`);
  }

  const nodesWithoutAssignee = nodes.filter(
    (node) =>
      !node.data?.assigneeId?.trim() &&
      !node.data?.assignee?.trim() &&
      !node.data?.assigneeName?.trim(),
  );
  if (nodesWithoutAssignee.length > 0) {
    errors.push(`存在 ${nodesWithoutAssignee.length} 个节点没有负责人`);
  }

  if (nodes.length > 1) {
    const startNodes = nodes.filter(
      (node) => !edges.some((edge) => edge.target === node.id),
    );
    if (startNodes.length === 0) {
      errors.push('工作流需要至少一个起始节点');
    }

    const endNodes = nodes.filter(
      (node) => !edges.some((edge) => edge.source === node.id),
    );
    if (endNodes.length === 0) {
      errors.push('工作流需要至少一个结束节点');
    }

    const connectedNodeIds = new Set<string>();
    edges.forEach((edge) => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    const isolatedNodes = nodes.filter(
      (node) => !connectedNodeIds.has(node.id),
    );
    if (isolatedNodes.length > 0) {
      errors.push(`存在 ${isolatedNodes.length} 个孤立节点`);
    }
  }

  return errors;
}

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
    const {
      name,
      description,
      visibility = VisibilityType.PRIVATE,
    } = createWorkflowDto;

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
        json: normalizeWorkflowJson(
          null,
          name,
          description,
        ) as unknown as Prisma.InputJsonValue,
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

    return this.attachWorkflowUsage(filteredWorkflows);
  }

  /**
   * MARK: - 获取工作流详情
   * @description
   * 思考过程:
   * 1. 目标: 获取单个工作流的详细信息，包括创建者和所属工作空间。
   * 2. 权限: 验证用户对该工作流的读取权限。
   * 3. 验证: 如果工作流不存在，抛出 `NotFoundException`。
   * 4. 关联: 包含 `creator` 和 `workspace` 信息。
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
        creator: {
          include: { user: true },
        },
        workspace: true,
      },
    });

    if (!workflow) {
      throw new NotFoundException(`工作流 ${id} 不存在`);
    }

    const [workflowWithUsage] = await this.attachWorkflowUsage([workflow]);
    return workflowWithUsage;
  }

  /**
   * MARK: - 更新工作流
   * @description
   * 思考过程:
   * 1. 目标: 更新指定工作流的基本信息和JSON数据。
   * 2. 权限: 验证用户对该工作流的写入权限。
   * 3. 数据更新: 更新工作流的基本信息和JSON结构数据。
   * @param id 工作流 ID
   * @param updateWorkflowDto 更新工作流的数据
   * @param userId 当前认证用户 ID (Supabase User ID)
   * @returns 更新后的工作流对象
   */
  async update(
    id: string,
    updateWorkflowDto: UpdateWorkflowDto,
    userId: string,
  ) {
    // 验证权限
    await this.permissionService.validateResourcePermission(
      userId,
      'workflow',
      id,
      'write',
    );

    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
    });

    if (!workflow) {
      throw new NotFoundException(`工作流 ${id} 不存在`);
    }

    const parsedJsonInput = parseWorkflowJsonInput(updateWorkflowDto.json);
    const shouldUpdateJson =
      parsedJsonInput !== null ||
      !!updateWorkflowDto.name ||
      updateWorkflowDto.description !== undefined;
    const normalizedJson = shouldUpdateJson
      ? normalizeWorkflowJson(
          parsedJsonInput ?? ((workflow.json as Record<string, unknown>) || {}),
          updateWorkflowDto.name ?? workflow.name,
          updateWorkflowDto.description,
        )
      : null;

    const nextVersion =
      normalizedJson &&
      JSON.stringify(normalizedJson) !==
        JSON.stringify((workflow.json as Record<string, unknown>) || {})
        ? bumpWorkflowVersion(updateWorkflowDto.version ?? workflow.version)
        : updateWorkflowDto.version;

    const workflowUpdateData: Prisma.WorkflowUpdateInput = {
      name: updateWorkflowDto.name,
      visibility: updateWorkflowDto.visibility,
      status: updateWorkflowDto.status,
      currentStepIndex: updateWorkflowDto.currentStepIndex,
      isSystemTemplate: updateWorkflowDto.isSystemTemplate,
      json: normalizedJson
        ? ((normalizedJson as unknown) as Prisma.InputJsonValue)
        : undefined,
      assigneeMap: normalizedJson
        ? buildWorkflowAssigneeMap(normalizedJson)
        : updateWorkflowDto.assigneeMap,
      totalSteps: normalizedJson
        ? normalizedJson.nodes.length
        : updateWorkflowDto.totalSteps,
      version: nextVersion,
    };

    const updatedWorkflow = await this.prisma.workflow.update({
      where: { id },
      data: workflowUpdateData,
      include: {
        creator: {
          include: { user: true },
        },
        workspace: true,
      },
    });

    const [workflowWithUsage] = await this.attachWorkflowUsage([updatedWorkflow]);
    return workflowWithUsage;
  }

  /**
   * MARK: - 删除工作流
   * @description
   * 思考过程:
   * 1. 目标: 删除指定的工作流。
   * 2. 权限: 验证用户对该工作流的删除权限。
   * 3. 级联删除: 检查是否有关联的issues，如果有则不能删除。
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

    const relatedRuns = await this.prisma.issue.count({
      where: {
        workflowId: id,
      },
    });

    if (relatedRuns > 0) {
      throw new BadRequestException(
        '该工作流模板已被运行实例使用，不能直接删除',
      );
    }

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
   * 3. 业务逻辑: 只有包含步骤（totalSteps > 0）的工作流才能被发布。
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
    });

    if (!workflow) {
      throw new NotFoundException(`工作流 ${id} 不存在`);
    }

    const normalizedJson = normalizeWorkflowJson(
      (workflow.json as Record<string, unknown>) || {},
      workflow.name,
      undefined,
    );

    const validationErrors = validateWorkflowTemplateStructure(normalizedJson);
    if (validationErrors.length > 0) {
      throw new ForbiddenException(
        `工作流未通过发布校验: ${validationErrors.join('；')}`,
      );
    }

    const publishedWorkflow = await this.prisma.workflow.update({
      where: { id },
      data: {
        status: WorkflowStatus.PUBLISHED,
        json: normalizedJson as unknown as Prisma.InputJsonValue,
        assigneeMap: buildWorkflowAssigneeMap(normalizedJson),
        totalSteps: normalizedJson.nodes.length,
      },
      include: {
        creator: {
          include: { user: true },
        },
        workspace: true,
      },
    });

    const [workflowWithUsage] = await this.attachWorkflowUsage([
      publishedWorkflow,
    ]);
    return workflowWithUsage;
  }

  private async attachWorkflowUsage<T extends { id: string }>(workflows: T[]) {
    if (workflows.length === 0) {
      return workflows;
    }

    const workflowIds = workflows.map((workflow) => workflow.id);
    const issues = await this.prisma.issue.findMany({
      where: {
        workflowId: {
          in: workflowIds,
        },
      },
      select: {
        workflowId: true,
        projectId: true,
        currentStepStatus: true,
      },
    });

    const usageMap = new Map<
      string,
      {
        totalRunCount: number;
        activeRunCount: number;
        projectCount: number;
      }
    >();

    for (const workflowId of workflowIds) {
      usageMap.set(workflowId, {
        totalRunCount: 0,
        activeRunCount: 0,
        projectCount: 0,
      });
    }

    const projectIdsByWorkflow = new Map<string, Set<string>>();
    for (const issue of issues) {
      if (!issue.workflowId) {
        continue;
      }

      const usage = usageMap.get(issue.workflowId);
      if (!usage) {
        continue;
      }

      usage.totalRunCount += 1;
      if (issue.currentStepStatus !== 'DONE') {
        usage.activeRunCount += 1;
      }

      if (issue.projectId) {
        if (!projectIdsByWorkflow.has(issue.workflowId)) {
          projectIdsByWorkflow.set(issue.workflowId, new Set());
        }
        projectIdsByWorkflow.get(issue.workflowId)?.add(issue.projectId);
      }
    }

    return workflows.map((workflow) => ({
      ...workflow,
      description:
        typeof (workflow as { json?: { description?: string } | string | null }).json ===
        'string'
          ? (() => {
              try {
                const parsedJson = JSON.parse(
                  (workflow as { json?: string | null }).json || '{}',
                ) as { description?: string };
                return parsedJson.description ?? '';
              } catch {
                return '';
              }
            })()
          : ((workflow as { json?: { description?: string } | null }).json
              ?.description ?? ''),
      usage: {
        ...(usageMap.get(workflow.id) || {
          totalRunCount: 0,
          activeRunCount: 0,
          projectCount: 0,
        }),
        projectCount: projectIdsByWorkflow.get(workflow.id)?.size || 0,
      },
    }));
  }
}
