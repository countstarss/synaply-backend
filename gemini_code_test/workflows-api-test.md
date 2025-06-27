### Workflows API 测试指南 (更新)

#### 前提

1.  **服务运行中**: 确保你的 Nest.js 后端服务正在运行 (`pnpm run start:dev`)。
2.  **获取认证 Token**: 你需要一个有效的 `access_token` 来通过认证。
3.  **获取必要 ID**:
    *   从 `workspaces` 表中获取一个有效的 `workspaceId`。
    *   从 `team_members` 表中获取一个或多个有效的 `teamMemberId`，用于指派给步骤负责人。

---

#### 测试场景 1: 创建草稿工作流 (Create Draft Workflow)

1.  **请求**:
    *   向 `/workspaces/{workspaceId}/workflows` 发送 `POST` 请求。
    *   在 `Authorization` Header 中提供你的 `access_token`。
    *   请求体中只包含工作流名称 (`name`)。

    ```bash
    curl -X POST \
      http://localhost:5678/workspaces/YOUR_WORKSPACE_ID/workflows \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
      -d '{
        "name": "我的第一个草稿工作流"
      }'
    ```

2.  **预期结果**:
    *   **HTTP 状态码**: `201 Created`
    *   **响应体**: 返回一个 JSON 对象，包含新创建的工作流的详细信息，包括 `id`, `name`, `workspaceId`, `status` (应为 `DRAFT`)。`steps` 数组应为空。
    *   **数据库验证**:
        *   检查 `workflows` 表，确认一条新的记录已被创建，其 `name` 和 `workspace_id` 与请求匹配，`status` 字段为 `DRAFT`。
        *   检查 `workflow_steps` 表，确认没有为这个工作流创建任何步骤。

---

#### 测试场景 2: 获取工作区下的所有工作流 (Get All Workflows in Workspace)

1.  **前提**: 确保你的工作区下已经创建了一些工作流（包括草稿和已发布的）。
2.  **请求**:
    *   向 `/workspaces/{workspaceId}/workflows` 发送 `GET` 请求。
    *   在 `Authorization` Header 中提供你的 `access_token`。

    ```bash
    curl -X GET \
      http://localhost:5678/workspaces/YOUR_WORKSPACE_ID/workflows \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
    ```

3.  **预期结果**:
    *   **HTTP 状态码**: `200 OK`
    *   **响应体**: 返回一个 JSON 数组，包含该 `workspaceId` 下的所有工作流对象。每个工作流对象应包含其 `id`, `name`, `status`，以及一个 `steps` 数组（如果存在步骤）。工作流应按创建时间倒序排列。

---

#### 测试场景 3: 获取特定工作流详情 (Get Specific Workflow Details)

1.  **前提**: 你已经创建了一个工作流，并获取了其 `workflowId`。
2.  **请求**:
    *   向 `/workspaces/{workspaceId}/workflows/{workflowId}` 发送 `GET` 请求。
    *   在 `Authorization` Header 中提供你的 `access_token`。

    ```bash
    curl -X GET \
      http://localhost:5678/workspaces/YOUR_WORKSPACE_ID/workflows/YOUR_WORKFLOW_ID \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
    ```

3.  **预期结果**:
    *   **HTTP 状态码**: `200 OK`
    *   **响应体**: 返回一个 JSON 对象，包含该 `workflowId` 对应的详细工作流信息，包括其 `steps` 数组。
    *   **错误情况**: 如果 `workflowId` 不存在，应返回 `404 Not Found`。

---

#### 测试场景 4: 更新工作流 (Update Workflow)

1.  **前提**: 你已经创建了一个草稿工作流，并获取了其 `workflowId`。
2.  **请求**:
    *   向 `/workspaces/{workspaceId}/workflows/{workflowId}` 发送 `PATCH` 请求。
    *   在 `Authorization` Header 中提供你的 `access_token`。
    *   请求体中可以包含 `name`、`status` 或 `steps` 数组。

    **示例 4.1: 更新名称并添加步骤**

    ```bash
    curl -X PATCH \
      http://localhost:5678/workspaces/YOUR_WORKSPACE_ID/workflows/YOUR_WORKFLOW_ID \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
      -d '{
        "name": "更新后的开发流程",
        "steps": [
          {
            "name": "需求分析",
            "order": 1,
            "assigneeId": "YOUR_TEAM_MEMBER_ID_FOR_PM"
          },
          {
            "name": "设计阶段",
            "order": 2
          }
        ]
      }'
    ```

    **示例 4.2: 更新现有步骤并删除一个步骤**

    假设你的工作流当前有 ID 为 `step-id-1` 和 `step-id-2` 的步骤。

    ```bash
    curl -X PATCH \
      http://localhost:5678/workspaces/YOUR_WORKSPACE_ID/workflows/YOUR_WORKFLOW_ID \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
      -d '{
        "steps": [
          {
            "id": "step-id-1",
            "name": "更新后的需求分析",
            "order": 1,
            "description": "新的描述"
          }
          // 注意：这里没有包含 step-id-2，表示要删除它
        ]
      }'
    ```

3.  **预期结果**:
    *   **HTTP 状态码**: `200 OK`
    *   **响应体**: 返回更新后的工作流对象，包含所有最新的步骤信息。
    *   **数据库验证**:
        *   检查 `workflows` 表，确认工作流的 `name` 和 `status` 已更新。
        *   检查 `workflow_steps` 表，确认新步骤已创建，现有步骤已更新，被移除的步骤已删除。

---

#### 测试场景 5: 发布工作流 (Publish Workflow)

1.  **前提**:
    *   你已经创建了一个草稿工作流，并获取了其 `workflowId`。
    *   该工作流至少包含一个步骤。
2.  **请求**:
    *   向 `/workspaces/{workspaceId}/workflows/{workflowId}/publish` 发送 `POST` 请求。
    *   在 `Authorization` Header 中提供你的 `access_token`。

    ```bash
    curl -X POST \
      http://localhost:5678/workspaces/YOUR_WORKSPACE_ID/workflows/YOUR_WORKFLOW_ID/publish \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
    ```

3.  **预期结果**:
    *   **HTTP 状态码**: `201 Created` (或 `200 OK`，取决于 NestJS 的默认行为)
    *   **响应体**: 返回更新后的工作流对象，其 `status` 字段应为 `PUBLISHED`。
    *   **数据库验证**: 检查 `workflows` 表，确认该工作流的 `status` 字段已更新为 `PUBLISHED`。
    *   **错误情况**: 如果工作流没有步骤，应返回 `400 Bad Request` 或其他错误，并提示“Cannot publish a workflow without any steps.”

---

#### 测试场景 6: 删除工作流 (Delete Workflow)

1.  **前提**: 你已经创建了一个工作流，并获取了其 `workflowId`。
2.  **请求**:
    *   向 `/workspaces/{workspaceId}/workflows/{workflowId}` 发送 `DELETE` 请求。
    *   在 `Authorization` Header 中提供你的 `access_token`。

    ```bash
    curl -X DELETE \
      http://localhost:5678/workspaces/YOUR_WORKSPACE_ID/workflows/YOUR_WORKFLOW_ID \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
    ```

3.  **预期结果**:
    *   **HTTP 状态码**: `204 No Content`
    *   **响应体**: 空。
    *   **数据库验证**:
        *   检查 `workflows` 表，确认该工作流已被删除。
        *   检查 `workflow_steps` 表，确认所有与该工作流关联的步骤也已被删除。

---