import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamMemberService } from '../common/services/team-member.service';
import { CreateIssueStateDto, UpdateIssueStateDto } from './dto';
import { IssueStateCategory } from '../../prisma/generated/prisma/enums';

// 默认状态配置
const DEFAULT_STATES = [
  {
    name: 'Backlog',
    color: '#6B7280',
    category: IssueStateCategory.BACKLOG,
    position: 0,
  },
  {
    name: 'Todo',
    color: '#3B82F6',
    category: IssueStateCategory.TODO,
    position: 1,
    isDefault: true,
  },
  {
    name: 'In Progress',
    color: '#F59E0B',
    category: IssueStateCategory.IN_PROGRESS,
    position: 2,
  },
  {
    name: 'Done',
    color: '#10B981',
    category: IssueStateCategory.DONE,
    position: 3,
  },
  {
    name: 'Canceled',
    color: '#EF4444',
    category: IssueStateCategory.CANCELED,
    position: 4,
  },
];

@Injectable()
export class IssueStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamMemberService: TeamMemberService,
  ) {}

  /**
   * 为 workspace 初始化默认状态
   * 在创建 workspace 时调用，或者在首次访问 issue states 时自动创建
   */
  async initializeDefaultStates(workspaceId: string) {
    const existingStates = await this.prisma.issueState.findMany({
      where: { workspaceId },
    });

    if (existingStates.length > 0) {
      return existingStates;
    }

    const createdStates = await this.prisma.$transaction(
      DEFAULT_STATES.map((state) =>
        this.prisma.issueState.create({
          data: {
            workspaceId,
            ...state,
          },
        }),
      ),
    );

    return createdStates;
  }

  /**
   * 获取 workspace 的所有状态
   */
  async findAll(workspaceId: string, userId: string) {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    // 如果没有状态，自动初始化默认状态
    const states = await this.prisma.issueState.findMany({
      where: { workspaceId, isArchived: false },
      orderBy: { position: 'asc' },
    });

    if (states.length === 0) {
      return this.initializeDefaultStates(workspaceId);
    }

    return states;
  }

  /**
   * 获取单个状态
   */
  async findOne(id: string, userId: string) {
    const state = await this.prisma.issueState.findUnique({
      where: { id },
      include: { workspace: true },
    });

    if (!state) {
      throw new NotFoundException(`IssueState with id ${id} not found`);
    }

    await this.teamMemberService.validateWorkspaceAccess(
      userId,
      state.workspaceId,
    );

    return state;
  }

  /**
   * 创建新状态
   */
  async create(workspaceId: string, userId: string, dto: CreateIssueStateDto) {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    // 如果设置为默认状态，先取消其他默认状态
    if (dto.isDefault) {
      await this.prisma.issueState.updateMany({
        where: { workspaceId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // 获取最大 position
    const maxPosition = await this.prisma.issueState.aggregate({
      where: { workspaceId },
      _max: { position: true },
    });

    return this.prisma.issueState.create({
      data: {
        workspaceId,
        name: dto.name,
        color: dto.color ?? '#6B7280',
        category: dto.category ?? IssueStateCategory.TODO,
        position: dto.position ?? (maxPosition._max.position ?? -1) + 1,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  /**
   * 更新状态
   */
  async update(id: string, userId: string, dto: UpdateIssueStateDto) {
    const state = await this.findOne(id, userId);

    // 如果设置为默认状态，先取消其他默认状态
    if (dto.isDefault) {
      await this.prisma.issueState.updateMany({
        where: {
          workspaceId: state.workspaceId,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    return this.prisma.issueState.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * 删除状态（软删除）
   */
  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    // 检查是否有 issue 使用此状态
    const issueCount = await this.prisma.issue.count({
      where: { stateId: id },
    });

    if (issueCount > 0) {
      // 软删除
      return this.prisma.issueState.update({
        where: { id },
        data: { isArchived: true },
      });
    }

    // 硬删除
    return this.prisma.issueState.delete({
      where: { id },
    });
  }

  /**
   * 获取 workspace 的默认状态
   */
  async getDefaultState(workspaceId: string) {
    let defaultState = await this.prisma.issueState.findFirst({
      where: { workspaceId, isDefault: true, isArchived: false },
    });

    if (!defaultState) {
      // 如果没有默认状态，初始化并返回默认状态
      const states = await this.initializeDefaultStates(workspaceId);
      defaultState = states.find((s) => s.isDefault) ?? states[0];
    }

    return defaultState;
  }

  /**
   * 根据 category 获取状态（用于 workflow 状态映射）
   */
  async getStateByCategory(workspaceId: string, category: IssueStateCategory) {
    let state = await this.prisma.issueState.findFirst({
      where: { workspaceId, category, isArchived: false },
      orderBy: { position: 'asc' },
    });

    if (!state) {
      // 初始化默认状态
      const states = await this.initializeDefaultStates(workspaceId);
      state = states.find((s) => s.category === category) ?? states[0];
    }

    return state;
  }
}
