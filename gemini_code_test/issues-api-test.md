### Issues API 测试指南

#### 前提

1.  **服务运行中**: 确保你的 Nest.js 后端服务正在运行 (`pnpm run start:dev`)。
2.  **获取认证 Token**: 你需要一个有效的 `access_token` 来通过认证。
3.  **获取必要 ID**:
    *   从 `workspaces` 表中获取一个有效的 `workspaceId`。
    *   从 `team_members` 表中获取一个或多个有效的 `teamMemberId`，用于 `creatorId`、`directAssigneeId` 或 `authorId`。
    *   如果测试工作流相关的任务，需要从 `workflows` 表中获取一个 `PUBLISHED` 状态的 `workflowId`，以及该工作流下的一个 `workflowStepId`。

---

#### 测试场景 1: 创建任务 (Create Issue)

*   **Endpoint**: `POST /workspaces/{workspaceId}/issues`
*   **Method**: `POST`
*   **Description**: 在指定的工作区下创建一个新的任务。

**Headers:**

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_ACCESS_TOKEN"
}
```

**Path Parameters:**

| Parameter     | Type   | Description                | Example                                |
| :------------ | :----- | :------------------------- | :------------------------------------- |
| `workspaceId` | string | 要在其中创建任务的工作区的 ID | `a1b2c3d4-e5f6-7890-1234-567890abcdef` |

**Request Body (`JSON`):**

**示例 1.1: 创建一个简单任务 (直接指派)**

```json
{
  "title": "完成用户登录功能",
  "description": "实现用户注册、登录、登出功能。",
  "directAssigneeId": "YOUR_TEAM_MEMBER_ID_FOR_ASSIGNEE",
  "priority": "HIGH",
  "dueDate": "2025-07-15T00:00:00.000Z"
}
```

**示例 1.2: 创建一个工作流任务 (绑定工作流和初始步骤)**

```json
{
  "title": "设计新功能 API",
  "description": "根据产品需求文档，设计 RESTful API。",
  "workflowId": "YOUR_PUBLISHED_WORKFLOW_ID",
  "currentStepId": "YOUR_WORKFLOW_STEP_ID_FOR_API_DESIGN",
  "priority": "NORMAL"
}
```

**示例 1.3: 创建一个子任务**

```json
{
  "title": "实现登录页面 UI",
  "description": "根据设计稿实现登录页面的前端 UI。",
  "directAssigneeId": "YOUR_TEAM_MEMBER_ID_FOR_FRONTEND",
  "parentTaskId": "YOUR_PARENT_ISSUE_ID"
}
```

**Success Response (Code `201 Created`):**

```json
{
  "id": "new-issue-id",
  "title": "完成用户登录功能",
  "description": "实现用户注册、登录、登出功能。",
  "workspaceId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "creatorId": "your-creator-team-member-id",
  "status": "TODO",
  "priority": "HIGH",
  "dueDate": "2025-07-15T00:00:00.000Z",
  "startDate": null,
  "workflowId": null,
  "currentStepId": null,
  "directAssigneeId": "YOUR_TEAM_MEMBER_ID_FOR_ASSIGNEE",
  "parentTaskId": null,
  "createdAt": "2025-06-27T14:00:00.000Z",
  "updatedAt": "2025-06-27T14:00:00.000Z"
}
```

**预期结果**:
*   **HTTP 状态码**: `201 Created`
*   **响应体**: 返回新创建的任务对象，包含所有字段。
*   **数据库验证**:
    *   检查 `issues` 表，确认新任务已创建，字段与请求匹配。
    *   检查 `issue_activities` 表，确认有一条“Created”活动记录。

---

#### 测试场景 2: 获取工作区下的所有任务 (Get All Issues in Workspace)

*   **Endpoint**: `GET /workspaces/{workspaceId}/issues`
*   **Method**: `GET`
*   **Description**: 获取指定工作区下的所有任务。

**Headers:**

```json
{
  "Authorization": "Bearer YOUR_ACCESS_TOKEN"
}
```

**Path Parameters:**

| Parameter     | Type   | Description                | Example                                |
| :------------ | :----- | :------------------------- | :------------------------------------- |
| `workspaceId` | string | 要查询任务的工作区的 ID | `a1b2c3d4-e5f6-7890-1234-567890abcdef` |

**Success Response (Code `200 OK`):**

```json
[
  {
    "id": "issue-id-1",
    "title": "任务 A",
    // ... other issue fields
    "creator": { /* creator details */ },
    "directAssignee": { /* assignee details */ },
    "workflow": { /* workflow details */ },
    "currentStep": { /* current step details */ },
    "parentTask": { /* parent task details */ }
  },
  {
    "id": "issue-id-2",
    "title": "任务 B",
    // ...
  }
]
```

**预期结果**:
*   **HTTP 状态码**: `200 OK`
*   **响应体**: 返回一个 JSON 数组，包含该 `workspaceId` 下的所有任务对象，并包含关联的 `creator`, `directAssignee`, `workflow`, `currentStep`, `parentTask` 等信息。

---

#### 测试场景 3: 获取特定任务详情 (Get Specific Issue Details)

*   **Endpoint**: `GET /workspaces/{workspaceId}/issues/{issueId}`
*   **Method**: `GET`
*   **Description**: 获取特定任务的详细信息。

**Headers:**

```json
{
  "Authorization": "Bearer YOUR_ACCESS_TOKEN"
}
```

**Path Parameters:**

| Parameter     | Type   | Description                | Example                                |
| :------------ | :----- | :------------------------- | :------------------------------------- |
| `workspaceId` | string | 任务所属工作区的 ID        | `a1b2c3d4-e5f6-7890-1234-567890abcdef` |
| `issueId`     | string | 要查询的任务的 ID          | `issue-id-to-query`                    |

**Success Response (Code `200 OK`):**

```json
{
  "id": "issue-id-to-query",
  "title": "设计新功能 API",
  "description": "根据产品需求文档，设计 RESTful API。",
  "status": "TODO",
  "priority": "NORMAL",
  "dueDate": null,
  "startDate": null,
  "workspaceId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "workflowId": "YOUR_PUBLISHED_WORKFLOW_ID",
  "currentStepId": "YOUR_WORKFLOW_STEP_ID_FOR_API_DESIGN",
  "directAssigneeId": null,
  "creatorId": "your-creator-team-member-id",
  "createdAt": "2025-06-27T14:00:00.000Z",
  "updatedAt": "2025-06-27T14:00:00.000Z",
  "creator": { /* creator details */ },
  "directAssignee": null,
  "workflow": { /* workflow details */ },
  "currentStep": { /* current step details */ },
  "parentTask": null,
  "subtasks": [ /* list of subtasks */ ],
  "comments": [ /* list of comments */ ],
  "activities": [ /* list of activities */ ],
  "blockingIssues": [ /* list of issues this one blocks */ ],
  "dependsOnIssues": [ /* list of issues this one depends on */ ]
}
```

**预期结果**:
*   **HTTP 状态码**: `200 OK`
*   **响应体**: 返回指定 `issueId` 的任务对象，包含所有详细信息和关联数据。
*   **错误情况**: 如果 `issueId` 不存在，应返回 `404 Not Found`。

---

#### 测试场景 4: 更新任务 (Update Issue)

*   **Endpoint**: `PATCH /workspaces/{workspaceId}/issues/{issueId}`
*   **Method**: `PATCH`
*   **Description**: 更新任务的属性。

**Headers:**

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_ACCESS_TOKEN"
}
```

**Path Parameters:**

| Parameter     | Type   | Description                | Example                                |
| :------------ | :----- | :------------------------- | :------------------------------------- |
| `workspaceId` | string | 任务所属工作区的 ID        | `a1b2c3d4-e5f6-7890-1234-567890abcdef` |
| `issueId`     | string | 要更新的任务的 ID          | `issue-id-to-update`                   |

**Request Body (`JSON`):**

**示例 4.1: 更新状态和优先级**

```json
{
  "status": "IN_PROGRESS",
  "priority": "URGENT"
}
```

**示例 4.2: 更新工作流任务的当前步骤**

```json
{
  "currentStepId": "YOUR_NEXT_WORKFLOW_STEP_ID"
}
```

**Success Response (Code `200 OK`):**

```json
{
  "id": "issue-id-to-update",
  "title": "设计新功能 API",
  "description": "根据产品需求文档，设计 RESTful API。",
  "status": "IN_PROGRESS",
  "priority": "URGENT",
  // ... other updated fields
}
```

**预期结果**:
*   **HTTP 状态码**: `200 OK`
*   **响应体**: 返回更新后的任务对象。
*   **数据库验证**:
    *   检查 `issues` 表，确认任务的字段已更新。
    *   检查 `issue_activities` 表，确认有新的活动记录（例如状态变更或步骤流转）。

---

#### 测试场景 5: 删除任务 (Delete Issue)

*   **Endpoint**: `DELETE /workspaces/{workspaceId}/issues/{issueId}`
*   **Method**: `DELETE`
*   **Description**: 删除指定任务及其所有关联数据（评论、活动、依赖）。

**Headers:**

```json
{
  "Authorization": "Bearer YOUR_ACCESS_TOKEN"
}
```

**Path Parameters:**

| Parameter     | Type   | Description                | Example                                |
| :------------ | :----- | :------------------------- | :------------------------------------- |
| `workspaceId` | string | 任务所属工作区的 ID        | `a1b2c3d4-e5f6-7890-1234-567890abcdef` |
| `issueId`     | string | 要删除的任务的 ID          | `issue-id-to-delete`                   |

**Success Response (Code `204 No Content`):**

*   空响应体。

**预期结果**:
*   **HTTP 状态码**: `204 No Content`
*   **响应体**: 空。
*   **数据库验证**:
    *   检查 `issues` 表，确认任务已被删除。
    *   检查 `comments`, `issue_activities`, `issue_dependencies` 表，确认所有与该任务关联的记录也已被删除。

---

#### 测试场景 6: 添加评论 (Add Comment)

*   **Endpoint**: `POST /workspaces/{workspaceId}/issues/{issueId}/comments`
*   **Method**: `POST`
*   **Description**: 为指定任务添加一条评论。

**Headers:**

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_ACCESS_TOKEN"
}
```

**Path Parameters:**

| Parameter     | Type   | Description                | Example                                |
| :------------ | :----- | :------------------------- | :------------------------------------- |
| `workspaceId` | string | 任务所属工作区的 ID        | `a1b2c3d4-e5f6-7890-1234-567890abcdef` |
| `issueId`     | string | 要评论的任务的 ID          | `issue-id-to-comment`                  |

**Request Body (`JSON`):**

```json
{
  "content": "这个功能需要和后端团队确认一下 API 接口。"
}
```

**Success Response (Code `201 Created`):**

```json
{
  "id": "new-comment-id",
  "content": "这个功能需要和后端团队确认一下 API 接口。",
  "issueId": "issue-id-to-comment",
  "authorId": "your-author-team-member-id",
  "createdAt": "2025-06-27T15:00:00.000Z",
  "updatedAt": "2025-06-27T15:00:00.000Z"
}
```

**预期结果**:
*   **HTTP 状态码**: `201 Created`
*   **响应体**: 返回新创建的评论对象。
*   **数据库验证**: 检查 `comments` 表，确认新评论已创建。

---

#### 测试场景 7: 添加任务依赖 (Add Issue Dependency)

*   **Endpoint**: `POST /workspaces/{workspaceId}/issues/{issueId}/dependencies`
*   **Method**: `POST`
*   **Description**: 为指定任务添加一个依赖（即当前任务 `issueId` 依赖于 `dependsOnIssueId`）。

**Headers:**

```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_ACCESS_TOKEN"
}
```

**Path Parameters:**

| Parameter     | Type   | Description                | Example                                |
| :------------ | :----- | :------------------------- | :------------------------------------- |
| `workspaceId` | string | 任务所属工作区的 ID        | `a1b2c3d4-e5f6-7890-1234-567890abcdef` |
| `issueId`     | string | 当前任务的 ID (被阻塞的任务) | `issue-id-being-blocked`               |

**Request Body (`JSON`):**

```json
{
  "dependsOnIssueId": "ISSUE_ID_THIS_ONE_DEPENDS_ON"
}
```

**Success Response (Code `201 Created`):**

```json
{
  "id": "new-dependency-id",
  "blockerIssueId": "issue-id-being-blocked",
  "dependsOnIssueId": "ISSUE_ID_THIS_ONE_DEPENDS_ON",
  "createdAt": "2025-06-27T16:00:00.000Z"
}
```

**预期结果**:
*   **HTTP 状态码**: `201 Created`
*   **响应体**: 返回新创建的依赖对象。
*   **数据库验证**: 检查 `issue_dependencies` 表，确认新依赖已创建。
*   **错误情况**: 
    *   如果 `issueId` 或 `dependsOnIssueId` 不存在，返回 `404 Not Found`。
    *   如果 `issueId` 和 `dependsOnIssueId` 相同 (自依赖)，返回 `400 Bad Request`。
    *   如果存在循环依赖 (例如 A 依赖 B，现在尝试 B 依赖 A)，返回 `400 Bad Request`。

---

#### 测试场景 8: 移除任务依赖 (Remove Issue Dependency)

*   **Endpoint**: `DELETE /workspaces/{workspaceId}/issues/{issueId}/dependencies/{dependsOnIssueId}`
*   **Method**: `DELETE`
*   **Description**: 移除指定任务 `issueId` 对 `dependsOnIssueId` 的依赖。

**Headers:**

```json
{
  "Authorization": "Bearer YOUR_ACCESS_TOKEN"
}
```

**Path Parameters:**

| Parameter          | Type   | Description                | Example                                |
| :----------------- | :----- | :------------------------- | :------------------------------------- |
| `workspaceId`      | string | 任务所属工作区的 ID        | `a1b2c3d4-e5f6-7890-1234-567890abcdef` |
| `issueId`          | string | 当前任务的 ID (被阻塞的任务) | `issue-id-being-blocked`               |
| `dependsOnIssueId` | string | 依赖的任务的 ID            | `issue-id-this-one-depends-on`         |

**Success Response (Code `204 No Content`):**

*   空响应体。

**预期结果**:
*   **HTTP 状态码**: `204 No Content`
*   **响应体**: 空。
*   **数据库验证**: 检查 `issue_dependencies` 表，确认该依赖记录已被删除。
*   **错误情况**: 如果依赖不存在，返回 `404 Not Found`。

---