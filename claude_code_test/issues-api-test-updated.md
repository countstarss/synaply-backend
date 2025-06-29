# Issues API 测试指南（更新版）

本指南提供了支持项目功能的 Issues API 详细测试说明。

## 更新内容

- 支持可选的 `projectId` 字段
- 支持按项目筛选任务
- 返回结果中包含项目信息

## 测试前准备

1. **服务运行中**: 确保你的 Nest.js 后端服务正在运行 (`pnpm run start:dev`)
2. **获取认证 Token**: 你需要一个有效的 `access_token` 来通过认证
3. **获取必要 ID**:
   - 从 `workspaces` 表中获取一个有效的 `workspaceId`
   - 从 `projects` 表中获取一个有效的 `projectId`（可选）
   - 从 `team_members` 表中获取有效的 `teamMemberId`
   - 如果测试工作流，需要从 `workflows` 表中获取 `PUBLISHED` 状态的 `workflowId`

## 主要变更

### 1. 创建任务时支持 projectId

#### 创建属于项目的任务

```bash
curl -X POST "http://localhost:3000/workspaces/{workspaceId}/issues" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "title": "实现用户认证功能",
    "description": "完成登录、注册、密码重置功能",
    "projectId": "YOUR_PROJECT_ID",
    "directAssigneeId": "YOUR_TEAM_MEMBER_ID",
    "priority": "HIGH",
    "dueDate": "2025-07-15T00:00:00.000Z"
  }'
```

#### 创建不属于任何项目的任务（直接在工作空间下）

```bash
curl -X POST "http://localhost:3000/workspaces/{workspaceId}/issues" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "title": "临时任务 - 修复紧急bug",
    "description": "修复生产环境的紧急问题",
    "directAssigneeId": "YOUR_TEAM_MEMBER_ID",
    "priority": "URGENT"
  }'
```

### 2. 按项目筛选任务

#### 获取特定项目的所有任务

```bash
curl -X GET "http://localhost:3000/workspaces/{workspaceId}/issues?projectId={projectId}" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 获取工作空间下所有任务（包括有项目和无项目的）

```bash
curl -X GET "http://localhost:3000/workspaces/{workspaceId}/issues" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 3. 响应格式更新

任务响应中新增了 `project` 字段：

```json
{
  "id": "issue-id",
  "title": "实现用户认证功能",
  "description": "完成登录、注册、密码重置功能",
  "workspaceId": "workspace-id",
  "projectId": "project-id",
  "project": {
    "id": "project-id",
    "name": "用户系统重构",
    "description": "重构整个用户认证和授权系统",
    "workspaceId": "workspace-id",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "status": "TODO",
  "priority": "HIGH",
  "creator": {
    "id": "creator-id",
    "user": {
      "id": "user-id",
      "email": "creator@example.com",
      "name": "创建者"
    }
  },
  "directAssignee": {
    "id": "assignee-id",
    "user": {
      "id": "user-id",
      "email": "assignee@example.com",
      "name": "负责人"
    }
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## 完整测试示例

### 场景 1: 项目任务管理流程

```bash
# 1. 创建项目
curl -X POST http://localhost:3000/workspaces/YOUR_WORKSPACE_ID/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "Q1产品迭代",
    "description": "2025年第一季度产品功能迭代"
  }'

# 2. 在项目中创建多个任务
curl -X POST "http://localhost:3000/workspaces/YOUR_WORKSPACE_ID/issues" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "title": "前端UI改版",
    "projectId": "PROJECT_ID_FROM_STEP_1",
    "priority": "HIGH"
  }'

curl -X POST "http://localhost:3000/workspaces/YOUR_WORKSPACE_ID/issues" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "title": "后端API优化",
    "projectId": "PROJECT_ID_FROM_STEP_1",
    "priority": "NORMAL"
  }'

# 3. 查询项目下的所有任务
curl -X GET "http://localhost:3000/workspaces/YOUR_WORKSPACE_ID/issues?projectId=PROJECT_ID_FROM_STEP_1" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 4. 查询特定任务详情（包含项目信息）
curl -X GET "http://localhost:3000/workspaces/YOUR_WORKSPACE_ID/issues/ISSUE_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 场景 2: 混合任务管理（有项目和无项目）

```bash
# 1. 创建无项目归属的紧急任务
curl -X POST "http://localhost:3000/workspaces/YOUR_WORKSPACE_ID/issues" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "title": "修复生产环境崩溃问题",
    "description": "紧急修复",
    "priority": "URGENT",
    "directAssigneeId": "YOUR_TEAM_MEMBER_ID"
  }'

# 2. 查询工作空间下所有任务（会包含有项目和无项目的任务）
curl -X GET "http://localhost:3000/workspaces/YOUR_WORKSPACE_ID/issues" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 数据展示建议

基于新的项目层级，建议前端按以下方式组织任务显示：

```
工作空间 A（开发组）
├── 无项目归属的任务
│   ├── 修复生产环境崩溃问题 (URGENT)
│   └── 临时代码审查 (LOW)
├── 项目：Q1产品迭代
│   ├── 前端UI改版 (HIGH)
│   ├── 后端API优化 (NORMAL)
│   └── 数据库性能优化 (HIGH)
└── 项目：技术债务清理
    ├── 重构旧代码 (NORMAL)
    └── 升级依赖包 (LOW)
```

## 注意事项

1. **projectId 是可选的**：任务可以不属于任何项目，直接在工作空间下创建
2. **项目必须属于同一工作空间**：创建任务时，projectId 对应的项目必须属于 workspaceId 指定的工作空间
3. **删除项目限制**：如果项目下有任务，则无法删除该项目
4. **权限继承**：任务的权限检查基于工作空间权限，不受项目影响

## 向后兼容性

- 所有现有的 Issues API 保持向后兼容
- `projectId` 字段是可选的，不会影响现有功能
- 不传递 `projectId` 参数时，查询会返回所有任务（包括有项目和无项目的）