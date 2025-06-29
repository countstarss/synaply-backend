# Projects API 测试指南

本指南提供了 Projects API 的详细测试说明，包括测试数据准备、API 测试命令和预期结果。

## 目录

1. [测试前准备](#测试前准备)
2. [Projects API 测试](#projects-api-测试)
   - [创建项目](#1-创建项目)
   - [查询工作空间下的所有项目](#2-查询工作空间下的所有项目)
   - [查询项目详情](#3-查询项目详情)
   - [更新项目](#4-更新项目)
   - [删除项目](#5-删除项目)
3. [权限测试](#权限测试)
4. [错误处理测试](#错误处理测试)

## 测试前准备

### 1. 启动服务

```bash
cd synaply-backend
pnpm run start:dev
```

### 2. 获取访问令牌

使用 Supabase 身份验证获取有效的访问令牌。

### 3. 准备测试数据

你需要以下数据进行测试：
- 有效的工作空间 ID（个人或团队工作空间）
- 团队成员 ID（如果测试团队工作空间）
- 访问令牌

## Projects API 测试

### 1. 创建项目

#### 请求示例

```bash
# 在个人工作空间创建项目
curl -X POST http://localhost:3000/workspaces/YOUR_WORKSPACE_ID/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "我的第一个项目",
    "description": "这是一个测试项目"
  }'

# 在团队工作空间创建项目（需要 OWNER 或 ADMIN 权限）
curl -X POST http://localhost:3000/workspaces/TEAM_WORKSPACE_ID/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "团队项目 Alpha",
    "description": "团队协作项目"
  }'
```

#### 预期响应

```json
{
  "id": "generated-project-id",
  "name": "我的第一个项目",
  "description": "这是一个测试项目",
  "workspaceId": "YOUR_WORKSPACE_ID",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### 2. 查询工作空间下的所有项目

#### 请求示例

```bash
curl -X GET "http://localhost:3000/workspaces/YOUR_WORKSPACE_ID/projects" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 预期响应

```json
[
  {
    "id": "project-id-1",
    "name": "我的第一个项目",
    "description": "这是一个测试项目",
    "workspaceId": "YOUR_WORKSPACE_ID",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": "project-id-2",
    "name": "第二个项目",
    "description": null,
    "workspaceId": "YOUR_WORKSPACE_ID",
    "createdAt": "2024-01-02T00:00:00.000Z",
    "updatedAt": "2024-01-02T00:00:00.000Z"
  }
]
```

### 3. 查询项目详情

#### 请求示例

```bash
curl -X GET "http://localhost:3000/workspaces/YOUR_WORKSPACE_ID/projects/PROJECT_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 预期响应

```json
{
  "id": "project-id",
  "name": "我的第一个项目",
  "description": "这是一个测试项目",
  "workspaceId": "YOUR_WORKSPACE_ID",
  "workspace": {
    "id": "YOUR_WORKSPACE_ID",
    "name": "我的工作空间",
    "type": "PERSONAL",
    "userId": "user-id",
    "teamId": null
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### 4. 更新项目

#### 请求示例

```bash
curl -X PATCH "http://localhost:3000/workspaces/YOUR_WORKSPACE_ID/projects/PROJECT_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "更新后的项目名称",
    "description": "更新后的项目描述"
  }'
```

#### 预期响应

```json
{
  "id": "project-id",
  "name": "更新后的项目名称",
  "description": "更新后的项目描述",
  "workspaceId": "YOUR_WORKSPACE_ID",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T01:00:00.000Z"
}
```

### 5. 删除项目

#### 请求示例

```bash
# 注意：只能删除没有关联任务的项目
curl -X DELETE "http://localhost:3000/workspaces/YOUR_WORKSPACE_ID/projects/PROJECT_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 预期响应

```json
{
  "id": "project-id",
  "name": "项目名称",
  "description": "项目描述",
  "workspaceId": "YOUR_WORKSPACE_ID",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## 权限测试

### 个人工作空间权限

1. **所有者权限**：可以创建、查看、更新和删除项目
2. **其他用户**：无权访问

### 团队工作空间权限

1. **OWNER/ADMIN**：可以创建、查看、更新和删除项目
2. **MEMBER**：只能查看项目，不能创建、更新或删除
3. **非团队成员**：无权访问

### 权限测试示例

```bash
# 测试 MEMBER 角色无法创建项目（应返回 403）
curl -X POST http://localhost:3000/workspaces/TEAM_WORKSPACE_ID/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer MEMBER_ACCESS_TOKEN" \
  -d '{
    "name": "尝试创建项目"
  }'

# 预期响应
{
  "statusCode": 403,
  "message": "只有 OWNER 或 ADMIN 可以创建项目"
}
```

## 错误处理测试

### 1. 无效的工作空间 ID

```bash
curl -X POST http://localhost:3000/workspaces/invalid-workspace-id/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "测试项目"
  }'

# 预期响应
{
  "statusCode": 404,
  "message": "工作空间不存在"
}
```

### 2. 删除有关联任务的项目

```bash
curl -X DELETE "http://localhost:3000/workspaces/YOUR_WORKSPACE_ID/projects/PROJECT_WITH_ISSUES_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 预期响应
{
  "statusCode": 400,
  "message": "无法删除项目，还有 X 个关联的任务"
}
```

### 3. 缺少必需字段

```bash
curl -X POST http://localhost:3000/workspaces/YOUR_WORKSPACE_ID/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "description": "缺少名称字段"
  }'

# 预期响应
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

## 与 Issues 集成测试

### 创建属于项目的任务

```bash
curl -X POST "http://localhost:3000/workspaces/WORKSPACE_ID/issues" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "title": "项目任务1",
    "description": "这个任务属于特定项目",
    "projectId": "PROJECT_ID"
  }'
```

### 查询特定项目的任务

```bash
curl -X GET "http://localhost:3000/workspaces/WORKSPACE_ID/issues?projectId=PROJECT_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 注意事项

1. **项目是可选层级**：任务可以直接属于工作空间，也可以属于项目
2. **权限继承**：项目权限继承自工作空间权限
3. **删除限制**：只能删除没有关联任务的项目
4. **项目绑定工作空间**：项目创建后不能移动到其他工作空间

## 测试顺序建议

1. 创建工作空间（如果需要）
2. 创建项目
3. 创建属于项目的任务
4. 查询项目和任务
5. 更新项目信息
6. 尝试删除有任务的项目（应失败）
7. 删除所有任务
8. 删除项目