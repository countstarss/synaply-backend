# GraphQL 快速开始指南

## 步骤 1：确保服务正在运行

```bash
# 停止所有可能的进程
pkill -f node

# 启动服务
cd /Users/luke/Synaply/synaply-backend
pnpm run start:dev
```

等待看到日志：
```
[Nest] XXXXX  - ... LOG [NestApplication] Nest application successfully started
```

## 步骤 2：获取有效的 Access Token

### 方法 A：使用已有的 Token

如果你已经有一个有效的 token（例如从前端应用获取的），直接使用即可。

### 方法 B：使用 REST API 测试现有 Token

先用 REST API 测试你的 token 是否有效：

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5678/auth/me
```

如果返回用户信息，说明 token 有效。

## 步骤 3：访问 GraphQL Playground

1. 打开浏览器
2. 访问：`http://localhost:5678/graphql`
3. 你应该看到 GraphQL Playground 界面

## 步骤 4：设置认证

1. 在 Playground 界面中，找到左下角的 "HTTP HEADERS" 标签
2. 点击展开
3. 输入以下内容（替换为你的实际 token）：

```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## 步骤 5：运行第一个查询

在左侧查询编辑器中输入：

```graphql
query GetMyWorkspaces {
  myWorkspacesWithDetails {
    id
    name
    type
  }
}
```

点击运行按钮（播放图标）。

## 如果遇到问题

### 1. Playground 页面显示 "Cannot GET /graphql"

这是正常的，GraphQL endpoint 只接受 POST 请求。请确保：
- 访问的是 `http://localhost:5678/graphql`（不是 https）
- 服务正在运行

### 2. 查询返回 "Unauthorized"

检查：
- Token 是否正确设置在 HTTP HEADERS 中
- Token 格式是否正确（注意 Bearer 后面有空格）
- Token 是否过期

### 3. 查询返回错误 "Cannot return null for non-nullable field"

这表示你的数据库中可能没有数据。先创建一些测试数据：

```bash
# 使用 REST API 创建工作空间
curl -X POST http://localhost:5678/workspaces \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "测试工作空间", "type": "PERSONAL"}'
```

### 4. 端口被占用

如果 5678 端口被占用，可以修改 `src/main.ts`：

```typescript
await app.listen(3000); // 改为其他端口
```

## 使用 curl 测试（如果 Playground 有问题）

```bash
# 测试 GraphQL endpoint
curl -X POST http://localhost:5678/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "{ myWorkspacesWithDetails { id name type } }"
  }' | json_pp
```

## 示例查询

### 1. 最简单的查询

```graphql
{
  myWorkspacesWithDetails {
    id
    name
  }
}
```

### 2. 带变量的查询

Query:
```graphql
query GetStats($workspaceId: ID!) {
  workspaceStats(workspaceId: $workspaceId) {
    totalProjects
    totalIssues
  }
}
```

Variables:
```json
{
  "workspaceId": "你的工作空间ID"
}
```

## 验证 GraphQL 是否正常工作

运行这个简单的 Node.js 脚本：

```javascript
// 保存为 test.js
const http = require('http');

const postData = JSON.stringify({
  query: '{ __typename }'
});

const options = {
  hostname: 'localhost',
  port: 5678,
  path: '/graphql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Authorization': 'Bearer YOUR_TOKEN'
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(postData);
req.end();
```

运行：`node test.js`

如果返回 `{"data":{"__typename":"Query"}}`，说明 GraphQL 正常工作。