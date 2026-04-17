import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AiSurfaceType,
  IssueStateCategory,
} from '../../prisma/generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TeamMemberService } from '../common/services/team-member.service';
import { PermissionService } from '../common/services/permission.service';
import { ProjectService } from '../project/project.service';
import { IssueService } from '../issue/issue.service';
import { DocService } from '../doc/doc.service';
import { AiExecutionService } from '../ai-execution/ai-execution.service';
import { WorkflowService } from '../workflow/workflow.service';
import {
  AiActorContextDetail,
  AiCodingPromptAssembly,
  AiDocDetail,
  AiDocSearchResult,
  AiIssueDetail,
  AiIssueListResult,
  AiIssueSearchResult,
  AiProjectDetail,
  AiProjectSearchResult,
  AiSurfaceSummary,
  AiWorkflowSearchResult,
  AiWorkflowRunDetail,
  AiWorkspaceMemberSearchResult,
  AiWorkspaceSummaryDetail,
} from './ai-context.types';
import { AiIssueAssigneeScope, ListIssuesDto } from './dto/list-issues.dto';

type LooseRecord = Record<string, unknown>;

/**
 * AI Context 只读层。
 *
 * 这一层只负责把“系统里的真实对象状态”整理成 read tool 可消费的输出：
 *  - 浓缩摘要（summary）
 *  - 深度详情（detail）
 *  - 可直接交给外部编码 agent 的 deterministic handoff prompt
 *
 * 业务 authority 仍然在 project / issue / workflow / doc / ai-execution 自己的
 * service 里；这里做的是聚合与格式化。
 */
@Injectable()
export class AiContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamMemberService: TeamMemberService,
    private readonly permissionService: PermissionService,
    private readonly projectService: ProjectService,
    private readonly issueService: IssueService,
    private readonly docService: DocService,
    private readonly workflowService: WorkflowService,
    private readonly aiExecutionService: AiExecutionService,
  ) {}

  async getSurfaceSummary(
    workspaceId: string,
    userId: string,
    surfaceType: AiSurfaceType,
    surfaceId: string,
  ): Promise<AiSurfaceSummary> {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    switch (surfaceType) {
      case 'PROJECT':
        return this.summarizeProject(workspaceId, userId, surfaceId);
      case 'ISSUE':
      case 'WORKFLOW':
        return this.summarizeIssue(workspaceId, userId, surfaceId, surfaceType);
      case 'DOC':
        return this.summarizeDoc(workspaceId, userId, surfaceId);
      case 'WORKSPACE':
        return this.summarizeWorkspace(workspaceId, userId);
      default:
        throw new NotFoundException(`暂不支持的 surface 类型: ${surfaceType}`);
    }
  }

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
        // 单个对象失败不影响其他 pin
      }
    }

    return summaries;
  }

  async getWorkspaceSummary(
    workspaceId: string,
    userId: string,
  ): Promise<AiWorkspaceSummaryDetail> {
    const workspace = await this.teamMemberService.validateWorkspaceAccess(
      userId,
      workspaceId,
    );

    const [projects, issues, docs] = await Promise.all([
      this.projectService.findAll(workspaceId, userId),
      this.issueService.findAll(workspaceId, userId, { limit: 500 } as never),
      this.docService.findTree(
        workspaceId,
        { includeArchived: false },
        userId,
      ) as Promise<LooseRecord[]>,
    ]);

    const recentProjects = [...projects]
      .sort(byUpdatedAtDesc)
      .slice(0, 5)
      .map((project) => ({
        id: project.id,
        name: project.name,
        status: project.status,
        phase: project.phase,
        riskLevel: project.riskLevel,
      }));

    const recentIssues = [...issues]
      .sort(byUpdatedAtDesc)
      .slice(0, 6)
      .map((issue) => ({
        id: issue.id,
        key: issue.key ?? null,
        title: issue.title,
        state: readNestedString(issue as LooseRecord, ['state', 'name']),
        projectName: readNestedString(issue as LooseRecord, [
          'project',
          'name',
        ]),
      }));

    const recentDocs = [...docs]
      .sort(
        (left, right) => asNumber(right.updatedAt) - asNumber(left.updatedAt),
      )
      .slice(0, 6)
      .map((doc) => ({
        id: asString(doc.id),
        title: asString(doc.title),
        type: asString(doc.type),
        updatedAt: formatTimestamp(doc.updatedAt),
      }));

    const openIssueCount = issues.filter(
      (issue) =>
        readNestedString(issue as LooseRecord, ['state', 'category']) !==
          IssueStateCategory.DONE &&
        readNestedString(issue as LooseRecord, ['state', 'category']) !==
          IssueStateCategory.CANCELED,
    ).length;

    const text = clamp(
      [
        `Workspace: ${workspace.workspace.name} (id=${workspace.workspace.id}, type=${workspace.workspace.type})`,
        `Visible projects: ${projects.length}`,
        `Visible issues: ${issues.length}，open: ${openIssueCount}`,
        `Visible docs: ${docs.length}`,
        recentProjects.length > 0
          ? `Recent projects:\n${recentProjects
              .map(
                (project) =>
                  `- ${project.name} (${project.status}${project.phase ? ` / ${project.phase}` : ''})`,
              )
              .join('\n')}`
          : null,
        recentIssues.length > 0
          ? `Recent issues:\n${recentIssues
              .map(
                (issue) =>
                  `- ${issue.key ? `${issue.key} ` : ''}${issue.title}${issue.state ? ` [${issue.state}]` : ''}`,
              )
              .join('\n')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n\n'),
      4000,
    );

    return {
      workspace: {
        id: workspace.workspace.id,
        name: workspace.workspace.name,
        type: workspace.workspace.type,
      },
      counts: {
        projectCount: projects.length,
        issueCount: issues.length,
        openIssueCount,
        docCount: docs.length,
      },
      recentProjects,
      recentIssues,
      recentDocs,
      text,
    };
  }

  async getActorContext(
    workspaceId: string,
    userId: string,
  ): Promise<AiActorContextDetail> {
    const { workspace, teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const role =
      workspace.type === 'TEAM'
        ? (workspace.team?.members.find((member) => member.userId === userId)
            ?.role ?? 'MEMBER')
        : 'OWNER';

    const text = clamp(
      [
        `Current actor: ${user?.name || user?.email || userId}`,
        `User ID: ${userId}`,
        `Team member ID: ${teamMemberId}`,
        `Role: ${role}`,
        `Workspace: ${workspace.name} (${workspace.id}, ${workspace.type})`,
      ].join('\n'),
      1000,
    );

    return {
      actor: {
        userId,
        name: user?.name ?? null,
        email: user?.email ?? null,
        teamMemberId,
        role,
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
      },
      text,
    };
  }

  async searchProjects(
    workspaceId: string,
    userId: string,
    query: string,
    limit = 8,
  ): Promise<AiProjectSearchResult> {
    const projects = (await this.projectService.findAll(
      workspaceId,
      userId,
    )) as LooseRecord[];
    const normalizedQuery = query.trim().toLowerCase();

    const items = projects
      .filter((project) => {
        if (!normalizedQuery) {
          return true;
        }

        const haystack = [
          asStringOrFallback(project.name, ''),
          asStringOrFallback(project.brief, ''),
          asStringOrFallback(project.description, ''),
        ]
          .join('\n')
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      })
      .sort((left, right) => {
        const leftName = asStringOrFallback(left.name, '').toLowerCase();
        const rightName = asStringOrFallback(right.name, '').toLowerCase();
        const leftExact = normalizedQuery
          ? leftName === normalizedQuery
          : false;
        const rightExact = normalizedQuery
          ? rightName === normalizedQuery
          : false;

        if (leftExact !== rightExact) {
          return rightExact ? 1 : -1;
        }

        return byUpdatedAtDesc(left, right);
      })
      .slice(0, limit)
      .map((project) => ({
        id: asString(project.id),
        name: asString(project.name),
        brief: asStringOrNull(project.brief),
        status: asStringOrNull(project.status),
        phase: asStringOrNull(project.phase),
        riskLevel: asStringOrNull(project.riskLevel),
        updatedAt: formatTimestamp(project.updatedAt),
      }));

    const text = clamp(
      items.length > 0
        ? `Projects search results:\n${items
            .map(
              (project) =>
                `- ${project.name} (${project.id})${project.status ? ` [${project.status}]` : ''}${project.phase ? ` / ${project.phase}` : ''}`,
            )
            .join('\n')}`
        : `No projects matched query "${query}".`,
      2200,
    );

    return {
      items,
      text,
    };
  }

  async searchIssues(
    workspaceId: string,
    userId: string,
    query: string,
    projectId?: string,
    limit = 8,
  ): Promise<AiIssueSearchResult> {
    const normalizedQuery = query.trim().toLowerCase();
    const issues = (await this.issueService.findAll(workspaceId, userId, {
      projectId,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      limit: Math.max(limit * 8, 60),
    } as never)) as LooseRecord[];

    const items = issues
      .filter((issue) => {
        if (!normalizedQuery) {
          return true;
        }

        const haystack = [
          asStringOrFallback(issue.key, ''),
          asStringOrFallback(issue.title, ''),
          asStringOrFallback(issue.description, ''),
          readNestedString(issue, ['project', 'name']) ?? '',
        ]
          .join('\n')
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      })
      .sort((left, right) => {
        const leftKey = asStringOrFallback(left.key, '').toLowerCase();
        const rightKey = asStringOrFallback(right.key, '').toLowerCase();
        const leftTitle = asStringOrFallback(left.title, '').toLowerCase();
        const rightTitle = asStringOrFallback(right.title, '').toLowerCase();
        const leftExact =
          normalizedQuery.length > 0 &&
          (leftKey === normalizedQuery || leftTitle === normalizedQuery);
        const rightExact =
          normalizedQuery.length > 0 &&
          (rightKey === normalizedQuery || rightTitle === normalizedQuery);

        if (leftExact !== rightExact) {
          return rightExact ? 1 : -1;
        }

        const leftStartsWith =
          normalizedQuery.length > 0 &&
          (leftKey.startsWith(normalizedQuery) ||
            leftTitle.startsWith(normalizedQuery));
        const rightStartsWith =
          normalizedQuery.length > 0 &&
          (rightKey.startsWith(normalizedQuery) ||
            rightTitle.startsWith(normalizedQuery));

        if (leftStartsWith !== rightStartsWith) {
          return rightStartsWith ? 1 : -1;
        }

        return byUpdatedAtDesc(left, right);
      })
      .slice(0, limit)
      .map((issue) => ({
        id: asString(issue.id),
        key: asStringOrNull(issue.key),
        title: asString(issue.title),
        description: asStringOrNull(issue.description),
        state: readNestedString(issue, ['state', 'name']),
        projectId: asStringOrNull(issue.projectId),
        projectName: readNestedString(issue, ['project', 'name']),
        updatedAt: formatTimestamp(issue.updatedAt),
        assigneeLabels: asRecordArray(issue.assignees)
          .map((assignee) => asAssigneeEntryLabel(assignee))
          .filter(Boolean) as string[],
        currentStepStatus: asStringOrNull(issue.currentStepStatus),
      }));

    const text = clamp(
      items.length > 0
        ? `Issues search results:\n${items
            .map(
              (issue) =>
                `- ${issue.key ? `${issue.key} ` : ''}${issue.title} (${issue.id})${issue.projectName ? ` / ${issue.projectName}` : ''}${issue.state ? ` [${issue.state}]` : ''}`,
            )
            .join('\n')}`
        : `No issues matched query "${query}".`,
      2600,
    );

    return {
      items,
      text,
    };
  }

  async searchWorkflows(
    workspaceId: string,
    userId: string,
    query: string,
    limit = 8,
  ): Promise<AiWorkflowSearchResult> {
    const normalizedQuery = query.trim().toLowerCase();
    const workflows = (await this.workflowService.findAll(
      workspaceId,
      userId,
    )) as LooseRecord[];

    const items = workflows
      .filter((workflow) => {
        if (!normalizedQuery) {
          return true;
        }

        const haystack = [
          asStringOrFallback(workflow.name, ''),
          asStringOrFallback(workflow.description, ''),
          asStringOrFallback(workflow.version, ''),
        ]
          .join('\n')
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      })
      .sort((left, right) => {
        const leftName = asStringOrFallback(left.name, '').toLowerCase();
        const rightName = asStringOrFallback(right.name, '').toLowerCase();
        const leftExact = normalizedQuery
          ? leftName === normalizedQuery
          : false;
        const rightExact = normalizedQuery
          ? rightName === normalizedQuery
          : false;

        if (leftExact !== rightExact) {
          return rightExact ? 1 : -1;
        }

        return byUpdatedAtDesc(left, right);
      })
      .slice(0, limit)
      .map((workflow) => ({
        id: asString(workflow.id),
        name: asString(workflow.name),
        description: asStringOrNull(workflow.description),
        status: asStringOrNull(workflow.status),
        visibility: asStringOrNull(workflow.visibility),
        version: asStringOrNull(workflow.version),
        updatedAt: formatTimestamp(workflow.updatedAt),
      }));

    const text = clamp(
      items.length > 0
        ? `Workflow search results:\n${items
            .map(
              (workflow) =>
                `- ${workflow.name} (${workflow.id})${workflow.status ? ` [${workflow.status}]` : ''}${workflow.version ? ` / ${workflow.version}` : ''}`,
            )
            .join('\n')}`
        : `No workflows matched query "${query}".`,
      2400,
    );

    return {
      items,
      text,
    };
  }

  async getProjectDetail(
    workspaceId: string,
    userId: string,
    projectId: string,
  ): Promise<AiProjectDetail> {
    const summary = (await this.projectService.findSummary(
      workspaceId,
      projectId,
      userId,
    )) as LooseRecord;
    const project = (summary.project ?? {}) as LooseRecord;
    const metrics = (summary.metrics ?? {}) as LooseRecord;
    const keyIssues = asRecordArray(summary.keyIssues).slice(0, 6);
    const blockedIssues = asRecordArray(summary.blockedIssues).slice(0, 5);

    const text = clamp(
      [
        `Project: ${asString(project.name)} (id=${asString(project.id)})`,
        `Status: ${asString(project.status)}${stringOrEmpty(project.phase)}`,
        `Risk: ${asString(project.riskLevel)}`,
        project.brief ? `Brief: ${String(project.brief)}` : null,
        metrics.totalIssues !== undefined
          ? `Metrics: totalIssues=${String(metrics.totalIssues)}, activeIssues=${String(metrics.activeIssues ?? '')}, blockedIssues=${String(metrics.blockedIssues ?? '')}`
          : null,
        keyIssues.length > 0
          ? `Key issues:\n${keyIssues
              .map(
                (issue) =>
                  `- ${issue.key ? `${issue.key} ` : ''}${asString(issue.title)}${readNestedString(issue, ['state', 'name']) ? ` [${readNestedString(issue, ['state', 'name'])}]` : ''}`,
              )
              .join('\n')}`
          : null,
        blockedIssues.length > 0
          ? `Blocked issues:\n${blockedIssues
              .map(
                (issue) =>
                  `- ${issue.key ? `${issue.key} ` : ''}${asString(issue.title)}`,
              )
              .join('\n')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n\n'),
      5000,
    );

    return {
      project,
      summary,
      text,
    };
  }

  async getIssueDetail(
    workspaceId: string,
    userId: string,
    issueId: string,
  ): Promise<AiIssueDetail> {
    const issue = (await this.issueService.findOne(
      userId,
      workspaceId,
      issueId,
    )) as LooseRecord | null;

    if (!issue) {
      throw new NotFoundException('Issue 不存在');
    }

    const [linkedDocs, recentComments] = await Promise.all([
      this.getAccessibleLinkedDocs(workspaceId, userId, {
        issueId,
        projectId: asStringOrNull(issue.projectId),
        workflowId: asStringOrNull(issue.workflowId),
      }),
      this.getRecentIssueComments(issueId),
    ]);

    const text = clamp(
      [
        `Issue: ${issue.key ? `${issue.key} ` : ''}${asString(issue.title)} (id=${asString(issue.id)})`,
        `State: ${readNestedString(issue, ['state', 'name']) || asStringOrFallback(issue.currentStepStatus, 'UNKNOWN')}`,
        issue.priority ? `Priority: ${String(issue.priority)}` : null,
        readNestedString(issue, ['project', 'name'])
          ? `Project: ${readNestedString(issue, ['project', 'name'])}`
          : null,
        issue.description ? `Description: ${String(issue.description)}` : null,
        linkedDocs.length > 0
          ? `Linked docs:\n${linkedDocs
              .map((doc) => `- ${asString(doc.title)} (${asString(doc.id)})`)
              .join('\n')}`
          : null,
        recentComments.length > 0
          ? `Recent comments:\n${recentComments
              .map(
                (comment) =>
                  `- ${asString(comment.authorLabel)}: ${asString(comment.content)}`,
              )
              .join('\n')}`
          : null,
        issue.aiHandoffPrompt
          ? `Existing coding handoff prompt already exists on this issue.`
          : null,
      ]
        .filter(Boolean)
        .join('\n\n'),
      5000,
    );

    return {
      issue,
      linkedDocs,
      recentComments,
      text,
    };
  }

  async getWorkflowRunDetail(
    workspaceId: string,
    userId: string,
    issueId: string,
  ): Promise<AiWorkflowRunDetail> {
    const workflowRun = (await this.issueService.getWorkflowRun(
      userId,
      workspaceId,
      issueId,
    )) as LooseRecord | null;

    if (!workflowRun) {
      throw new NotFoundException('Workflow run 不存在');
    }

    const [stepRecords, recentActivities, linkedDocs] = await Promise.all([
      this.prisma.issueStepRecord.findMany({
        where: { issueId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          assignee: {
            include: {
              user: true,
            },
          },
        },
      }),
      this.prisma.issueActivity.findMany({
        where: { issueId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          actor: {
            include: {
              user: true,
            },
          },
        },
      }),
      this.getAccessibleLinkedDocs(workspaceId, userId, {
        issueId,
        projectId: asStringOrNull(workflowRun.projectId),
        workflowId: asStringOrNull(workflowRun.workflowId),
      }),
    ]);

    const serializedStepRecords = stepRecords.map((record) => ({
      id: record.id,
      stepId: record.stepId,
      stepName: record.stepName,
      index: record.index,
      resultText: record.resultText,
      assigneeName:
        record.assignee?.user?.name ?? record.assignee?.user?.email ?? null,
      createdAt: record.createdAt.toISOString(),
    }));

    const serializedActivities = recentActivities.map((activity) => ({
      id: activity.id,
      action: activity.action,
      metadata: toSerializable(activity.metadata),
      actorLabel:
        activity.actor?.user?.name ?? activity.actor?.user?.email ?? null,
      createdAt: activity.createdAt.toISOString(),
    }));

    const workflowRunSummary = (workflowRun.workflowRun ?? {}) as LooseRecord;
    const text = clamp(
      [
        `Workflow run issue: ${workflowRun.key ? `${workflowRun.key} ` : ''}${asString(workflowRun.title)} (id=${asString(workflowRun.id)})`,
        `Run status: ${asStringOrFallback(workflowRunSummary.runStatus, 'UNKNOWN')}`,
        `Current step: ${asStringOrFallback(workflowRunSummary.currentStepName, '未命名步骤')} (${asStringOrFallback(workflowRun.currentStepStatus, 'UNKNOWN')})`,
        workflowRunSummary.currentAssigneeName
          ? `Current assignee: ${String(workflowRunSummary.currentAssigneeName)}`
          : null,
        workflowRunSummary.blockedReason
          ? `Blocked reason: ${String(workflowRunSummary.blockedReason)}`
          : null,
        serializedStepRecords.length > 0
          ? `Recent step records:\n${serializedStepRecords
              .map(
                (record) =>
                  `- #${record.index + 1} ${record.stepName}${record.resultText ? `: ${record.resultText}` : ''}`,
              )
              .join('\n')}`
          : null,
        serializedActivities.length > 0
          ? `Recent activities:\n${serializedActivities
              .map(
                (activity) =>
                  `- ${activity.action} by ${activity.actorLabel ?? 'unknown actor'}`,
              )
              .join('\n')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n\n'),
      5000,
    );

    return {
      workflowRun,
      stepRecords: serializedStepRecords,
      recentActivities: serializedActivities,
      linkedDocs,
      text,
    };
  }

  async getDocDetail(
    workspaceId: string,
    userId: string,
    docId: string,
  ): Promise<AiDocDetail> {
    const [doc, revisions] = await Promise.all([
      this.docService.findOne(workspaceId, docId, userId),
      this.docService.findRevisions(workspaceId, docId, userId),
    ]);

    const recentRevisions = revisions.slice(0, 5) as LooseRecord[];
    const docRecord = doc as unknown as LooseRecord;
    const contentPreview = extractPlainText(docRecord.content);

    const text = clamp(
      [
        `Doc: ${asString(docRecord.title)} (id=${asString(docRecord.id)}, type=${asString(docRecord.type)})`,
        docRecord.projectId ? `Project: ${String(docRecord.projectId)}` : null,
        docRecord.issueId ? `Issue: ${String(docRecord.issueId)}` : null,
        docRecord.workflowId
          ? `Workflow: ${String(docRecord.workflowId)}`
          : null,
        docRecord.description
          ? `Description: ${String(docRecord.description)}`
          : null,
        contentPreview ? `Content excerpt: ${contentPreview}` : null,
        recentRevisions.length > 0
          ? `Recent revisions:\n${recentRevisions
              .map(
                (revision) =>
                  `- ${formatTimestamp(revision.createdAt)} (${asStringOrFallback(revision.changeSource, 'unknown source')})`,
              )
              .join('\n')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n\n'),
      5000,
    );

    return {
      doc: docRecord,
      recentRevisions,
      text,
    };
  }

  async searchDocs(
    workspaceId: string,
    userId: string,
    query: string,
    limit = 8,
  ): Promise<AiDocSearchResult> {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    const normalizedQuery = query.trim().toLowerCase();
    const docs = (await this.docService.findTree(
      workspaceId,
      { includeArchived: false },
      userId,
    )) as LooseRecord[];

    const items = docs
      .filter((doc) => {
        if (!normalizedQuery) {
          return true;
        }

        const haystack = [
          asStringOrFallback(doc.title, ''),
          asStringOrFallback(doc.description, ''),
          extractPlainText(doc.content),
        ]
          .join('\n')
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      })
      .sort(
        (left, right) => asNumber(right.updatedAt) - asNumber(left.updatedAt),
      )
      .slice(0, limit)
      .map((doc) => ({
        id: asString(doc.id),
        title: asString(doc.title),
        description: asStringOrNull(doc.description),
        projectId: asStringOrNull(doc.projectId),
        issueId: asStringOrNull(doc.issueId),
        workflowId: asStringOrNull(doc.workflowId),
        updatedAt: formatTimestamp(doc.updatedAt),
        snippet: clamp(extractPlainText(doc.content), 280),
      }));

    const text = clamp(
      items.length > 0
        ? `Docs search results:\n${items
            .map(
              (doc) =>
                `- ${doc.title} (${doc.id})${doc.snippet ? `: ${doc.snippet}` : ''}`,
            )
            .join('\n')}`
        : `No docs matched query "${query}".`,
      2500,
    );

    return {
      items,
      text,
    };
  }

  async searchWorkspaceMembers(
    workspaceId: string,
    userId: string,
    query: string,
    limit = 8,
  ): Promise<AiWorkspaceMemberSearchResult> {
    const { workspace, teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);
    const normalizedQuery = query.trim().toLowerCase();

    const members =
      workspace.type === 'TEAM' && workspace.teamId
        ? await this.prisma.teamMember.findMany({
            where: {
              teamId: workspace.teamId,
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          })
        : await this.prisma.teamMember.findMany({
            where: {
              id: teamMemberId,
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          });

    const items = members
      .filter((member) => {
        if (!normalizedQuery) {
          return true;
        }

        const haystack = [
          member.user.name ?? '',
          member.user.email ?? '',
          member.role,
        ]
          .join('\n')
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      })
      .sort((left, right) => {
        const leftName = (
          left.user.name ??
          left.user.email ??
          ''
        ).toLowerCase();
        const rightName = (
          right.user.name ??
          right.user.email ??
          ''
        ).toLowerCase();
        const leftExact = normalizedQuery
          ? leftName === normalizedQuery
          : false;
        const rightExact = normalizedQuery
          ? rightName === normalizedQuery
          : false;

        if (leftExact !== rightExact) {
          return rightExact ? 1 : -1;
        }

        if (left.id === teamMemberId && right.id !== teamMemberId) {
          return -1;
        }

        if (right.id === teamMemberId && left.id !== teamMemberId) {
          return 1;
        }

        return leftName.localeCompare(rightName);
      })
      .slice(0, limit)
      .map((member) => ({
        teamMemberId: member.id,
        userId: member.userId,
        name: member.user.name ?? null,
        email: member.user.email ?? null,
        role: member.role,
        isCurrentActor: member.id === teamMemberId,
      }));

    const text = clamp(
      items.length > 0
        ? `Workspace member search results:\n${items
            .map(
              (member) =>
                `- ${member.name || member.email || member.userId} (teamMemberId=${member.teamMemberId}, userId=${member.userId}, role=${member.role})`,
            )
            .join('\n')}`
        : `No workspace members matched query "${query}".`,
      2200,
    );

    return {
      items,
      text,
    };
  }

  async listIssues(
    workspaceId: string,
    userId: string,
    query: ListIssuesDto,
  ): Promise<AiIssueListResult> {
    const { teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    const limit = Math.min(Math.max(query.limit ?? 10, 1), 50);
    const stateCategories = Array.from(
      new Set((query.stateCategories ?? []).filter(Boolean)),
    );
    const categoriesToQuery =
      stateCategories.length > 0 ? stateCategories : [undefined];
    const issueMap = new Map<string, LooseRecord>();

    for (const category of categoriesToQuery) {
      const issues = (await this.issueService.findAll(workspaceId, userId, {
        projectId: query.projectId,
        assigneeId:
          query.assigneeScope === AiIssueAssigneeScope.ME
            ? teamMemberId
            : undefined,
        stateCategory: category,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
        limit: Math.max(limit * 2, 20),
      } as never)) as LooseRecord[];

      for (const issue of issues) {
        issueMap.set(asString(issue.id), issue);
      }
    }

    const items = Array.from(issueMap.values())
      .sort(byUpdatedAtDesc)
      .slice(0, limit)
      .map((issue) => ({
        id: asString(issue.id),
        key: asStringOrNull(issue.key),
        title: asString(issue.title),
        state: readNestedString(issue, ['state', 'name']),
        stateCategory: readNestedString(issue, ['state', 'category']),
        projectName: readNestedString(issue, ['project', 'name']),
        updatedAt: formatTimestamp(issue.updatedAt),
        assigneeLabels: asRecordArray(issue.assignees)
          .map((assignee) => asAssigneeEntryLabel(assignee))
          .filter(Boolean) as string[],
        currentStepStatus: asStringOrNull(issue.currentStepStatus),
      }));

    const text = clamp(
      items.length > 0
        ? `Issues list results:\n${items
            .map(
              (issue) =>
                `- ${issue.key ? `${issue.key} ` : ''}${issue.title}${issue.state ? ` [${issue.state}]` : ''}${issue.projectName ? ` / ${issue.projectName}` : ''}${issue.assigneeLabels.length > 0 ? ` / assignees: ${issue.assigneeLabels.join(', ')}` : ''}`,
            )
            .join('\n')}`
        : 'No issues matched the requested filters.',
      3000,
    );

    return {
      filters: {
        projectId: query.projectId ?? null,
        assigneeScope: query.assigneeScope ?? AiIssueAssigneeScope.ANY,
        stateCategories: stateCategories.map(String),
        limit,
      },
      items,
      text,
    };
  }

  async getCapabilities(workspaceId: string, userId: string) {
    return this.aiExecutionService.getCapabilities(workspaceId, userId);
  }

  async assembleCodingPrompt(
    workspaceId: string,
    userId: string,
    issueId: string,
  ): Promise<AiCodingPromptAssembly> {
    const issueDetail = await this.getIssueDetail(workspaceId, userId, issueId);
    const issue = issueDetail.issue;

    const projectSummary =
      issue.projectId && typeof issue.projectId === 'string'
        ? ((await this.projectService.findSummary(
            workspaceId,
            issue.projectId,
            userId,
          )) as LooseRecord)
        : null;
    const workflowDetail =
      issue.issueType === 'WORKFLOW' ||
      Boolean(issue.workflowId) ||
      Boolean(issue.workflowSnapshot)
        ? await this.getWorkflowRunDetail(workspaceId, userId, issueId)
        : null;

    const linkedDocs = issueDetail.linkedDocs.slice(0, 5);
    const recentComments = issueDetail.recentComments.slice(0, 5);

    const prompt = [
      '# Synaply Coding Handoff',
      '',
      '你正在接手一个来自 Synaply 的真实执行对象。请先理解上下文，再给出实现方案并编码。',
      '',
      '## Workspace',
      `- Workspace ID: ${workspaceId}`,
      '',
      '## Issue',
      `- Issue ID: ${asString(issue.id)}`,
      `- Issue Key: ${asStringOrFallback(issue.key, '未设置')}`,
      `- Title: ${asString(issue.title)}`,
      `- State: ${readNestedString(issue, ['state', 'name']) || asStringOrFallback(issue.currentStepStatus, 'UNKNOWN')}`,
      `- Priority: ${asStringOrFallback(issue.priority, 'NORMAL')}`,
      issue.projectId ? `- Project ID: ${String(issue.projectId)}` : null,
      issue.description ? `- Description: ${String(issue.description)}` : null,
      '',
      projectSummary ? '## Project Context' : null,
      projectSummary
        ? `- Project Name: ${asString(readNestedRecord(projectSummary, 'project')?.name)}`
        : null,
      projectSummary && readNestedRecord(projectSummary, 'project')?.brief
        ? `- Brief: ${String(readNestedRecord(projectSummary, 'project')?.brief)}`
        : null,
      projectSummary
        ? `- Status: ${asString(readNestedRecord(projectSummary, 'project')?.status)}`
        : null,
      '',
      workflowDetail ? '## Workflow Context' : null,
      workflowDetail
        ? `- Run Status: ${asString(readNestedRecord(workflowDetail.workflowRun, 'workflowRun')?.runStatus)}`
        : null,
      workflowDetail
        ? `- Current Step: ${asStringOrFallback(readNestedRecord(workflowDetail.workflowRun, 'workflowRun')?.currentStepName, '未命名步骤')}`
        : null,
      workflowDetail &&
      readNestedRecord(workflowDetail.workflowRun, 'workflowRun')?.blockedReason
        ? `- Blocked Reason: ${String(readNestedRecord(workflowDetail.workflowRun, 'workflowRun')?.blockedReason)}`
        : null,
      '',
      linkedDocs.length > 0 ? '## Related Docs' : null,
      linkedDocs.length > 0
        ? linkedDocs
            .map((doc) =>
              [
                `### ${asString(doc.title)} (${asString(doc.id)})`,
                clamp(extractPlainText(doc.content), 1200) ||
                  asStringOrFallback(doc.description, '无内容摘录'),
              ].join('\n'),
            )
            .join('\n\n')
        : null,
      '',
      recentComments.length > 0 ? '## Recent Comments' : null,
      recentComments.length > 0
        ? recentComments
            .map(
              (comment) =>
                `- ${asString(comment.authorLabel)}: ${clamp(asString(comment.content), 220)}`,
            )
            .join('\n')
        : null,
      '',
      '## Delivery Requirements',
      '- 优先复用现有实现与已有服务边界，不要绕开当前业务 authority。',
      '- 如果上下文不足，先列出缺口和假设，再开始编码。',
      '- 先给出实现计划，再进行修改，再说明验证方式。',
      '- 如果需要更新 issue 或 handoff prompt，请保持与 Synaply AI execution 约定一致。',
    ]
      .filter((line) => line !== null)
      .join('\n');

    return {
      issueId,
      prompt,
      linkedDocIds: linkedDocs.map((doc) => asString(doc.id)),
      text: clamp(
        [
          `Assembled coding prompt for issue ${asString(issue.id)}.`,
          linkedDocs.length > 0
            ? `Included ${linkedDocs.length} related docs.`
            : 'No related docs were included.',
          recentComments.length > 0
            ? `Included ${recentComments.length} recent comments.`
            : 'No recent comments were included.',
        ].join(' '),
        1200,
      ),
    };
  }

  private async summarizeProject(
    workspaceId: string,
    userId: string,
    projectId: string,
  ): Promise<AiSurfaceSummary> {
    const detail = await this.getProjectDetail(workspaceId, userId, projectId);
    const project = detail.project;

    return {
      surfaceType: 'PROJECT',
      surfaceId: asString(project.id),
      title: asString(project.name),
      status: asStringOrNull(project.status) ?? undefined,
      ownerLabel:
        readNestedString(project, ['owner', 'user', 'name']) ??
        readNestedString(project, ['owner', 'user', 'email']) ??
        undefined,
      text: clamp(detail.text, 2000),
    };
  }

  private async summarizeIssue(
    workspaceId: string,
    userId: string,
    issueId: string,
    surfaceType: 'ISSUE' | 'WORKFLOW',
  ): Promise<AiSurfaceSummary> {
    const detail =
      surfaceType === 'WORKFLOW'
        ? await this.getWorkflowRunDetail(workspaceId, userId, issueId)
        : await this.getIssueDetail(workspaceId, userId, issueId);
    const issue =
      surfaceType === 'WORKFLOW'
        ? (detail as AiWorkflowRunDetail).workflowRun
        : (detail as AiIssueDetail).issue;

    return {
      surfaceType,
      surfaceId: asString(issue.id),
      title: asString(issue.title),
      status:
        readNestedString(issue, ['state', 'name']) ??
        asStringOrNull(issue.currentStepStatus) ??
        undefined,
      ownerLabel:
        readNestedString(issue, ['workflowRun', 'currentAssigneeName']) ??
        asAssigneeLabel(issue),
      text: clamp(detail.text, 2000),
    };
  }

  private async summarizeDoc(
    workspaceId: string,
    userId: string,
    docId: string,
  ): Promise<AiSurfaceSummary> {
    const detail = await this.getDocDetail(workspaceId, userId, docId);
    const doc = detail.doc;

    return {
      surfaceType: 'DOC',
      surfaceId: asString(doc.id),
      title: asString(doc.title),
      status: asStringOrNull(doc.status) ?? undefined,
      text: clamp(detail.text, 2000),
    };
  }

  private async summarizeWorkspace(
    workspaceId: string,
    userId: string,
  ): Promise<AiSurfaceSummary> {
    const detail = await this.getWorkspaceSummary(workspaceId, userId);
    return {
      surfaceType: 'WORKSPACE',
      surfaceId: detail.workspace.id,
      title: detail.workspace.name,
      text: clamp(detail.text, 2000),
    };
  }

  private async getAccessibleLinkedDocs(
    workspaceId: string,
    userId: string,
    params: {
      issueId?: string | null;
      projectId?: string | null;
      workflowId?: string | null;
    },
  ) {
    const docs = (await this.docService.findTree(
      workspaceId,
      { includeArchived: false },
      userId,
    )) as LooseRecord[];

    return docs
      .filter((doc) => {
        if (params.issueId && doc.issueId === params.issueId) {
          return true;
        }

        if (params.workflowId && doc.workflowId === params.workflowId) {
          return true;
        }

        if (params.projectId && doc.projectId === params.projectId) {
          return true;
        }

        return false;
      })
      .sort(
        (left, right) => asNumber(right.updatedAt) - asNumber(left.updatedAt),
      )
      .slice(0, 8);
  }

  private async getRecentIssueComments(issueId: string) {
    const comments = await this.prisma.comment.findMany({
      where: { issueId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: {
        author: {
          include: {
            user: true,
          },
        },
      },
    });

    return comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      authorLabel:
        comment.author?.user?.name ?? comment.author?.user?.email ?? 'unknown',
      createdAt: comment.createdAt.toISOString(),
    }));
  }
}

function clamp(text: string, max: number) {
  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, max - 1)}…`;
}

function asString(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

function asStringOrNull(value: unknown) {
  const normalized = asString(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function asStringOrFallback(value: unknown, fallback: string) {
  return asStringOrNull(value) ?? fallback;
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const timestamp = new Date(value).getTime();
    if (Number.isFinite(timestamp)) {
      return timestamp;
    }

    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return 0;
}

function byUpdatedAtDesc(left: LooseRecord, right: LooseRecord) {
  return asNumber(right.updatedAt) - asNumber(left.updatedAt);
}

function formatTimestamp(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string' && value.trim()) {
    const timestamp = new Date(value);
    if (!Number.isNaN(timestamp.getTime())) {
      return timestamp.toISOString();
    }
  }

  return '';
}

function readNestedString(record: LooseRecord, path: string[]): string | null {
  let current: unknown = record;

  for (const key of path) {
    if (!current || typeof current !== 'object') {
      return null;
    }

    current = (current as LooseRecord)[key];
  }

  return asStringOrNull(current);
}

function readNestedRecord(
  record: LooseRecord,
  key: string,
): LooseRecord | null {
  const value = record[key];
  return value && typeof value === 'object' ? (value as LooseRecord) : null;
}

function stringOrEmpty(value: unknown) {
  const normalized = asStringOrNull(value);
  return normalized ? ` / ${normalized}` : '';
}

function asRecordArray(value: unknown): LooseRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item) => item && typeof item === 'object',
  ) as LooseRecord[];
}

function extractPlainText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return extractPlainText(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }

    return trimmed;
  }

  if (Array.isArray(value)) {
    return value.map(extractPlainText).filter(Boolean).join(' ').trim();
  }

  if (typeof value === 'object') {
    const record = value as LooseRecord;
    return [
      extractPlainText(record.text),
      extractPlainText(record.content),
      extractPlainText(record.children),
      extractPlainText(record.description),
      extractPlainText(record.label),
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return String(value);
}

function asAssigneeLabel(issue: LooseRecord) {
  const assignees = asRecordArray(issue.assignees);
  const labels = assignees
    .map(
      (assignee) =>
        readNestedString(assignee, ['member', 'user', 'name']) ??
        readNestedString(assignee, ['member', 'user', 'email']),
    )
    .filter(Boolean);

  return labels.length > 0 ? labels.join(', ') : undefined;
}

function asAssigneeEntryLabel(assignee: LooseRecord) {
  return (
    readNestedString(assignee, ['member', 'user', 'name']) ??
    readNestedString(assignee, ['member', 'user', 'email']) ??
    undefined
  );
}

function toSerializable<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, currentValue) =>
      typeof currentValue === 'bigint'
        ? Number(currentValue)
        : currentValue instanceof Date
          ? currentValue.toISOString()
          : currentValue,
    ),
  ) as T;
}
