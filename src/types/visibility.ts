// 与前端保持一致的权限类型定义

export enum VisibilityType {
  PRIVATE = 'PRIVATE',
  TEAM_READONLY = 'TEAM_READONLY',
  TEAM_EDITABLE = 'TEAM_EDITABLE',
  PUBLIC = 'PUBLIC',
}

export interface PermissionContext {
  currentUserId: string;
  currentTeamMemberId: string | null;
  isTeamOwner: boolean;
  isTeamAdmin: boolean;
}

export interface ContentWithVisibility {
  id: string;
  creatorId: string;
  visibility: VisibilityType;
}

/**
 * 权限检查工具类
 */
export class PermissionChecker {
  private context: PermissionContext;

  constructor(context: PermissionContext) {
    this.context = context;
  }

  /**
   * 检查用户是否可以查看内容
   */
  canView(content: ContentWithVisibility): boolean {
    // 创建者总是可以查看
    if (content.creatorId === this.context.currentTeamMemberId) {
      return true;
    }

    // 根据可见性类型判断
    switch (content.visibility) {
      case VisibilityType.PRIVATE:
        return false;
      case VisibilityType.TEAM_READONLY:
      case VisibilityType.TEAM_EDITABLE:
        return this.context.currentTeamMemberId !== null;
      case VisibilityType.PUBLIC:
        return true;
      default:
        return false;
    }
  }

  /**
   * 检查用户是否可以编辑内容
   */
  canEdit(content: ContentWithVisibility): boolean {
    // 创建者总是可以编辑
    if (content.creatorId === this.context.currentTeamMemberId) {
      return true;
    }

    // 根据可见性类型判断
    switch (content.visibility) {
      case VisibilityType.PRIVATE:
      case VisibilityType.TEAM_READONLY:
        return false;
      case VisibilityType.TEAM_EDITABLE:
        return this.context.currentTeamMemberId !== null;
      case VisibilityType.PUBLIC:
        return true;
      default:
        return false;
    }
  }

  /**
   * 检查用户是否可以删除内容
   */
  canDelete(content: ContentWithVisibility): boolean {
    // 只有创建者可以删除
    if (content.creatorId === this.context.currentTeamMemberId) {
      return true;
    }

    // 团队所有者和管理员可以删除团队内容
    if (content.visibility !== VisibilityType.PRIVATE) {
      return this.context.isTeamOwner || this.context.isTeamAdmin;
    }

    return false;
  }

  /**
   * 检查用户是否可以修改内容的可见性
   */
  canChangeVisibility(content: ContentWithVisibility): boolean {
    // 只有创建者可以修改可见性
    return content.creatorId === this.context.currentTeamMemberId;
  }
}

/**
 * 创建权限检查器实例
 */
export function createPermissionChecker(
  context: PermissionContext,
): PermissionChecker {
  return new PermissionChecker(context);
}

/**
 * 权限检查装饰器（用于控制器方法）
 */
export function requirePermission(
  permission: 'view' | 'edit' | 'delete' | 'changeVisibility',
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // 这里需要从请求中获取用户信息和内容信息
      // 实际实现会根据具体的控制器结构来调整
      const result = await originalMethod.apply(this, args);
      return result;
    };

    return descriptor;
  };
}
