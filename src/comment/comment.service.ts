import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto, FindCommentsDto } from './dto';
import { CommentDto } from './dto/comment.dto';
import { TeamMemberService } from '../common/services/team-member.service';

@Injectable()
export class CommentService {
  constructor(
    private prisma: PrismaService,
    private teamMemberService: TeamMemberService,
  ) {}

  /**
   * 创建评论
   * @param createCommentDto
   * @param authorId 作者ID（TeamMember ID）
   */
  async create(
    createCommentDto: CreateCommentDto,
    userId: string,
    // workspaceId: string,
  ): Promise<CommentDto> {
    // 检查issue是否存在
    const issue = await this.prisma.issue.findUnique({
      where: { id: createCommentDto.issueId },
    });

    if (!issue) {
      throw new NotFoundException(
        `Issue with ID ${createCommentDto.issueId} not found`,
      );
    }

    // 如果有parentId，检查父评论是否存在
    if (createCommentDto.parentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: createCommentDto.parentId },
      });

      if (!parentComment) {
        throw new NotFoundException(
          `Parent comment with ID ${createCommentDto.parentId} not found`,
        );
      }
    }

    const authorId = await this.teamMemberService.getTeamMemberIdByWorkspace(
      userId,
      createCommentDto.workspaceId,
    );

    // 创建评论
    const comment = await this.prisma.comment.create({
      data: {
        content: createCommentDto.content,
        workspaceId: createCommentDto.workspaceId,
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
  async findAll(findCommentsDto: FindCommentsDto): Promise<CommentDto[]> {
    const { issueId, parentId } = findCommentsDto;

    const comments = await this.prisma.comment.findMany({
      where: {
        issueId,
        parentId: parentId || null, // 如果没有指定parentId，则返回顶级评论
      },
      include: {
        author: {
          include: {
            user: {
              select: {
                name: true,
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
        name: comment.author.user?.name,
        avatarUrl: comment.author.user?.avatarUrl,
      },
    };
  }
}
