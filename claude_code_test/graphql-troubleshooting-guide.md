# GraphQL Playground 详细使用指南

## 1. 启动服务

确保服务正常启动：

```bash
cd synaply-backend
pnpm run start:dev
```

## 2. 访问 GraphQL Playground

在浏览器中访问：`http://localhost:5678/graphql`

如果端口 5678 被占用，可以修改 `src/main.ts` 中的端口号。

## 3. 配置认证

### 步骤 1：获取 Access Token

首先，你需要通过 Supabase 获取一个有效的 access token。可以通过以下方式之一：

1. **使用前端应用登录后获取**
2. **使用 curl 命令直接调用 Supabase API**：

```bash
# 使用邮箱密码登录
curl -X POST 'YOUR_SUPABASE_URL/auth/v1/token?grant_type=password' \
  -H 'Content-Type: application/json' \
  -H 'apikey: YOUR_SUPABASE_ANON_KEY' \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

### 步骤 2：在 Playground 中设置 Headers

1. 打开 GraphQL Playground
2. 在左下角找到 "HTTP HEADERS" 标签
3. 点击并添加以下内容：

```json
{
  "Authorization": "Bearer YOUR_ACCESS_TOKEN_HERE"
}
```

注意：将 `YOUR_ACCESS_TOKEN_HERE` 替换为实际的 token。

## 4. 测试查询

### 简单查询示例

先尝试一个最简单的查询来验证连接是否正常：

```graphql
query TestConnection {
  myWorkspacesWithDetails {
    id
    name
    type
  }
}
```

### 如果遇到错误

1. **"Unauthorized" 错误**
   - 检查 token 是否正确
   - 确认 token 没有过期
   - 确认 Headers 格式正确（注意 Bearer 后有空格）

2. **"Cannot return null for non-nullable field" 错误**
   - 这通常意味着数据库中某些必需字段为空
   - 检查数据库数据完整性

3. **"Schema not found" 错误**
   - 确保服务已经完全启动
   - 检查 `src/schema.gql` 文件是否生成

## 5. 完整查询示例

### 获取工作空间列表

```graphql
query GetMyWorkspaces {
  myWorkspacesWithDetails {
    id
    name
    type
    createdAt
    
    # 如果是个人工作空间
    user {
      id
      email
      name
    }
    
    # 如果是团队工作空间
    team {
      id
      name
      members {
        id
        role
        user {
          email
        }
      }
    }
  }
}
```

### 获取工作空间统计（需要提供 workspaceId）

```graphql
query GetWorkspaceStats($workspaceId: ID!) {
  workspaceStats(workspaceId: $workspaceId) {
    totalProjects
    totalIssues
    overdueIssues
    teamMembersCount
    
    issuesByStatus {
      status
      count
    }
    
    issuesByPriority {
      priority
      count
    }
  }
}
```

Variables:
```json
{
  "workspaceId": "实际的工作空间ID"
}
```

## 6. 常见问题排查

### 问题 1：Playground 页面无法加载

**解决方案**：
1. 确认服务是否启动成功
2. 检查控制台是否有错误信息
3. 尝试清除浏览器缓存
4. 检查是否有代理或防火墙阻止连接

### 问题 2：查询返回 null 或错误

**解决方案**：
1. 先确认用户是否有数据：
   ```bash
   # 使用 REST API 测试
   curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5678/workspaces
   ```

2. 检查数据库连接：
   ```bash
   pnpm prisma studio
   ```

3. 查看服务器日志，了解具体错误

### 问题 3：认证失败

**解决方案**：
1. 确认 token 格式正确
2. 检查 token 是否过期
3. 确认 Supabase 配置正确（检查 .env 文件）

## 7. 调试技巧

### 启用详细日志

在 `src/app.module.ts` 中的 GraphQL 配置中添加：

```typescript
GraphQLModule.forRoot<ApolloDriverConfig>({
  driver: ApolloDriver,
  autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
  sortSchema: true,
  playground: true,
  debug: true,  // 添加这行
  context: ({ req }) => ({ req }),
}),
```

### 查看生成的 Schema

检查 `src/schema.gql` 文件，确认所有查询都已正确生成。

### 使用 curl 测试 GraphQL

如果 Playground 有问题，可以直接使用 curl：

```bash
curl -X POST http://localhost:5678/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "{ myWorkspacesWithDetails { id name type } }"
  }'
```

## 8. 检查清单

在使用 GraphQL 之前，请确认：

- [ ] NestJS 服务正在运行
- [ ] 端口 5678 没有被其他服务占用
- [ ] 已获取有效的 Supabase access token
- [ ] 数据库连接正常
- [ ] 用户在数据库中有相关数据（工作空间、团队等）
- [ ] `src/schema.gql` 文件已生成

## 9. 示例：从零开始

1. **启动服务**
   ```bash
   pnpm run start:dev
   ```

2. **等待服务完全启动**
   看到日志：`Nest application successfully started`

3. **打开浏览器**
   访问：`http://localhost:5678/graphql`

4. **设置认证头**
   在 HTTP HEADERS 中添加：
   ```json
   {
     "Authorization": "Bearer YOUR_TOKEN"
   }
   ```

5. **运行测试查询**
   ```graphql
   {
     myWorkspacesWithDetails {
       id
       name
     }
   }
   ```

如果以上步骤都正确执行但仍有问题，请检查服务器控制台的错误日志。