import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamMemberService } from '../common/services/team-member.service';
import { AiSurfaceSummary, AiSurfaceType } from './ai-context.types';

/**
 * AI Context 只读层。
 *
 * 这一层只负责为 agent 提供"系统中的真实对象长什么样"，不做任何写入。
 * Phase 0 仅实现：
 *   - 浓缩 surface 摘要生成（getSurfaceSummary）
 *   - workspace 维度的多对象批量摘要（getSurfaceSummaries）
 *
 * 深度 read tool（issue 详情 / workflow run / doc 全文 / 搜索）会在 Phase 1
 * 增量补齐。先把骨架搭起来，让 Next runtime 能调通端到端流程。
 */
@Injectable()
export class AiContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamMemberService: TeamMemberService,
  ) {}

  /**
   * 给一个具体对象生成浓缩摘要。每段输出 ≤ 500 tokens（≈ 2000 字符上限）。
   */
  async getSurfaceSummary(
    workspaceId: string,
    userId: string,
    surfaceType: AiSurfaceType,
    surfaceId: string,
  ): Promise<AiSurfaceSummary> {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    switch (surfaceType) {
      case 'PROJECT':
        return this.summarizeProject(workspaceId, surfaceId);
      case 'ISSUE':
      case 'WORKFLOW':
        return this.summarizeIssue(workspaceId, surfaceId, surfaceType);
      case 'DOC':
        return this.summarizeDoc(workspaceId, surfaceId);
      case 'WORKSPACE':
        return this.summarizeWorkspace(workspaceId);
      default:
        throw new NotFoundException(`暂不支持的 surface 类型: ${surfaceType}`);
    }
  }

  /**
   * 批量给一组 pin 生成摘要（一个 thread 同时 pin 的对象 ≤ 5 个）。
   */
  async getSurfaceSummaries(
    workspaceId: string,
    userId: string,
    pins: { surfaceType: AiSurfaceType; surfaceId: string }[],
  ): Promise<AiSurfaceSummary[]> {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    const limited = pins.slice(0, 5);
    const summaries: AiSurfaceSummary[] = [];

    for (const pin of limited) {
      try {
        summaries.push(
          await this.getSurfaceSummary(
            workspaceId,
            userId,
            pin.surfaceType,
            pin.surfaceId,
          ),
        );
      } catch {
        // 单个对象拉取失败不影响其他对象的摘要返回
      }
    }

    return summaries;
  }

  // ----- Summarizers -----

  private async summarizeProject(
    workspaceId: string,
    projectId: string,
  ): Promise<AiSurfaceSummary> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: { include: { user: true } },
      },
    });

    if (!project || project.workspaceId !== workspaceId) {
      throw new NotFoundException('Project 不存在');
    }

    const ownerLabel =
      project.owner?.user?.name ?? project.owner?.user?.email ?? null;

    const text = clamp(
      [
        `Project: ${project.name} (id=${project.id})`,
        `Status: ${project.status}${project.phase ? ` / ${project.phase}` : ''}`,
        `Risk: ${project.riskLevel}`,
        ownerLabel ? `Owner: ${ownerLabel}` : null,
        project.brief ? `Brief: ${project.brief}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      2000,
    );

    return {
      surfaceType: 'PROJECT',
      surfaceId: project.id,
      title: project.name,
      status: project.status,
      ownerLabel: ownerLabel ?? undefined,
      text,
    };
  }

  private async summarizeIssue(
    workspaceId: string,
    issueId: string,
    surfaceType: 'ISSUE' | 'WORKFLOW',
  ): Promise<AiSurfaceSummary> {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        state: true,
        project: true,
        assignees: { include: { member: { include: { user: true } } } },
      },
    });

    if (!issue || issue.workspaceId !== workspaceId) {
      throw new NotFoundException('Issue 不存在');
    }

    const ownerLabel =
      issue.assignees
        .map(
          (assignee) =>
            assignee.member?.user?.name ?? assignee.member?.user?.email,
        )
        .filter(Boolean)
        .join(', ') || undefined;

    const stateLabel = issue.state?.name ?? issue.currentStepStatus;
    const projectLabel = issue.project?.name ?? null;

    const text = clamp(
      [
        `${surfaceType === 'WORKFLOW' ? 'Workflow Run' : 'Issue'}: ${issue.title} (key=${issue.key ?? issue.id})`,
        `State: ${stateLabel}`,
        issue.issueType === 'WORKFLOW'
          ? `Workflow step ${issue.currentStepIndex + 1}/${issue.totalSteps} (${issue.currentStepStatus})`
          : null,
        projectLabel ? `Project: ${projectLabel}` : null,
        ownerLabel ? `Assignees: ${ownerLabel}` : null,
        issue.description ? `Description: ${issue.description}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      2000,
    );

    return {
      surfaceType,
      surfaceId: issue.id,
      title: issue.title,
      status: stateLabel ?? undefined,
      ownerLabel,
      text,
    };
  }

  private async summarizeDoc(
    workspaceId: string,
    docId: string,
  ): Promise<AiSurfaceSummary> {
    const doc = await this.prisma.doc.findUnique({
      where: { id: docId },
      include: {
        ownerMember: { include: { user: true } },
        project: true,
        issue: true,
      },
    });

    if (!doc || doc.workspaceId !== workspaceId) {
      throw new NotFoundException('Doc 不存在');
    }

    const ownerLabel =
      doc.ownerMember?.user?.name ?? doc.ownerMember?.user?.email ?? null;

    const text = clamp(
      [
        `Doc: ${doc.title} (id=${doc.id}, type=${doc.type})`,
        `Status: ${doc.status}`,
        doc.project ? `Project: ${doc.project.name}` : null,
        doc.issue ? `Issue: ${doc.issue.title}` : null,
        ownerLabel ? `Owner: ${ownerLabel}` : null,
        doc.description ? `Description: ${doc.description}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      2000,
    );

    return {
      surfaceType: 'DOC',
      surfaceId: doc.id,
      title: doc.title,
      status: doc.status,
      ownerLabel: ownerLabel ?? undefined,
      text,
    };
  }

  private async summarizeWorkspace(
    workspaceId: string,
  ): Promise<AiSurfaceSummary> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace 不存在');
    }

    const [projectCount, openIssueCount, docCount] = await Promise.all([
      this.prisma.project.count({ where: { workspaceId } }),
      this.prisma.issue.count({ where: { workspaceId } }),
      this.prisma.doc.count({ where: { workspaceId } }),
    ]);

    const text = clamp(
      [
        `Workspace: ${workspace.name} (id=${workspace.id}, type=${workspace.type})`,
        `Projects: ${projectCount}`,
        `Issues: ${openIssueCount}`,
        `Docs: ${docCount}`,
      ].join('\n'),
      2000,
    );

    return {
      surfaceType: 'WORKSPACE',
      surfaceId: workspace.id,
      title: workspace.name,
      text,
    };
  }
}

function clamp(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
