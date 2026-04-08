import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto, FindCommentsDto } from './dto';
import { CommentDto } from './dto/comment.dto';
import { TeamMemberService } from '../common/services/team-member.service';
import { PermissionService } from '../common/services/permission.service';

@Injectable()
export class CommentService {
  constructor(
    private prisma: PrismaService,
    private teamMemberService: TeamMemberService,
    private permissionService: PermissionService,
  ) {}

  private async validateIssueAccess(
    userId: string,
    issueId: string,
    workspaceId?: string,
  ) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      select: {
        id: true,
        workspaceId: true,
      },
    });

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${issueId} not found`);
    }

    if (workspaceId && issue.workspaceId !== workspaceId) {
      throw new NotFoundException(
        `Issue with ID ${issueId} not found in workspace ${workspaceId}`,
      );
    }

    await this.permissionService.validateResourcePermission(
      userId,
      'issue',
      issueId,
      'read',
    );

    return issue;
  }

  /**
   * 创建评论
   * @param createCommentDto
   * @param authorId 作者ID（TeamMember ID）
   */
  async create(
    createCommentDto: CreateCommentDto,
    userId: string,
  ): Promise<CommentDto> {
    const issue = await this.validateIssueAccess(
      userId,
      createCommentDto.issueId,
      createCommentDto.workspaceId,
    );

    // 如果有parentId，检查父评论是否存在
    if (createCommentDto.parentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: createCommentDto.parentId },
        select: {
          id: true,
          issueId: true,
          workspaceId: true,
        },
      });

      if (!parentComment) {
        throw new NotFoundException(
          `Parent comment with ID ${createCommentDto.parentId} not found`,
        );
      }

      if (
        parentComment.issueId !== issue.id ||
        parentComment.workspaceId !== issue.workspaceId
      ) {
        throw new NotFoundException(
          `Parent comment with ID ${createCommentDto.parentId} does not belong to this issue`,
        );
      }
    }

    const authorId = await this.teamMemberService.getTeamMemberIdByWorkspace(
      userId,
      issue.workspaceId,
    );

    // 创建评论
    const comment = await this.prisma.comment.create({
      data: {
        content: createCommentDto.content,
        workspaceId: issue.workspaceId,
        issue: { connect: { id: createCommentDto.issueId } },
        author: { connect: { id: authorId } },
        ...(createCommentDto.parentId
          ? { parentId: createCommentDto.parentId }
          : {}),
      } as any,
      include: {
        author: {
          include: {
            user: {
              select: {
                email: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    return this.mapToDto(comment);
  }

  /**
   * 查找评论列表
   * @param findCommentsDto
   */
  async findAll(
    findCommentsDto: FindCommentsDto,
    userId: string,
  ): Promise<CommentDto[]> {
    const { issueId, parentId, workspaceId } = findCommentsDto;
    const issue = await this.validateIssueAccess(userId, issueId, workspaceId);

    const comments = await this.prisma.comment.findMany({
      where: {
        issueId,
        workspaceId: issue.workspaceId,
        parentId: parentId || null, // 如果没有指定parentId，则返回顶级评论
      },
      include: {
        author: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return comments.map((comment) => this.mapToDto(comment));
  }

  /**
   * 将Prisma评论对象映射为DTO
   */
  private mapToDto(comment: any): CommentDto {
    return {
      id: comment.id,
      content: comment.content,
      issueId: comment.issueId,
      authorId: comment.authorId,
      parentId: comment.parentId,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: {
        id: comment.author.id,
        name:
          comment.author.user?.name ||
          comment.author.user?.email?.split('@')[0] ||
          '未知用户',
        email: comment.author.user?.email,
        avatarUrl: comment.author.user?.avatarUrl,
      },
    };
  }
}
