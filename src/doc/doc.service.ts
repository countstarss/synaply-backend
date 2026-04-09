import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Role,
  VisibilityType,
  WorkspaceType,
} from '../../prisma/generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TeamMemberService } from '../common/services/team-member.service';
import { CreateDocDto } from './dto/create-doc.dto';
import { CreateFolderDto } from './dto/create-folder.dto';
import { CreateDocRevisionDto } from './dto/create-doc-revision.dto';
import { DocContextValue, QueryDocsDto } from './dto/query-docs.dto';
import { UpdateDocMetaDto } from './dto/update-doc-meta.dto';
import { DocChangeSourceValue, DocTypeValue } from './doc.constants';

const DEFAULT_DOC_CONTENT = [
  {
    id: 'initial',
    type: 'paragraph',
    content: [],
  },
] satisfies Array<Record<string, unknown>>;

type QueryExecutor = PrismaService | Prisma.TransactionClient;

type DocRow = {
  id: string;
  workspace_id: string;
  creator_member_id: string;
  owner_member_id: string;
  title: string;
  description: string | null;
  type: keyof typeof DocTypeValue | DocTypeValue;
  status: string;
  visibility: VisibilityType;
  parent_id: string | null;
  project_id: string | null;
  issue_id: string | null;
  workflow_id: string | null;
  icon: string | null;
  cover_image: string | null;
  sort_order: number;
  is_archived: boolean;
  is_deleted: boolean;
  latest_revision_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  last_edited_at: Date | string;
  workspace_type: WorkspaceType;
  creator_user_id: string;
  latest_content_snapshot: unknown | null;
  latest_metadata_snapshot: unknown | null;
};

type DocRevisionRow = {
  id: string;
  doc_id: string;
  base_revision_id: string | null;
  author_member_id: string;
  client_mutation_id: string;
  content_snapshot: unknown;
  metadata_snapshot: unknown | null;
  change_source: string;
  created_at: Date | string;
};

@Injectable()
export class DocService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamMemberService: TeamMemberService,
  ) {}

  async findTree(workspaceId: string, query: QueryDocsDto, userId: string) {
    const { workspace, teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);
    const workspaceRole = this.resolveWorkspaceRole(workspace);
    const docs = await this.fetchDocs(this.prisma, workspaceId, {
      includeArchived: query.includeArchived ?? false,
      projectId: query.projectId,
    });

    return docs
      .filter((doc) =>
        this.matchesContext(doc, query.context, workspace.type, teamMemberId),
      )
      .filter((doc) =>
        this.canReadDoc(doc, workspace.type, teamMemberId, workspaceRole),
      )
      .sort((left, right) => this.compareDocs(left, right))
      .map((doc) =>
        this.toDocReadModel(doc, workspace.type, teamMemberId, workspaceRole),
      );
  }

  async findOne(workspaceId: string, docId: string, userId: string) {
    const { workspace, teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);
    const workspaceRole = this.resolveWorkspaceRole(workspace);
    const doc = await this.getDocOrThrow(this.prisma, workspaceId, docId);

    if (!this.canReadDoc(doc, workspace.type, teamMemberId, workspaceRole)) {
      throw new ForbiddenException('没有权限查看该文档');
    }

    return this.toDocReadModel(doc, workspace.type, teamMemberId, workspaceRole);
  }

  async findRevisions(workspaceId: string, docId: string, userId: string) {
    const { workspace, teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);
    const workspaceRole = this.resolveWorkspaceRole(workspace);
    const doc = await this.getDocOrThrow(this.prisma, workspaceId, docId);

    if (!this.canReadDoc(doc, workspace.type, teamMemberId, workspaceRole)) {
      throw new ForbiddenException('没有权限查看该文档的修订记录');
    }

    const revisions = await this.prisma.$queryRaw<DocRevisionRow[]>(Prisma.sql`
      SELECT
        r."id",
        r."doc_id",
        r."base_revision_id",
        r."author_member_id",
        r."client_mutation_id",
        r."content_snapshot",
        r."metadata_snapshot",
        r."change_source",
        r."created_at"
      FROM "doc_revisions" r
      WHERE r."doc_id" = ${docId}
      ORDER BY r."created_at" DESC
    `);

    return revisions.map((revision) => ({
      id: revision.id,
      docId: revision.doc_id,
      baseRevisionId: revision.base_revision_id,
      authorMemberId: revision.author_member_id,
      clientMutationId: revision.client_mutation_id,
      changeSource: revision.change_source,
      contentSnapshot: this.serializeSnapshot(revision.content_snapshot),
      metadataSnapshot: revision.metadata_snapshot
        ? JSON.stringify(revision.metadata_snapshot)
        : null,
      createdAt: this.asDate(revision.created_at).toISOString(),
    }));
  }

  async create(workspaceId: string, dto: CreateDocDto, userId: string) {
    const { workspace, teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);
    const workspaceRole = this.resolveWorkspaceRole(workspace);

    await this.validateRelationScope(
      workspaceId,
      dto.projectId,
      dto.issueId,
      dto.workflowId,
    );
    await this.validateParentFolderAccess(
      workspaceId,
      dto.parentDocument,
      workspace.type,
      teamMemberId,
      workspaceRole,
      'create',
    );

    const docId = randomUUID();
    const revisionId = randomUUID();
    const visibility =
      dto.visibility ?? this.getDefaultVisibility(workspace.type, false);
    const contentSnapshot = this.parseSnapshot(dto.content);
    const metadataSnapshot = this.buildMetadataSnapshot({
      title: dto.title.trim() || '未命名文档',
      visibility,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "docs" (
          "id",
          "workspace_id",
          "creator_member_id",
          "owner_member_id",
          "title",
          "type",
          "visibility",
          "parent_id",
          "project_id",
          "issue_id",
          "workflow_id",
          "sort_order",
          "created_at",
          "updated_at",
          "last_edited_at"
        )
        VALUES (
          ${docId},
          ${workspaceId},
          ${teamMemberId},
          ${teamMemberId},
          ${metadataSnapshot.title as string},
          ${DocTypeValue.DOCUMENT}::"DocType",
          ${visibility}::"VisibilityType",
          ${dto.parentDocument ?? null},
          ${dto.projectId ?? null},
          ${dto.issueId ?? null},
          ${dto.workflowId ?? null},
          ${dto.order ?? 0},
          NOW(),
          NOW(),
          NOW()
        )
      `);

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "doc_revisions" (
          "id",
          "doc_id",
          "base_revision_id",
          "author_member_id",
          "client_mutation_id",
          "content_snapshot",
          "metadata_snapshot",
          "change_source",
          "created_at"
        )
        VALUES (
          ${revisionId},
          ${docId},
          ${null},
          ${teamMemberId},
          ${`create:${docId}:${randomUUID()}`},
          ${JSON.stringify(contentSnapshot)}::jsonb,
          ${JSON.stringify(metadataSnapshot)}::jsonb,
          ${DocChangeSourceValue.CREATE}::"DocChangeSource",
          NOW()
        )
      `);

      await tx.$executeRaw(Prisma.sql`
        UPDATE "docs"
        SET
          "latest_revision_id" = ${revisionId},
          "updated_at" = NOW(),
          "last_edited_at" = NOW()
        WHERE "id" = ${docId}
      `);

      return this.getDocOrThrow(tx, workspaceId, docId);
    });

    return this.toDocReadModel(created, workspace.type, teamMemberId, workspaceRole);
  }

  async createFolder(workspaceId: string, dto: CreateFolderDto, userId: string) {
    const { workspace, teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);
    const workspaceRole = this.resolveWorkspaceRole(workspace);

    await this.validateRelationScope(
      workspaceId,
      dto.projectId,
      dto.issueId,
      dto.workflowId,
    );
    await this.validateParentFolderAccess(
      workspaceId,
      dto.parentDocument,
      workspace.type,
      teamMemberId,
      workspaceRole,
      'create',
    );

    const folderId = randomUUID();
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "docs" (
        "id",
        "workspace_id",
        "creator_member_id",
        "owner_member_id",
        "title",
        "description",
        "type",
        "visibility",
        "parent_id",
        "project_id",
        "issue_id",
        "workflow_id",
        "sort_order",
        "created_at",
        "updated_at",
        "last_edited_at"
      )
      VALUES (
        ${folderId},
        ${workspaceId},
        ${teamMemberId},
        ${teamMemberId},
        ${dto.title.trim() || '未命名文件夹'},
        ${dto.description?.trim() || null},
        ${DocTypeValue.FOLDER}::"DocType",
        ${(dto.visibility ?? this.getDefaultVisibility(workspace.type, true))}::"VisibilityType",
        ${dto.parentDocument ?? null},
        ${dto.projectId ?? null},
        ${dto.issueId ?? null},
        ${dto.workflowId ?? null},
        ${dto.order ?? 0},
        NOW(),
        NOW(),
        NOW()
      )
    `);

    const created = await this.getDocOrThrow(this.prisma, workspaceId, folderId);
    return this.toDocReadModel(created, workspace.type, teamMemberId, workspaceRole);
  }

  async updateMeta(
    workspaceId: string,
    docId: string,
    dto: UpdateDocMetaDto,
    userId: string,
  ) {
    const { workspace, teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);
    const workspaceRole = this.resolveWorkspaceRole(workspace);
    const existing = await this.getDocOrThrow(this.prisma, workspaceId, docId);

    if (!this.canWriteDoc(existing, workspace.type, teamMemberId, workspaceRole)) {
      throw new ForbiddenException('没有权限修改该文档');
    }

    if (dto.description !== undefined && existing.type !== DocTypeValue.FOLDER) {
      throw new BadRequestException('只有文件夹可以更新描述');
    }

    const updates: Prisma.Sql[] = [];

    if (dto.title !== undefined) {
      updates.push(
        Prisma.sql`"title" = ${dto.title.trim() || existing.title}`,
      );
    }

    if (dto.description !== undefined) {
      updates.push(
        Prisma.sql`"description" = ${dto.description.trim() || null}`,
      );
    }

    if (dto.icon !== undefined) {
      updates.push(Prisma.sql`"icon" = ${dto.icon || null}`);
    }

    if (dto.coverImage !== undefined) {
      updates.push(Prisma.sql`"cover_image" = ${dto.coverImage || null}`);
    }

    if (dto.visibility !== undefined) {
      updates.push(
        Prisma.sql`"visibility" = ${dto.visibility}::"VisibilityType"`,
      );
    }

    updates.push(Prisma.sql`"updated_at" = NOW()`);
    updates.push(Prisma.sql`"last_edited_at" = NOW()`);

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "docs"
      SET ${Prisma.join(updates, ', ')}
      WHERE "id" = ${docId}
    `);

    const updated = await this.getDocOrThrow(this.prisma, workspaceId, docId);
    return this.toDocReadModel(updated, workspace.type, teamMemberId, workspaceRole);
  }

  async createRevision(
    workspaceId: string,
    docId: string,
    dto: CreateDocRevisionDto,
    userId: string,
  ) {
    const { workspace, teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);
    const workspaceRole = this.resolveWorkspaceRole(workspace);
    const existing = await this.getDocOrThrow(this.prisma, workspaceId, docId);

    if (existing.type !== DocTypeValue.DOCUMENT) {
      throw new BadRequestException('只有文档支持修订版本');
    }

    if (!this.canWriteDoc(existing, workspace.type, teamMemberId, workspaceRole)) {
      throw new ForbiddenException('没有权限编辑该文档');
    }

    const duplicate = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "doc_revisions"
      WHERE "doc_id" = ${docId}
        AND "client_mutation_id" = ${dto.clientMutationId}
      LIMIT 1
    `);

    if (duplicate[0]?.id) {
      return {
        status: 'noop' as const,
        revisionId: duplicate[0].id,
        doc: this.toDocReadModel(existing, workspace.type, teamMemberId, workspaceRole),
      };
    }

    if ((existing.latest_revision_id ?? null) !== (dto.baseRevisionId ?? null)) {
      return {
        status: 'conflict' as const,
        revisionId: existing.latest_revision_id,
        doc: this.toDocReadModel(existing, workspace.type, teamMemberId, workspaceRole),
        serverRevisionId: existing.latest_revision_id,
        serverSnapshot: this.serializeSnapshot(existing.latest_content_snapshot),
        serverMetadataSnapshot: existing.latest_metadata_snapshot
          ? JSON.stringify(existing.latest_metadata_snapshot)
          : null,
      };
    }

    const nextContentSnapshot = this.parseSnapshot(dto.contentSnapshot);
    const nextMetadata = this.parseMetadata(dto.metadataSnapshot);
    const currentSnapshot = this.serializeSnapshot(existing.latest_content_snapshot);

    if (
      currentSnapshot === JSON.stringify(nextContentSnapshot) &&
      Object.keys(nextMetadata).length === 0
    ) {
      return {
        status: 'noop' as const,
        revisionId: existing.latest_revision_id,
        doc: this.toDocReadModel(existing, workspace.type, teamMemberId, workspaceRole),
      };
    }

    const revisionId = randomUUID();
    const mergedTitle =
      this.pickStringMetadata(nextMetadata, 'title') ?? existing.title;
    const mergedIcon =
      this.pickStringMetadata(nextMetadata, 'icon') ?? existing.icon;
    const mergedCoverImage =
      this.pickStringMetadata(nextMetadata, 'coverImage') ?? existing.cover_image;
    const mergedVisibility =
      this.pickVisibilityMetadata(nextMetadata) ?? existing.visibility;

    const appliedDoc = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "doc_revisions" (
          "id",
          "doc_id",
          "base_revision_id",
          "author_member_id",
          "client_mutation_id",
          "content_snapshot",
          "metadata_snapshot",
          "change_source",
          "created_at"
        )
        VALUES (
          ${revisionId},
          ${docId},
          ${dto.baseRevisionId ?? null},
          ${teamMemberId},
          ${dto.clientMutationId},
          ${JSON.stringify(nextContentSnapshot)}::jsonb,
          ${JSON.stringify({
            title: mergedTitle,
            icon: mergedIcon,
            coverImage: mergedCoverImage,
            visibility: mergedVisibility,
          })}::jsonb,
          ${(dto.changeSource ?? DocChangeSourceValue.EDITOR)}::"DocChangeSource",
          NOW()
        )
      `);

      await tx.$executeRaw(Prisma.sql`
        UPDATE "docs"
        SET
          "title" = ${mergedTitle},
          "icon" = ${mergedIcon},
          "cover_image" = ${mergedCoverImage},
          "visibility" = ${mergedVisibility}::"VisibilityType",
          "latest_revision_id" = ${revisionId},
          "updated_at" = NOW(),
          "last_edited_at" = NOW()
        WHERE "id" = ${docId}
      `);

      return this.getDocOrThrow(tx, workspaceId, docId);
    });

    return {
      status: 'applied' as const,
      revisionId,
      doc: this.toDocReadModel(
        appliedDoc,
        workspace.type,
        teamMemberId,
        workspaceRole,
      ),
    };
  }

  async remove(workspaceId: string, docId: string, userId: string) {
    const { workspace, teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);
    const workspaceRole = this.resolveWorkspaceRole(workspace);
    const existing = await this.getDocOrThrow(this.prisma, workspaceId, docId);

    if (!this.canDeleteDoc(existing, workspace.type, teamMemberId, workspaceRole)) {
      throw new ForbiddenException('没有权限删除该文档');
    }

    if (existing.type === DocTypeValue.FOLDER) {
      const children = await this.prisma.$queryRaw<Array<{ count: bigint }>>(
        Prisma.sql`
          SELECT COUNT(*)::bigint AS "count"
          FROM "docs"
          WHERE "parent_id" = ${docId}
            AND "is_deleted" = false
        `,
      );

      if (Number(children[0]?.count ?? 0) > 0) {
        throw new BadRequestException('文件夹不为空，无法删除');
      }
    }

    const deleted = this.toDocReadModel(
      existing,
      workspace.type,
      teamMemberId,
      workspaceRole,
    );

    await this.prisma.$executeRaw(Prisma.sql`
      DELETE FROM "docs"
      WHERE "id" = ${docId}
    `);

    return deleted;
  }

  private async validateRelationScope(
    workspaceId: string,
    projectId?: string,
    issueId?: string,
    workflowId?: string,
  ) {
    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: {
          id: projectId,
          workspaceId,
        },
        select: {
          id: true,
        },
      });

      if (!project) {
        throw new BadRequestException('projectId 不属于当前工作空间');
      }
    }

    if (issueId) {
      const issue = await this.prisma.issue.findFirst({
        where: {
          id: issueId,
          workspaceId,
        },
        select: {
          id: true,
        },
      });

      if (!issue) {
        throw new BadRequestException('issueId 不属于当前工作空间');
      }
    }

    if (workflowId) {
      const workflow = await this.prisma.workflow.findFirst({
        where: {
          id: workflowId,
          workspaceId,
        },
        select: {
          id: true,
        },
      });

      if (!workflow) {
        throw new BadRequestException('workflowId 不属于当前工作空间');
      }
    }
  }

  private async validateParentFolderAccess(
    workspaceId: string,
    parentDocument: string | undefined,
    workspaceType: WorkspaceType,
    teamMemberId: string,
    workspaceRole: Role,
    action: 'create' | 'move',
  ) {
    if (!parentDocument) {
      return;
    }

    const parent = await this.getDocOrThrow(this.prisma, workspaceId, parentDocument);

    if (parent.type !== DocTypeValue.FOLDER) {
      throw new BadRequestException('父级节点必须是文件夹');
    }

    if (!this.canWriteDoc(parent, workspaceType, teamMemberId, workspaceRole)) {
      throw new ForbiddenException(
        action === 'create' ? '没有权限在该文件夹中创建内容' : '没有权限移动到该文件夹',
      );
    }
  }

  private async fetchDocs(
    executor: QueryExecutor,
    workspaceId: string,
    options: {
      includeArchived: boolean;
      projectId?: string;
    },
  ) {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`d."workspace_id" = ${workspaceId}`,
      Prisma.sql`d."is_deleted" = false`,
    ];

    if (!options.includeArchived) {
      conditions.push(Prisma.sql`d."is_archived" = false`);
    }

    if (options.projectId) {
      conditions.push(Prisma.sql`d."project_id" = ${options.projectId}`);
    }

    return executor.$queryRaw<DocRow[]>(Prisma.sql`
      SELECT
        d."id",
        d."workspace_id",
        d."creator_member_id",
        d."owner_member_id",
        d."title",
        d."description",
        d."type",
        d."status",
        d."visibility",
        d."parent_id",
        d."project_id",
        d."issue_id",
        d."workflow_id",
        d."icon",
        d."cover_image",
        d."sort_order",
        d."is_archived",
        d."is_deleted",
        d."latest_revision_id",
        d."created_at",
        d."updated_at",
        d."last_edited_at",
        w."type" AS "workspace_type",
        creator_tm."user_id" AS "creator_user_id",
        latest."content_snapshot" AS "latest_content_snapshot",
        latest."metadata_snapshot" AS "latest_metadata_snapshot"
      FROM "docs" d
      INNER JOIN "workspaces" w
        ON w."id" = d."workspace_id"
      INNER JOIN "team_members" creator_tm
        ON creator_tm."id" = d."creator_member_id"
      LEFT JOIN "doc_revisions" latest
        ON latest."id" = d."latest_revision_id"
      WHERE ${Prisma.join(conditions, ' AND ')}
    `);
  }

  private async getDocOrThrow(
    executor: QueryExecutor,
    workspaceId: string,
    docId: string,
  ) {
    const docs = await executor.$queryRaw<DocRow[]>(Prisma.sql`
      SELECT
        d."id",
        d."workspace_id",
        d."creator_member_id",
        d."owner_member_id",
        d."title",
        d."description",
        d."type",
        d."status",
        d."visibility",
        d."parent_id",
        d."project_id",
        d."issue_id",
        d."workflow_id",
        d."icon",
        d."cover_image",
        d."sort_order",
        d."is_archived",
        d."is_deleted",
        d."latest_revision_id",
        d."created_at",
        d."updated_at",
        d."last_edited_at",
        w."type" AS "workspace_type",
        creator_tm."user_id" AS "creator_user_id",
        latest."content_snapshot" AS "latest_content_snapshot",
        latest."metadata_snapshot" AS "latest_metadata_snapshot"
      FROM "docs" d
      INNER JOIN "workspaces" w
        ON w."id" = d."workspace_id"
      INNER JOIN "team_members" creator_tm
        ON creator_tm."id" = d."creator_member_id"
      LEFT JOIN "doc_revisions" latest
        ON latest."id" = d."latest_revision_id"
      WHERE d."workspace_id" = ${workspaceId}
        AND d."id" = ${docId}
      LIMIT 1
    `);

    if (!docs[0]) {
      throw new NotFoundException('文档不存在');
    }

    return docs[0];
  }

  private resolveWorkspaceRole(workspace: {
    type: WorkspaceType;
    team?: { members?: Array<{ role: Role }> | null } | null;
  }) {
    if (workspace.type === WorkspaceType.PERSONAL) {
      return Role.OWNER;
    }

    return workspace.team?.members?.[0]?.role ?? Role.MEMBER;
  }

  private matchesContext(
    doc: DocRow,
    context: DocContextValue | undefined,
    workspaceType: WorkspaceType,
    teamMemberId: string,
  ) {
    if (!context) {
      return true;
    }

    switch (context) {
      case DocContextValue.PERSONAL:
        return (
          workspaceType === WorkspaceType.PERSONAL &&
          doc.creator_member_id === teamMemberId
        );
      case DocContextValue.TEAM:
        return (
          workspaceType === WorkspaceType.TEAM &&
          doc.visibility !== VisibilityType.PRIVATE
        );
      case DocContextValue.TEAM_PERSONAL:
        return (
          workspaceType === WorkspaceType.TEAM &&
          doc.visibility === VisibilityType.PRIVATE &&
          doc.creator_member_id === teamMemberId
        );
      default:
        return true;
    }
  }

  private canReadDoc(
    doc: DocRow,
    workspaceType: WorkspaceType,
    teamMemberId: string,
    workspaceRole: Role,
  ) {
    if (doc.is_deleted) {
      return false;
    }

    if (workspaceType === WorkspaceType.PERSONAL) {
      return true;
    }

    if (doc.creator_member_id === teamMemberId || doc.owner_member_id === teamMemberId) {
      return true;
    }

    if (workspaceRole === Role.OWNER || workspaceRole === Role.ADMIN) {
      return true;
    }

    return doc.visibility !== VisibilityType.PRIVATE;
  }

  private canWriteDoc(
    doc: DocRow,
    workspaceType: WorkspaceType,
    teamMemberId: string,
    workspaceRole: Role,
  ) {
    if (doc.is_deleted) {
      return false;
    }

    if (workspaceType === WorkspaceType.PERSONAL) {
      return true;
    }

    if (doc.creator_member_id === teamMemberId || doc.owner_member_id === teamMemberId) {
      return true;
    }

    switch (doc.visibility) {
      case VisibilityType.PRIVATE:
        return false;
      case VisibilityType.TEAM_READONLY:
        return workspaceRole === Role.OWNER || workspaceRole === Role.ADMIN;
      case VisibilityType.TEAM_EDITABLE:
        return true;
      case VisibilityType.PUBLIC:
        return workspaceRole === Role.OWNER || workspaceRole === Role.ADMIN;
      default:
        return false;
    }
  }

  private canDeleteDoc(
    doc: DocRow,
    workspaceType: WorkspaceType,
    teamMemberId: string,
    workspaceRole: Role,
  ) {
    if (workspaceType === WorkspaceType.PERSONAL) {
      return true;
    }

    if (doc.creator_member_id === teamMemberId || doc.owner_member_id === teamMemberId) {
      return true;
    }

    return workspaceRole === Role.OWNER || workspaceRole === Role.ADMIN;
  }

  private compareDocs(left: DocRow, right: DocRow) {
    if (left.type === DocTypeValue.FOLDER && right.type !== DocTypeValue.FOLDER) {
      return -1;
    }

    if (left.type !== DocTypeValue.FOLDER && right.type === DocTypeValue.FOLDER) {
      return 1;
    }

    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }

    return this.asDate(left.created_at).getTime() - this.asDate(right.created_at).getTime();
  }

  private toDocReadModel(
    doc: DocRow,
    workspaceType: WorkspaceType,
    teamMemberId: string,
    workspaceRole: Role,
  ) {
    return {
      id: doc.id,
      _id: doc.id,
      title: doc.title,
      type: doc.type === DocTypeValue.FOLDER ? 'folder' : 'document',
      content:
        doc.type === DocTypeValue.DOCUMENT
          ? this.serializeSnapshot(doc.latest_content_snapshot)
          : undefined,
      description: doc.description ?? undefined,
      creatorId: doc.creator_user_id,
      creatorMemberId: doc.creator_member_id,
      ownerMemberId: doc.owner_member_id,
      workspaceId: doc.workspace_id,
      workspaceType,
      projectId: doc.project_id ?? undefined,
      issueId: doc.issue_id ?? undefined,
      workflowId: doc.workflow_id ?? undefined,
      parentDocument: doc.parent_id ?? undefined,
      visibility: doc.visibility,
      isArchived: doc.is_archived,
      isDeleted: doc.is_deleted,
      icon: doc.icon ?? undefined,
      coverImage: doc.cover_image ?? undefined,
      order: doc.sort_order,
      latestRevisionId: doc.latest_revision_id ?? undefined,
      createdAt: this.asDate(doc.created_at).getTime(),
      updatedAt: this.asDate(doc.updated_at).getTime(),
      lastEditedAt: this.asDate(doc.last_edited_at).getTime(),
      canEdit: this.canWriteDoc(doc, workspaceType, teamMemberId, workspaceRole),
      canDelete: this.canDeleteDoc(
        doc,
        workspaceType,
        teamMemberId,
        workspaceRole,
      ),
    };
  }

  private parseSnapshot(snapshot?: string) {
    if (!snapshot) {
      return DEFAULT_DOC_CONTENT;
    }

    try {
      return JSON.parse(snapshot) as unknown;
    } catch (error) {
      throw new BadRequestException('文档内容必须是合法的 JSON 字符串');
    }
  }

  private serializeSnapshot(snapshot: unknown) {
    return JSON.stringify(snapshot ?? DEFAULT_DOC_CONTENT);
  }

  private parseMetadata(metadataSnapshot?: string) {
    if (!metadataSnapshot) {
      return {} as Record<string, unknown>;
    }

    try {
      return (JSON.parse(metadataSnapshot) ?? {}) as Record<string, unknown>;
    } catch (error) {
      throw new BadRequestException('metadataSnapshot 必须是合法的 JSON 字符串');
    }
  }

  private buildMetadataSnapshot(input: {
    title: string;
    icon?: string;
    coverImage?: string;
    visibility: VisibilityType;
  }) {
    return {
      title: input.title,
      icon: input.icon ?? null,
      coverImage: input.coverImage ?? null,
      visibility: input.visibility,
    };
  }

  private pickStringMetadata(
    metadata: Record<string, unknown>,
    key: 'title' | 'icon' | 'coverImage',
  ) {
    const value = metadata[key];

    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private pickVisibilityMetadata(metadata: Record<string, unknown>) {
    const value = metadata.visibility;

    if (
      value === VisibilityType.PRIVATE ||
      value === VisibilityType.TEAM_READONLY ||
      value === VisibilityType.TEAM_EDITABLE ||
      value === VisibilityType.PUBLIC
    ) {
      return value;
    }

    return null;
  }

  private getDefaultVisibility(
    workspaceType: WorkspaceType,
    isFolder: boolean,
  ): VisibilityType {
    if (workspaceType === WorkspaceType.PERSONAL) {
      return VisibilityType.PRIVATE;
    }

    if (isFolder) {
      return VisibilityType.TEAM_EDITABLE;
    }

    return VisibilityType.TEAM_EDITABLE;
  }

  private asDate(value: Date | string) {
    return value instanceof Date ? value : new Date(value);
  }
}
