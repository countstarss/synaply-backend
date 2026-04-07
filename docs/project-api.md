# Project 模块前端对接文档

## 概述

Project 模块用于管理工作空间下的项目分组。

当前后端已提供完整 REST CRUD，并已接入以下业务规则：

1. Project 归属于单个 `workspace`
2. Issue 可以不属于任何 Project，也可以通过 `projectId` 归属于某个 Project
3. 删除 Project 时，会级联删除该 Project 下的所有 Issues
4. 创建或更新 Issue 时，如果传入 `projectId`，后端会校验该 Project 必须属于同一个 `workspace`

本文档面向前端开发，重点说明当前可用接口、数据结构、权限规则，以及删除确认交互的实现要求。

---

## 认证

所有接口都需要携带：

```http
Authorization: Bearer <YOUR_SUPABASE_JWT>
```

所有接口都通过路径参数 `workspaceId` 做工作空间隔离。

---

## 一、REST API

### 1. 创建 Project

- **POST** `/workspaces/:workspaceId/projects`

#### 请求体

```ts
type CreateProjectDto = {
  name: string;
  description?: string;
  visibility?: 'PRIVATE' | 'TEAM_READONLY' | 'TEAM_EDITABLE' | 'PUBLIC';
};
```

#### 说明

- `name` 必填
- `description` 可选
- `visibility` 可选
- 如果不传 `visibility`：
  - 团队工作空间默认 `TEAM_READONLY`
  - 个人工作空间默认 `PRIVATE`

#### 响应示例

```json
{
  "id": "project_123",
  "name": "Q2 Launch",
  "description": "Launch coordination",
  "workspaceId": "workspace_123",
  "creatorId": "team_member_123",
  "visibility": "TEAM_READONLY",
  "createdAt": "2026-04-07T10:00:00.000Z",
  "updatedAt": "2026-04-07T10:00:00.000Z"
}
```

---

### 2. 获取 Project 列表

- **GET** `/workspaces/:workspaceId/projects`

#### 响应示例

```json
[
  {
    "id": "project_123",
    "name": "Q2 Launch",
    "description": "Launch coordination",
    "workspaceId": "workspace_123",
    "creatorId": "team_member_123",
    "visibility": "TEAM_READONLY",
    "createdAt": "2026-04-07T10:00:00.000Z",
    "updatedAt": "2026-04-07T10:00:00.000Z"
  }
]
```

#### 当前返回特点

- 按 `createdAt desc` 排序
- 当前列表接口不会附带 issue 数量
- 当前列表接口不会附带 `workspace` 对象

---

### 3. 获取 Project 详情

- **GET** `/workspaces/:workspaceId/projects/:id`

#### 响应示例

```json
{
  "id": "project_123",
  "name": "Q2 Launch",
  "description": "Launch coordination",
  "workspaceId": "workspace_123",
  "creatorId": "team_member_123",
  "visibility": "TEAM_READONLY",
  "createdAt": "2026-04-07T10:00:00.000Z",
  "updatedAt": "2026-04-07T10:00:00.000Z",
  "workspace": {
    "id": "workspace_123",
    "name": "Synaply",
    "type": "TEAM"
  }
}
```

#### 当前返回特点

- 详情接口会附带 `workspace`
- 当前详情接口不会附带 issues 列表

---

### 4. 更新 Project

- **PATCH** `/workspaces/:workspaceId/projects/:id`

#### 请求体

```ts
type UpdateProjectDto = {
  name?: string;
  description?: string;
  visibility?: 'PRIVATE' | 'TEAM_READONLY' | 'TEAM_EDITABLE' | 'PUBLIC';
};
```

#### 说明

- 支持部分更新
- 不支持修改 `workspaceId`
- 不支持通过 Project 接口直接批量更新该项目下的 issues

---

### 5. 删除 Project

- **DELETE** `/workspaces/:workspaceId/projects/:id`

#### 后端删除规则

调用删除接口后，后端会：

1. 找出所有 `projectId = 当前项目 id` 的 issues
2. 删除这些 issues 关联的：
   - `comments`
   - `issueActivities`
   - `issueStepRecords`
3. 删除这些 issues 本身
4. 删除 project

#### 响应示例

```json
{
  "id": "project_123",
  "name": "Q2 Launch",
  "description": "Launch coordination",
  "workspaceId": "workspace_123",
  "creatorId": "team_member_123",
  "visibility": "TEAM_READONLY",
  "createdAt": "2026-04-07T10:00:00.000Z",
  "updatedAt": "2026-04-07T10:00:00.000Z",
  "deletedIssueCount": 8
}
```

#### 重要说明

- 当前删除行为是“级联删除 Issues”，不是“禁止删除”
- 当前级联删除是在服务层事务里手动执行的，不是数据库 `onDelete: Cascade`
- 对前端而言，效果等价于“删除项目会一起删除该项目下全部 issues”

---

## 二、Project 数据结构

前端可以按下面这个接口建类型：

```ts
export type ProjectVisibility =
  | 'PRIVATE'
  | 'TEAM_READONLY'
  | 'TEAM_EDITABLE'
  | 'PUBLIC';

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  workspaceId: string;
  creatorId: string;
  visibility: ProjectVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends Project {
  workspace?: {
    id: string;
    name: string;
    type: 'PERSONAL' | 'TEAM';
  };
}

export interface DeleteProjectResult extends Project {
  deletedIssueCount: number;
}
```

---

## 三、权限规则

### 1. 读取权限

- 个人工作空间：只有 workspace 所有人可读
- 团队工作空间：所有团队成员可读

### 2. 创建 / 更新 / 删除权限

- 个人工作空间：workspace 所有人可操作
- 团队工作空间：只有 `OWNER` / `ADMIN` 可操作
- 团队空间中的普通 `MEMBER` 只能查看，不能创建、更新、删除

### 3. 关于 `visibility` 字段的当前状态

这个点前端要特别注意：

- `visibility` 目前已经存储在 Project 上
- 但当前 Project REST 接口的读写权限，并不是严格按 `visibility` 做资源级过滤
- 当前项目接口的权限判断主要还是基于：
  - 用户是否属于该 workspace
  - 在团队 workspace 中是否为 `OWNER` / `ADMIN`

换句话说：

- 前端可以展示和编辑 `visibility`
- 但不要假设 `PRIVATE` Project 现在会像 Issue 一样自动对团队成员隐藏

如果后续产品要把 Project 的可见性做成真正的资源级权限，需要后端再补一层细化权限逻辑。

---

## 四、与 Issue 模块的联动

### 1. Issue 可选归属 Project

Issue 创建/更新时可传：

```ts
projectId?: string;
```

### 2. 工作空间一致性校验

如果前端在创建或更新 Issue 时传了 `projectId`，后端会校验：

- 该 Project 必须存在
- 该 Project 必须属于当前 `workspaceId`

如果不满足，会返回错误。

### 3. 前端实现建议

- Project 选择器只展示当前 workspace 下的 projects
- 切换 workspace 时，Project 选择器必须重新拉取
- 不要把 A workspace 的 projectId 带到 B workspace 的 issue 创建请求里

### 4. 获取某个 Project 下的 Issues

前端可以直接复用 Issue 列表接口：

- **GET** `/workspaces/:workspaceId/issues?projectId=:projectId`

这也可以用于：

- Project 详情页展示该项目下任务列表
- 删除弹窗里展示“将被删除的任务数量”

---

## 五、前端删除确认交互要求

这是当前产品规则，前端需要按这个规则实现交互：

### 必须有危险确认弹窗

点击删除 Project 后，不要直接调用删除接口，必须先弹确认框。

### 弹窗内必须明确提示

建议文案至少包含这层意思：

> 删除项目后，该项目内的所有 issues 都会被永久删除，此操作不可恢复。

### 必须要求用户手动输入 Project 名称

前端需要要求用户再次输入一次当前 Project 的 `name`。

只有当输入内容和项目名完全一致时，才允许点击最终确认按钮。

### 后端当前不会校验“输入的名称”

这一点要注意：

- 当前后端删除接口不接收“确认名称”
- 名称二次确认是前端交互层规则
- 所以这个校验需要由前端自己完成

### 推荐的前端删除流程

1. 用户点击删除 Project
2. 打开危险弹窗
3. 弹窗中展示 Project 名称
4. 明确提示“该项目下所有 issues 都将被删除”
5. 用户输入 Project 名称
6. 前端校验输入完全匹配
7. 匹配后才允许点击“确认删除”
8. 调用 `DELETE /workspaces/:workspaceId/projects/:id`
9. 成功后：
   - 从本地 project 列表移除该项目
   - 刷新 issue 列表 / board / project page
   - 可用返回的 `deletedIssueCount` 做 toast 提示

### 推荐的成功提示

```text
项目已删除，同时删除了 8 个相关任务
```

---

## 六、前端注意事项汇总

1. 当前 Project 模块是 REST API，可直接接，不需要等 GraphQL。
2. `DELETE project` 会级联删除所有相关 issues，不再是旧规则里的“有 issues 就禁止删除”。
3. 删除确认里的“输入项目名”必须由前端实现，后端目前不做这层校验。
4. 如果前端想在删除前显示将被影响的 issue 数量，可以先请求：
   - `GET /workspaces/:workspaceId/issues?projectId=:projectId`
5. `visibility` 字段已经可用，但当前 Project 接口权限不是完全按 `visibility` 做资源级控制。
6. 创建和更新 Issue 时，传入的 `projectId` 必须属于同一个 workspace。
7. 当前 Project 列表和详情接口都不返回 issue 数量；如果产品需要高效展示数量，后续可以再补聚合字段。

---

## 七、建议的前端接口封装

```ts
export async function getProjects(workspaceId: string): Promise<Project[]> {
  return api.get(`/workspaces/${workspaceId}/projects`);
}

export async function getProject(
  workspaceId: string,
  projectId: string,
): Promise<ProjectDetail> {
  return api.get(`/workspaces/${workspaceId}/projects/${projectId}`);
}

export async function createProject(
  workspaceId: string,
  body: {
    name: string;
    description?: string;
    visibility?: ProjectVisibility;
  },
): Promise<Project> {
  return api.post(`/workspaces/${workspaceId}/projects`, body);
}

export async function updateProject(
  workspaceId: string,
  projectId: string,
  body: {
    name?: string;
    description?: string;
    visibility?: ProjectVisibility;
  },
): Promise<Project> {
  return api.patch(`/workspaces/${workspaceId}/projects/${projectId}`, body);
}

export async function deleteProject(
  workspaceId: string,
  projectId: string,
): Promise<DeleteProjectResult> {
  return api.delete(`/workspaces/${workspaceId}/projects/${projectId}`);
}
```
