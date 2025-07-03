### 聊天 (Chat) API 测试指南

#### 前提

1.  **服务运行中**: 确保你的 Nest.js 后端服务正在运行 (`pnpm run start:dev`)
2.  **获取认证 Token**: 你需要一个有效的 `access_token` 来通过认证。
3.  **获取必要 ID**:
    *   从 `team_members` 表中获取一个或多个有效的 `teamMemberId`，用于创建聊天和添加成员。
    *   确保这些 `teamMemberId` 对应的用户已在系统中注册。

---

#### 测试场景 1: 创建群聊 (Create Group Chat)

1.  **请求**:
    *   向 `/chats/group` 发送 `POST` 请求。
    *   在 `Authorization` Header 中提供你的 `access_token`。
    *   请求体中包含群聊名称 (`name`)、可选描述 (`description`) 和成员 ID 列表 (`memberIds`)。`memberIds` 必须包含创建者自己的 `teamMemberId`。

    ```bash
    curl -X POST \
      http://localhost:5678/chats/group \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
      -d '{
        "name": "我的第一个群聊",
        "description": "这是一个测试群聊",
        "memberIds": ["YOUR_CREATOR_TEAM_MEMBER_ID", "ANOTHER_TEAM_MEMBER_ID"]
      }'
    ```

2.  **预期结果**:
    *   **HTTP 状态码**: `201 Created`
    *   **响应体**: 返回一个 JSON 对象，包含新创建的群聊的详细信息，包括 `id`, `type` (应为 `GROUP`), `name`, `description`。`members` 数组应包含所有指定的成员，并且创建者应被标记为 `isAdmin: true`。
    *   **数据库验证**:
        *   检查 `chats` 表，确认一条新的记录已被创建，其 `name`, `type` 与请求匹配。
        *   检查 `chat_members` 表，确认所有 `memberIds` 都已作为成员添加到该聊天中，并且创建者的 `is_admin` 字段为 `true`。

---

#### 测试场景 2: 创建私聊 (Create Private Chat)

1.  **请求**:
    *   向 `/chats/private` 发送 `POST` 请求。
    *   在 `Authorization` Header 中提供你的 `access_token`。
    *   请求体中包含目标成员 ID (`targetMemberId`)。

    ```bash
    curl -X POST \
      http://localhost:5678/chats/private \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
      -d '{
        "targetMemberId": "TARGET_TEAM_MEMBER_ID"
      }'
    ```

2.  **预期结果**:
    *   **HTTP 状态码**: `201 Created`
    *   **响应体**: 返回一个 JSON 对象，包含新创建的私聊的详细信息，包括 `id`, `type` (应为 `PRIVATE`)。`members` 数组应包含创建者和目标成员。
    *   **数据库验证**:
        *   检查 `chats` 表，确认一条新的记录已被创建，其 `type` 为 `PRIVATE`。
        *   检查 `chat_members` 表，确认创建者和目标成员都已作为成员添加到该聊天中。
    *   **重复创建**: 如果与 `targetMemberId` 的私聊已存在，应返回现有私聊的详细信息，而不是创建新的。

---

#### 测试场景 3: 获取用户的所有聊天会话 (Get All Chats for User)

1.  **前提**: 确保当前用户已参与一些群聊和私聊。
2.  **请求**:
    *   向 `/chats` 发送 `GET` 请求。
    *   在 `Authorization` Header 中提供你的 `access_token`。
    *   可选查询参数 `type` (`private` 或 `group`) 可用于过滤。

    ```bash
    # 获取所有聊天
    curl -X GET \
      http://localhost:5678/chats \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'

    # 获取所有私聊
    curl -X GET \
      "http://localhost:5678/chats?type=private" \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'

    # 获取所有群聊
    curl -X GET \
      "http://localhost:5678/chats?type=group" \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
    ```

3.  **预期结果**:
    *   **HTTP 状态码**: `200 OK`
    *   **响应体**: 返回一个 JSON 数组，包含当前用户参与的所有聊天会话对象。每个聊天对象应包含 `id`, `type`, `name` (如果适用), `lastMessage` (如果存在), `members` (包含 `teamMember` 详情)。
    *   **数据准确性**: 确保返回的聊天列表只包含当前用户是成员的聊天。

---

#### 测试场景 4: 获取单个聊天会话详情 (Get Single Chat Details)

1.  **前提**: 你已经创建了一个聊天会话，并获取了其 `chatId`。
2.  **请求**:
    *   向 `/chats/{chatId}` 发送 `GET` 请求。
    *   在 `Authorization` Header 中提供你的 `access_token`。

    ```bash
    curl -X GET \
      http://localhost:5678/chats/YOUR_CHAT_ID \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
    ```

3.  **预期结果**:
    *   **HTTP 状态码**: `200 OK`
    *   **响应体**: 返回一个 JSON 对象，包含该 `chatId` 对应的详细聊天信息，包括其 `members` 数组和 `creator` 信息。
    *   **错误情况**:
        *   如果 `chatId` 不存在，应返回 `404 Not Found`。
        *   如果当前用户不是该聊天的成员，应返回 `403 Forbidden`。

---

#### 测试场景 5: 更新群聊信息 (Update Group Chat Info)

1.  **前提**: 你已经创建了一个群聊，并获取了其 `chatId`，并且当前用户是该群聊的管理员。
2.  **请求**:
    *   向 `/chats/{chatId}` 发送 `PATCH` 请求。
    *   在 `Authorization` Header 中提供你的 `access_token`。
    *   请求体中可以包含 `name` 或 `description`。

    ```bash
    curl -X PATCH \
      http://localhost:5678/chats/YOUR_GROUP_CHAT_ID \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
      -d '{
        "name": "更新后的群聊名称",
        "description": "这是更新后的描述"
      }'
    ```

3.  **预期结果**:
    *   **HTTP 状态码**: `200 OK`
    *   **响应体**: 返回更新后的群聊对象。
    *   **数据库验证**: 检查 `chats` 表，确认群聊的 `name` 和 `description` 已更新。
    *   **错误情况**:
        *   如果 `chatId` 不是群聊，应返回 `400 Bad Request`。
        *   如果当前用户不是该群聊的管理员，应返回 `403 Forbidden`。

---

#### 测试场景 6: 添加成员到群聊 (Add Members to Group Chat)

1.  **前提**: 你已经创建了一个群聊，并获取了其 `chatId`，并且当前用户是该群聊的管理员。
2.  **请求**:
    *   向 `/chats/{chatId}/members` 发送 `POST` 请求。
    *   在 `Authorization` Header 中提供你的 `access_token`。
    *   请求体中包含要添加的成员 ID 列表 (`memberIds`)。

    ```bash
    curl -X POST \
      http://localhost:5678/chats/YOUR_GROUP_CHAT_ID/members \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
      -d '{
        "memberIds": ["NEW_TEAM_MEMBER_ID_1", "NEW_TEAM_MEMBER_ID_2"]
      }'
    ```

3.  **预期结果**:
    *   **HTTP 状态码**: `201 Created`
    *   **响应体**: 返回一个 JSON 数组，包含新添加的 `ChatMember` 对象。
    *   **数据库验证**: 检查 `chat_members` 表，确认新的 `memberIds` 已作为成员添加到该聊天中。
    *   **错误情况**:
        *   如果 `chatId` 不是群聊，应返回 `400 Bad Request`。
        *   如果当前用户不是该群聊的管理员，应返回 `403 Forbidden`。
        *   如果 `memberIds` 中包含已存在的成员，应忽略或返回错误。

---

#### 测试场景 7: 移除群聊成员 (Remove Member from Group Chat)

1.  **前提**: 你已经创建了一个群聊，并获取了其 `chatId`，并且当前用户是该群聊的管理员。
2.  **请求**:
    *   向 `/chats/{chatId}/members/{teamMemberId}` 发送 `DELETE` 请求。
    *   在 `Authorization` Header 中提供你的 `access_token`。

    ```bash
    curl -X DELETE \
      http://localhost:5678/chats/YOUR_GROUP_CHAT_ID/members/MEMBER_TO_REMOVE_ID \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
    ```

3.  **预期结果**:
    *   **HTTP 状态码**: `204 No Content`
    *   **响应体**: 空。
    *   **数据库验证**: 检查 `chat_members` 表，确认指定的 `teamMemberId` 已从该聊天中移除。
    *   **错误情况**:
        *   如果 `chatId` 不是群聊，应返回 `400 Bad Request`。
        *   如果当前用户不是该群聊的管理员，应返回 `403 Forbidden`。
        *   如果尝试移除群聊的最后一个管理员，应返回错误。

---

#### 测试场景 8: 用户退出群聊 (Leave Group Chat)

1.  **前提**: 当前用户是某个群聊的成员。
2.  **请求**:
    *   向 `/chats/{chatId}/leave` 发送 `POST` 请求。
    *   在 `Authorization` Header 中提供你的 `access_token`。

    ```bash
    curl -X POST \
      http://localhost:5678/chats/YOUR_GROUP_CHAT_ID/leave \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
    ```

3.  **预期结果**:
    *   **HTTP 状态码**: `201 Created` (或 `200 OK`)
    *   **响应体**: `{ message: "Successfully left chat." }`
    *   **数据库验证**: 检查 `chat_members` 表，确认当前用户已从该聊天中移除。
    *   **错误情况**:
        *   如果 `chatId` 不是群聊，应返回 `400 Bad Request`。
        *   如果当前用户不是该群聊的成员，应返回 `400 Bad Request`。

---

#### 测试场景 9: 删除聊天会话 (Delete Chat)

1.  **前提**: 你已经创建了一个聊天会话，并获取了其 `chatId`。
    *   对于群聊，当前用户必须是创建者或管理员。
    *   对于私聊，双方都可以发起删除，但只有当双方都删除后，聊天才真正从数据库中移除。
2.  **请求**:
    *   向 `/chats/{chatId}` 发送 `DELETE` 请求。
    *   在 `Authorization` Header 中提供你的 `access_token`。

    ```bash
    curl -X DELETE \
      http://localhost:5678/chats/YOUR_CHAT_ID \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
    ```

3.  **预期结果**:
    *   **HTTP 状态码**: `204 No Content`
    *   **响应体**: 空。
    *   **数据库验证**:
        *   对于群聊：检查 `chats` 表，确认该聊天已被删除；检查 `chat_members` 和 `messages` 表，确认所有相关记录已被级联删除。
        *   对于私聊：如果只有一方删除，则该聊天对该用户不可见，但数据库中可能仍存在。如果双方都删除，则从数据库中移除。
    *   **错误情况**: 如果当前用户没有权限删除该聊天，应返回 `403 Forbidden`。

---

### **消息 (Message) API 测试指南**

#### 前提

1.  **服务运行中**: 确保你的 Nest.js 后端服务正在运行 (`pnpm run start:dev`)
2.  **获取认证 Token**: 你需要一个有效的 `access_token` 来通过认证。
3.  **获取必要 ID**:
    *   获取一个有效的 `chatId` (群聊或私聊)。
    *   获取一个有效的 `teamMemberId` (当前认证用户，且是 `chatId` 的成员)。

---

#### 测试场景 1: 发送消息 (Send Message)

1.  **请求**:
    *   向 `/chats/{chatId}/messages` 发送 `POST` 请求。
    *   在 `Authorization` Header 中提供你的 `access_token`。
    *   请求体中包含消息内容 (`content`)、消息类型 (`type`) 和可选的回复消息 ID (`repliedToMessageId`)。

    ```bash
    # 发送文本消息
    curl -X POST \
      http://localhost:5678/chats/YOUR_CHAT_ID/messages \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
      -d '{
        "content": "你好，这是一个测试消息！",
        "type": "TEXT"
      }'

    # 回复消息
    curl -X POST \
      http://localhost:5678/chats/YOUR_CHAT_ID/messages \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
      -d '{
        "content": "回复你的消息！",
        "type": "TEXT",
        "repliedToMessageId": "MESSAGE_ID_TO_REPLY_TO"
      }'
    ```

2.  **预期结果**:
    *   **HTTP 状态码**: `201 Created`
    *   **响应体**: 返回一个 JSON 对象，包含新创建的消息的详细信息，包括 `id`, `chatId`, `senderId`, `content`, `type`, `createdAt` 等。
    *   **数据库验证**:
        *   检查 `messages` 表，确认一条新的记录已被创建，其内容和类型与请求匹配。
        *   检查 `chats` 表，确认对应 `chatId` 的 `last_message_id` 已更新为新消息的 ID。
    *   **错误情况**: 如果当前用户不是该聊天的成员，应返回 `403 Forbidden`。

---

#### 测试场景 2: 获取聊天会话的消息历史 (Get Message History)

1.  **前提**: 确保指定的 `chatId` 中存在消息。
2.  **请求**:
    *   向 `/chats/{chatId}/messages` 发送 `GET` 请求。
    *   在 `Authorization` Header 中提供你的 `access_token`。
    *   可选查询参数 `cursor` (消息 ID，用于分页) 和 `limit` (每页数量，默认 50)。

    ```bash
    # 获取最新消息
    curl -X GET \
      http://localhost:5678/chats/YOUR_CHAT_ID/messages \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'

    # 分页获取历史消息 (从某个消息 ID 之前开始)
    curl -X GET \
      "http://localhost:5678/chats/YOUR_CHAT_ID/messages?cursor=LAST_MESSAGE_ID_FROM_PREVIOUS_PAGE&limit=20" \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
    ```

3.  **预期结果**:
    *   **HTTP 状态码**: `200 OK`
    *   **响应体**: 返回一个 JSON 数组，包含指定聊天会话的消息对象。消息应按 `createdAt` 倒序排列。
    *   **数据准确性**: 确保返回的消息只属于指定的 `chatId`。
    *   **错误情况**: 如果当前用户不是该聊天的成员，应返回 `403 Forbidden`。

---

#### 测试场景 3: 更新消息 (编辑) (Update Message - Edit)

1.  **前提**: 你已经发送了一条消息，并获取了其 `messageId`，并且当前认证用户是该消息的发送者。
2.  **请求**:
    *   向 `/chats/{chatId}/messages/{messageId}` 发送 `PATCH` 请求。
    *   在 `Authorization` Header 中提供你的 `access_token`。
    *   请求体中包含要更新的消息内容 (`content`)。

    ```bash
    curl -X PATCH \
      http://localhost:5678/chats/YOUR_CHAT_ID/messages/YOUR_MESSAGE_ID \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
      -d '{
        "content": "这条消息被编辑了！"
      }'
    ```

3.  **预期结果**:
    *   **HTTP 状态码**: `200 OK`
    *   **响应体**: 返回更新后的消息对象，`content` 字段应为新内容，`isEdited` 字段应为 `true`。
    *   **数据库验证**: 检查 `messages` 表，确认 `content` 和 `is_edited` 字段已更新。
    *   **错误情况**:
        *   如果 `messageId` 不存在，应返回 `404 Not Found`。
        *   如果当前用户不是该消息的发送者，应返回 `403 Forbidden`。

---

#### 测试场景 4: 删除消息 (Delete Message)

1.  **前提**: 你已经发送了一条消息，并获取了其 `messageId`，并且当前认证用户是该消息的发送者。
2.  **请求**:
    *   向 `/chats/{chatId}/messages/{messageId}` 发送 `DELETE` 请求。
    *   在 `Authorization` Header 中提供你的 `access_token`。

    ```bash
    curl -X DELETE \
      http://localhost:5678/chats/YOUR_CHAT_ID/messages/YOUR_MESSAGE_ID \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
    ```

3.  **预期结果**:
    *   **HTTP 状态码**: `200 OK`
    *   **响应体**: 返回更新后的消息对象，`isDeleted` 字段应为 `true`，`content` 字段应为空字符串。
    *   **数据库验证**: 检查 `messages` 表，确认 `is_deleted` 字段已更新为 `true`，`content` 字段已清空。
    *   **错误情况**:
        *   如果 `messageId` 不存在，应返回 `404 Not Found`。
        *   如果当前用户不是该消息的发送者，应返回 `403 Forbidden`。

---

#### 测试场景 5: 标记消息已读 (Mark Message as Read)

1.  **前提**: 当前用户是某个聊天的成员，并且该聊天中有未读消息。
2.  **请求**:
    *   向 `/chats/{chatId}/messages/{messageId}/read` 发送 `POST` 请求。
    *   在 `Authorization` Header 中提供你的 `access_token`。

    ```bash
    curl -X POST \
      http://localhost:5678/chats/YOUR_CHAT_ID/messages/LAST_READ_MESSAGE_ID/read \
      -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
    ```

3.  **预期结果**:
    *   **HTTP 状态码**: `201 Created` (或 `200 OK`)
    *   **响应体**: `{ message: "Message marked as read." }`
    *   **数据库验证**: 检查 `chat_members` 表中当前用户的记录，确认 `last_read_message_id` 已更新为指定的 `messageId`。
    *   **错误情况**:
        *   如果 `chatId` 或 `messageId` 不存在，应返回 `404 Not Found`。
        *   如果当前用户不是该聊天的成员，应返回 `403 Forbidden`。
        *   如果 `messageId` 不属于 `chatId`，应返回 `400 Bad Request`。

---