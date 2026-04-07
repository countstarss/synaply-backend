# Issue / IssueState / Comment API 对接文档

本文基于当前后端代码整理，适合作为前端对接依据。

对应代码范围：

- `src/issue/issue.controller.ts`
- `src/issue/issue.service.ts`
- `src/issue-state/issue-state.controller.ts`
- `src/issue-state/issue-state.service.ts`
- `src/comment/comment.controller.ts`
- `src/comment/comment.service.ts`
- `prisma/schema.prisma`

## 1. 先说结论

旧版 `docs/issue-api.md` 不是基于当前升级后的 issue state 实现写的，已经明显过期，主要问题有：

- 旧文档把 Issue 状态写成了旧式固定字段，没有覆盖独立的 `IssueState` 资源。
- 旧文档写了嵌套评论和依赖接口，但当前 REST 实现并不是这样。
- 旧文档里的创建、删除、返回结构、筛选条件都和当前代码不一致。

当前前端对接应以这份文档为准。

## 2. 基础信息

### 2.1 Base URL

本地开发默认端口：

```txt
http://localhost:5678
```

Swagger 地址：

```txt
http://localhost:5678/api
```

### 2.2 认证

除非特别说明，以下接口都要求登录态，请在请求头中携带：

```http
Authorization: Bearer <SUPABASE_JWT>
Content-Type: application/json
```

### 2.3 ID 类型说明

前端对接时要特别注意几种 ID 不是一回事：

- `userId`: Supabase 用户 ID
- `teamMemberId`: 团队成员 ID
- `workspaceId`: 工作空间 ID
- `issueId`: Issue ID
- `stateId`: IssueState ID

其中：

- `Issue.assigneeIds[]`、`Issue.directAssigneeId`、列表筛选里的 `assigneeId` 都按当前实现理解为 `teamMemberId`
- `IssueStepRecord.assigneeId` 创建时传的是 `userId`，服务端会再换算成 `teamMemberId`

## 3. 当前状态模型

### 3.1 现在有两套“状态”

当前后端里和“状态”相关的字段分成两类：

#### A. `Issue.stateId`

这是当前普通 Issue 的主状态，关联的是独立表 `IssueState`。

适合前端看板、列表筛选、状态列展示。

#### B. `Issue.currentStepStatus`

这是工作流 Issue 当前步骤的状态，类型是 `IssueStatus` 枚举。

它只用于 workflow step 语义，不等价于看板主状态，不建议前端拿它替代 `stateId`。

### 3.2 IssueStateCategory 枚举

`IssueState.category` 可选值：

- `BACKLOG`
- `TODO`
- `IN_PROGRESS`
- `DONE`
- `CANCELED`

这个字段更适合聚合、筛选、统计，不一定直接等于 UI 展示文案。

### 3.3 IssueStatus 枚举

这个枚举只用于 workflow step：

- `TODO`
- `IN_PROGRESS`
- `AMOST_DONE`
- `BLOCKED`
- `DONE`

注意：这里的 `AMOST_DONE` 是代码里当前真实拼写，不是文档笔误。

### 3.4 其他常用枚举

#### IssuePriority

- `LOW`
- `NORMAL`
- `HIGH`
- `URGENT`

#### IssueType

- `NORMAL`
- `WORKFLOW`

#### VisibilityType

- `PRIVATE`
- `TEAM_READONLY`
- `TEAM_EDITABLE`
- `PUBLIC`

## 4. IssueState 默认初始化规则

第一次获取某个 workspace 的 issue states 时，如果该 workspace 下还没有任何状态，后端会自动创建一组默认状态：

| position | name | color | category | isDefault |
| --- | --- | --- | --- | --- |
| 0 | `Backlog` | `#6B7280` | `BACKLOG` | `false` |
| 1 | `Todo` | `#3B82F6` | `TODO` | `true` |
| 2 | `In Progress` | `#F59E0B` | `IN_PROGRESS` | `false` |
| 3 | `Done` | `#10B981` | `DONE` | `false` |
| 4 | `Canceled` | `#EF4444` | `CANCELED` | `false` |

也就是说：

- 前端首次进入工作空间时，可以先请求一次 `GET /workspaces/:workspaceId/issue-states`
- 如果后端此前没有任何状态，这个接口会直接返回自动初始化后的默认状态列表
- 普通 Issue 创建时如果不传 `stateId`，也会自动落到默认状态

## 5. 推荐的前端对接顺序

建议前端按下面流程接入：

1. 页面进入 workspace 时先拉取 `issue-states`
2. 用 `position` 排序渲染列，用 `id` 作为状态切换值
3. 创建普通 Issue 时优先传 `stateId`
4. 如果创建时不传 `stateId`，后端会自动使用默认状态
5. 列表页筛选优先使用 `stateId`，聚合筛选可使用 `stateCategory`
6. 评论走独立 `/comments` 接口，不要再用旧的嵌套评论路径
7. 当前 REST 没有可用的 issue dependency 接口，不要按旧文档对接

## 6. IssueState 接口

### 6.1 获取状态列表

```http
GET /workspaces/:workspaceId/issue-states
```

用途：

- 获取当前 workspace 下所有未归档状态
- 如果当前 workspace 没有状态，会自动初始化默认状态

响应示例：

```json
[
  {
    "id": "state_1",
    "workspaceId": "ws_1",
    "name": "Todo",
    "color": "#3B82F6",
    "category": "TODO",
    "position": 1,
    "isDefault": true,
    "isArchived": false,
    "createdAt": "2026-04-08T10:00:00.000Z",
    "updatedAt": "2026-04-08T10:00:00.000Z"
  }
]
```

说明：

- 正常情况下只返回 `isArchived = false` 的状态
- 返回结果已按 `position asc` 排序

### 6.2 创建状态

```http
POST /workspaces/:workspaceId/issue-states
```

请求体：

```json
{
  "name": "Ready for QA",
  "color": "#8B5CF6",
  "category": "IN_PROGRESS",
  "position": 5,
  "isDefault": false
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | `string` | 是 | 状态名，workspace 内唯一 |
| `color` | `string` | 否 | 颜色，默认 `#6B7280` |
| `category` | `IssueStateCategory` | 否 | 默认 `TODO` |
| `position` | `number` | 否 | 不传时自动追加到最后 |
| `isDefault` | `boolean` | 否 | 为 `true` 时会取消其他默认状态 |

返回：

- `201 Created`
- 返回新建后的完整 `IssueState`

### 6.3 获取单个状态

```http
GET /workspaces/:workspaceId/issue-states/:id
```

返回值会额外包含 `workspace` 关系。

### 6.4 更新状态

```http
PATCH /workspaces/:workspaceId/issue-states/:id
```

请求体示例：

```json
{
  "name": "Doing",
  "color": "#F59E0B",
  "category": "IN_PROGRESS",
  "position": 2,
  "isDefault": true,
  "isArchived": false
}
```

说明：

- 所有字段都可选
- 如果把某个状态设为 `isDefault: true`，同 workspace 下其他默认状态会被自动取消
- 可以通过 `isArchived` 做手动归档/恢复

### 6.5 删除状态

```http
DELETE /workspaces/:workspaceId/issue-states/:id
```

当前实现不是 `204 No Content`，而是 `200 OK` 并返回一个对象。

删除逻辑分两种：

- 如果没有任何 Issue 使用该状态：硬删除
- 如果仍有 Issue 正在使用该状态：软删除，返回 `isArchived: true`

前端建议：

- 删除成功后重新拉一次 `issue-states`
- 不要假设删除后一定彻底消失

## 7. Issue 接口

### 7.1 创建普通 Issue

```http
POST /workspaces/:workspaceId/issues/direct-assignee
```

请求体示例：

```json
{
  "title": "修复登录页按钮样式",
  "description": "按钮 hover 状态和设计稿不一致",
  "stateId": "state_todo",
  "projectId": "project_1",
  "directAssigneeId": "team_member_1",
  "priority": "HIGH",
  "visibility": "TEAM_EDITABLE",
  "dueDate": "2026-04-12T00:00:00.000Z",
  "assigneeIds": ["team_member_1", "team_member_2"],
  "labelIds": ["label_bug", "label_ui"]
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | `string` | 是 | 标题 |
| `description` | `string` | 否 | 描述 |
| `stateId` | `string` | 否 | 主状态 ID；不传则自动取默认状态 |
| `projectId` | `string` | 否 | 项目 ID，必须属于当前 workspace |
| `directAssigneeId` | `string` | 否 | 团队成员 ID |
| `priority` | `IssuePriority` | 否 | 默认 `NORMAL` |
| `visibility` | `VisibilityType` | 否 | 默认 `TEAM_EDITABLE` |
| `dueDate` | ISO 日期字符串 | 否 | 截止时间 |
| `assigneeIds` | `string[]` | 否 | 团队成员 ID 列表 |
| `labelIds` | `string[]` | 否 | 标签 ID 列表 |

说明：

- 路径中已经有 `workspaceId`，前端无需再信任 body 里的 `workspaceId`
- 服务端会生成 `key` 和 `sequence`
- 创建成功后，返回的是一个带关联信息的完整 Issue

返回示例：

```json
{
  "id": "issue_1",
  "key": "SYN-12",
  "sequence": 12,
  "title": "修复登录页按钮样式",
  "description": "按钮 hover 状态和设计稿不一致",
  "workspaceId": "ws_1",
  "projectId": "project_1",
  "directAssigneeId": "team_member_1",
  "creatorId": "team_member_creator",
  "creatorMemberId": "team_member_creator",
  "stateId": "state_todo",
  "visibility": "TEAM_EDITABLE",
  "priority": "HIGH",
  "issueType": "NORMAL",
  "createdAt": "2026-04-08T10:00:00.000Z",
  "updatedAt": "2026-04-08T10:00:00.000Z",
  "state": {
    "id": "state_todo",
    "name": "Todo",
    "color": "#3B82F6",
    "category": "TODO",
    "position": 1,
    "isDefault": true,
    "isArchived": false,
    "workspaceId": "ws_1",
    "createdAt": "2026-04-08T10:00:00.000Z",
    "updatedAt": "2026-04-08T10:00:00.000Z"
  },
  "project": {
    "id": "project_1",
    "name": "Web App",
    "description": null,
    "workspaceId": "ws_1",
    "creatorId": "team_member_creator",
    "visibility": "PRIVATE",
    "createdAt": "2026-04-01T10:00:00.000Z",
    "updatedAt": "2026-04-01T10:00:00.000Z"
  },
  "assignees": [
    {
      "id": "ia_1",
      "issueId": "issue_1",
      "memberId": "team_member_1",
      "assignedAt": "2026-04-08T10:00:00.000Z",
      "member": {
        "id": "team_member_1",
        "userId": "user_1",
        "role": "MEMBER",
        "user": {
          "id": "user_1",
          "email": "dev@example.com",
          "name": "Dev A",
          "avatarUrl": null
        }
      }
    }
  ],
  "labels": [
    {
      "id": "il_1",
      "issueId": "issue_1",
      "labelId": "label_bug",
      "createdAt": "2026-04-08T10:00:00.000Z",
      "label": {
        "id": "label_bug",
        "name": "bug",
        "color": "#EF4444",
        "workspaceId": "ws_1",
        "createdAt": "2026-04-01T10:00:00.000Z",
        "updatedAt": "2026-04-01T10:00:00.000Z"
      }
    }
  ]
}
```

### 7.2 创建工作流 Issue

```http
POST /workspaces/:workspaceId/issues/workflow
```

请求体示例：

```json
{
  "title": "跑通入职审批流程",
  "description": "需要按工作流逐步执行",
  "workflowId": "workflow_1",
  "workflowSnapshot": "{\"nodes\":[],\"edges\":[]}",
  "totalSteps": 5,
  "currentStepId": "node_1",
  "currentStepIndex": 0,
  "currentStepStatus": "TODO",
  "dueDate": "2026-04-15T00:00:00.000Z"
}
```

说明：

- `workflowSnapshot` 要传 JSON 字符串
- 当前实现会直接创建记录，但不会像普通 Issue 创建那样补全 `state`、`project`、`assignees` 等 include
- 当前实现也没有显式把 `issueType` 设置成 `WORKFLOW`，前端不要假设这个字段一定会变成 `WORKFLOW`

### 7.3 获取 Issue 列表

```http
GET /workspaces/:workspaceId/issues
```

支持查询参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `scope` | `all \| team \| personal` | 默认 `all` |
| `stateId` | `string` | 按具体状态过滤 |
| `stateCategory` | `IssueStateCategory` | 按状态分类过滤 |
| `projectId` | `string` | 按项目过滤 |
| `assigneeId` | `string` | 按团队成员 ID 过滤 |
| `labelId` | `string` | 按标签过滤 |
| `issueType` | `IssueType` | 按类型过滤 |
| `priority` | `IssuePriority` | 按优先级过滤 |
| `sortBy` | `string` | 排序字段，默认 `createdAt` |
| `sortOrder` | `asc \| desc` | 默认 `desc` |
| `cursor` | `string` | 游标分页 |
| `limit` | `number` | 默认 `50` |

`scope` 语义：

- `all`: 不额外限制
- `team`: `visibility != PRIVATE`
- `personal`: `visibility = PRIVATE` 且 `creatorMemberId = 当前用户 teamMemberId`

请求示例：

```http
GET /workspaces/ws_1/issues?scope=all&stateId=state_todo&projectId=project_1&sortBy=updatedAt&sortOrder=desc&limit=20
```

返回：

- `200 OK`
- 数组项结构与 `findOne` 基本一致
- 每项都包含 `state`、`project`、`assignees.member.user`、`labels.label`

### 7.4 获取单个 Issue

```http
GET /workspaces/:workspaceId/issues/:id
```

返回结构与列表项一致，包含：

- `state`
- `project`
- `assignees.member.user`
- `labels.label`

重要说明：

- 当前实现按 `id` 查找，不校验 path 里的 `workspaceId`
- 当前实现查不到时不会抛 404，而是直接返回 `null`

前端建议：

- 收到 `null` 时按“记录不存在”处理
- 不要依赖它返回标准 404

### 7.5 更新 Issue

```http
PATCH /workspaces/:workspaceId/issues/:id
```

官方 DTO 里声明的字段只有：

- `title`
- `description`
- `currentStepId`
- `currentStepIndex`
- `currentStepStatus`

但当前真实实现里，控制器会把请求体原样传给 Prisma `issue.update()`，并且项目里没有开启全局 `ValidationPipe`，所以前端目前实际上也可以更新更多字段，例如：

- `stateId`
- `projectId`
- `priority`
- `visibility`
- `dueDate`
- `directAssigneeId`

也就是说，当前前端拖拽切换状态可以直接这么调：

```json
{
  "stateId": "state_in_progress"
}
```

再比如更新标题和优先级：

```json
{
  "title": "修复登录页按钮样式",
  "priority": "URGENT"
}
```

注意：

- 这是“按当前实现可用”的行为，不是严格 DTO 契约
- 如果后端后续补上全局校验，这部分行为可能会收紧

### 7.6 删除 Issue

```http
DELETE /workspaces/:workspaceId/issues/:id
```

当前实现不是 `204 No Content`，而是：

- `200 OK`
- 返回被删除的 Issue 对象

前端建议删除后重新拉列表。

### 7.7 新增 Step Record

```http
POST /workspaces/:workspaceId/issues/:id/steps
```

请求体：

```json
{
  "stepId": "node_2",
  "stepName": "设计评审",
  "index": 1,
  "resultText": "评审通过",
  "attachments": [
    {
      "type": "image",
      "url": "https://example.com/file.png"
    }
  ],
  "assigneeId": "supabase_user_id"
}
```

说明：

- 这里的 `assigneeId` 传的是 `userId`，不是 `teamMemberId`
- 服务端会在当前 workspace 下把它换算成 `teamMemberId`

### 7.8 获取 Step Record 列表

```http
GET /workspaces/:workspaceId/issues/:id/steps
```

返回按 `createdAt asc` 排序。

### 7.9 新增 Issue Activity

```http
POST /workspaces/:workspaceId/issues/:id/activities
```

请求体：

```json
{
  "action": "状态从 Todo 改为 In Progress",
  "metadata": {
    "fromStateId": "state_todo",
    "toStateId": "state_in_progress"
  }
}
```

说明：

- `actorId` 不需要前端传
- 后端会自动取当前登录用户在当前 workspace 下的 `teamMemberId`

### 7.10 获取 Issue Activity 列表

```http
GET /workspaces/:workspaceId/issues/:id/activities
```

返回按 `createdAt desc` 排序。

## 8. Comment 接口

注意：当前评论接口是独立资源，不是嵌套在 `/issues/:issueId/comments` 下。

### 8.1 创建评论

```http
POST /comments
```

请求体：

```json
{
  "content": "这个问题我来跟进",
  "issueId": "issue_1",
  "workspaceId": "ws_1",
  "parentId": "comment_parent_1"
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `content` | `string` | 是 | 评论内容 |
| `issueId` | `string` | 是 | Issue ID |
| `workspaceId` | `string` | 是 | 工作空间 ID |
| `parentId` | `string` | 否 | 回复某条评论时传 |

返回示例：

```json
{
  "id": "comment_1",
  "content": "这个问题我来跟进",
  "issueId": "issue_1",
  "authorId": "team_member_1",
  "parentId": null,
  "createdAt": "2026-04-08T10:00:00.000Z",
  "updatedAt": "2026-04-08T10:00:00.000Z",
  "author": {
    "id": "team_member_1",
    "name": "Dev A",
    "email": "dev@example.com",
    "avatarUrl": null
  }
}
```

### 8.2 获取评论列表

```http
GET /comments?issueId=:issueId
GET /comments?issueId=:issueId&parentId=:parentId
```

语义：

- 只传 `issueId`：返回顶级评论
- 传 `issueId + parentId`：返回某条评论的直接回复

返回：

- `200 OK`
- 按 `createdAt asc` 排序

## 9. 前端最需要注意的坑

### 9.1 不要再用旧的嵌套评论和依赖接口

旧文档和旧 SDK 里出现过这些路径：

- `POST /workspaces/:workspaceId/issues/:issueId/comments`
- `POST /workspaces/:workspaceId/issues/:issueId/dependencies`

当前 REST 实现里：

- 评论请改用 `/comments`
- dependency 没有对应 REST 实现，不要接

### 9.2 `PATCH /issues/:id` 现在可以改 `stateId`

虽然 DTO 没声明，但当前实现能用，前端可以直接拿它做看板拖拽改状态。

### 9.3 `GET /issues/:id` 查不到时是 `200 + null`

前端不要只按 404 处理。

### 9.4 普通 Issue 创建和工作流 Issue 创建返回结构不完全一致

- 普通 Issue 创建后会调用 `findOne()`，返回带 `state/project/assignees/labels`
- 工作流 Issue 创建后直接返回 `prisma.issue.create()` 结果，关联字段可能缺失

前端建议：

- 创建工作流 Issue 成功后再主动调一次详情接口

### 9.5 部分外键不会在服务层做强校验

例如：

- `stateId`
- `labelIds`
- `assigneeIds`

前端应只提交当前 workspace 已存在、且来源可靠的 ID，不要手输。

## 10. 建议前端最少实现的 fetcher

建议前端至少维护下面这些接口：

- `getIssueStates(workspaceId)`
- `createIssueState(workspaceId, data)`
- `updateIssueState(workspaceId, stateId, data)`
- `deleteIssueState(workspaceId, stateId)`
- `createIssue(workspaceId, data)`
- `createWorkflowIssue(workspaceId, data)`
- `getIssues(workspaceId, params)`
- `getIssueDetail(workspaceId, issueId)`
- `updateIssue(workspaceId, issueId, data)`
- `deleteIssue(workspaceId, issueId)`
- `createComment(data)`
- `getComments(issueId, parentId?)`
- `createIssueStepRecord(workspaceId, issueId, data)`
- `getIssueStepRecords(workspaceId, issueId)`
- `createIssueActivity(workspaceId, issueId, data)`
- `getIssueActivities(workspaceId, issueId)`

## 11. 一句话总结

当前后端升级后的核心设计是：

- `IssueState` 负责看板主状态
- `IssueStatus` 只负责 workflow step 状态
- 评论走独立 `/comments`
- 依赖 REST 暂未实现
- 前端切换 Issue 状态请直接 `PATCH issue.stateId`
