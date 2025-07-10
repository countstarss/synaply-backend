
# Issue API 文档

## 概述

Issue API 用于管理任务（Issue），包括创建、查询、更新、删除任务，以及管理任务的评论和依赖关系。所有接口都需要用户认证，并通过 `workspaceId` 进行隔离。

## 认证

所有接口都需要在请求头中提供 `Authorization` 字段，值为 `Bearer <YOUR_SUPABASE_JWT>`。

## 接口详情

### 1. 创建任务

- **POST** `/workspaces/:workspaceId/issues`
- **功能**: 在指定工作空间下创建新的任务。
- **前提**:
    - 用户必须是指定工作空间的成员。
    - 如果同时提供了 `workflowId` 和 `directAssigneeId`，请求将被拒绝。
    - 如果提供了 `workflowId`，可以使用已发布的版本。

#### 请求

- **路径参数**:
    - `workspaceId` (string, required): 工作空间 ID。
- **请求体** (`CreateIssueDto`):
    - `title` (string, required): 任务标题。
    - `description` (string, optional): 任务描述。
    - `projectId` (string, optional): 关联的项目 ID。
    - `workflowId` (string, optional): 关联的工作流 ID。
    - `currentStepId` (string, optional): 工作流的当前步骤 ID。
    - `directAssigneeId` (string, optional): 直接指派的团队成员 ID。
    - `dueDate` (Date, optional): 截止日期。
    - `startDate` (Date, optional): 开始日期。
    - `priority` (Enum: `LOW`, `NORMAL`, `HIGH`, `URGENT`, optional): 任务优先级，默认为 `NORMAL`。
    - `parentTaskId` (string, optional): 父任务 ID。
    - `visibility` (Enum: `PUBLIC`, `PRIVATE`, optional): 可见性，默认为 `PRIVATE`。

#### 响应

- **成功 (201 Created)**: 返回创建的任务对象。
- **失败**:
    - `400 Bad Request`: 请求参数错误，例如同时指定了 `workflowId` 和 `directAssigneeId`。
    - `401 Unauthorized`: 未认证或认证失败。
    - `403 Forbidden`: 无权访问该工作空间。
    - `404 Not Found`: 关联的资源（如项目、工作流）不存在。

---

### 2. 获取任务列表

- **GET** `/workspaces/:workspaceId/issues`
- **功能**: 获取指定工作空间下的所有任务。
- **前提**: 用户必须是指定工作空间的成员。

#### 请求

- **路径参数**:
    - `workspaceId` (string, required): 工作空间 ID。
- **查询参数**:
    - `projectId` (string, optional): 按项目 ID 过滤任务。

#### 响应

- **成功 (200 OK)**: 返回任务对象数组。
- **失败**:
    - `401 Unauthorized`: 未认证或认证失败。
    - `403 Forbidden`: 无权访问该工作空间。

---

### 3. 获取任务详情

- **GET** `/workspaces/:workspaceId/issues/:id`
- **功能**: 获取单个任务的详细信息。
- **前提**: 用户必须有权查看该任务。

#### 请求

- **路径参数**:
    - `workspaceId` (string, required): 工作空间 ID。
    - `id` (string, required): 任务 ID。

#### 响应

- **成功 (200 OK)**: 返回任务的详细对象，包括评论、活动历史等。
- **失败**:
    - `401 Unauthorized`: 未认证或认证失败。
    - `403 Forbidden`: 无权查看该任务。
    - `404 Not Found`: 任务不存在。

---

### 4. 更新任务

- **PATCH** `/workspaces/:workspaceId/issues/:id`
- **功能**: 更新指定任务的信息。
- **前提**: 用户必须有权修改该任务。

#### 请求

- **路径参数**:
    - `workspaceId` (string, required): 工作空间 ID。
    - `id` (string, required): 任务 ID。
- **请求体** (`UpdateIssueDto`):
    - 与 `CreateIssueDto` 相同的字段，均为可选。

#### 响应

- **成功 (200 OK)**: 返回更新后的任务对象。
- **失败**:
    - `401 Unauthorized`: 未认证或认证失败。
    - `403 Forbidden`: 无权修改该任务。
    - `404 Not Found`: 任务不存在。

---

### 5. 删除任务

- **DELETE** `/workspaces/:workspaceId/issues/:id`
- **功能**: 删除指定任务。
- **前提**:
    - 用户必须有权删除该任务。
    - 不能删除包含子任务的任务。

#### 请求

- **路径参数**:
    - `workspaceId` (string, required): 工作空间 ID。
    - `id` (string, required): 任务 ID。

#### 响应

- **成功 (204 No Content)**: 无返回内容。
- **失败**:
    - `401 Unauthorized`: 未认证或认证失败。
    - `403 Forbidden`: 无权删除该任务或任务包含子任务。
    - `404 Not Found`: 任务不存在。

---

### 6. 添加评论

- **POST** `/workspaces/:workspaceId/issues/:issueId/comments`
- **功能**: 为指定任务添加评论。
- **前提**: 用户必须有权查看该任务。

#### 请求

- **路径参数**:
    - `workspaceId` (string, required): 工作空间 ID。
    - `issueId` (string, required): 任务 ID。
- **请求体** (`CreateCommentDto`):
    - `content` (string, required): 评论内容。

#### 响应

- **成功 (201 Created)**: 返回创建的评论对象。
- **失败**:
    - `401 Unauthorized`: 未认证或认证失败。
    - `403 Forbidden`: 无权查看该任务。
    - `404 Not Found`: 任务不存在。

---

### 7. 添加依赖

- **POST** `/workspaces/:workspaceId/issues/:issueId/dependencies`
- **功能**: 为任务添加依赖关系。
- **前提**: 用户必须有权修改该任务。

#### 请求

- **路径参数**:
    - `workspaceId` (string, required): 工作空间 ID。
    - `issueId` (string, required): 任务 ID。
- **请求体** (`CreateIssueDependencyDto`):
    - `dependsOnIssueId` (string, required): 依赖的任务 ID。

#### 响应

- **成功 (201 Created)**: 返回创建的依赖关系对象。
- **失败**:
    - `400 Bad Request`: 依赖关系已存在。
    - `401 Unauthorized`: 未认证或认证失败。
    - `403 Forbidden`: 无权修改该任务。
    - `404 Not Found`: 任务或依赖的任务不存在。
