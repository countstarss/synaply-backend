# GraphQL API 测试指南

本指南介绍如何使用 GraphQL API 进行复杂查询。GraphQL 端点位于 `http://localhost:5678/graphql`。

## 目录

1. [GraphQL Playground](#graphql-playground)
2. [认证配置](#认证配置)
3. [查询示例](#查询示例)
   - [获取用户工作空间详情](#获取用户工作空间详情)
   - [工作空间统计信息](#工作空间统计信息)
   - [项目详情与依赖图](#项目详情与依赖图)
   - [搜索任务](#搜索任务)
   - [团队工作负载](#团队工作负载)

## GraphQL Playground

启动服务后，访问 `http://localhost:5678/graphql` 即可打开 GraphQL Playground，这是一个交互式的 GraphQL IDE。

## 认证配置

在 GraphQL Playground 的 HTTP Headers 中添加：

```json
{
  "Authorization": "Bearer YOUR_ACCESS_TOKEN"
}
```

## 查询示例

### 获取用户工作空间详情

这个查询一次性获取用户的所有工作空间及其关联的项目、工作流、团队成员等信息。

```graphql
query MyWorkspacesWithDetails {
  myWorkspacesWithDetails {
    id
    name
    type
    createdAt
    
    # 个人工作空间的用户信息
    user {
      id
      email
      name
      avatarUrl
    }
    
    # 团队工作空间的团队信息
    team {
      id
      name
      members {
        id
        role
        user {
          id
          email
          name
        }
      }
    }
    
    # 工作空间下的项目
    projects {
      id
      name
      description
      createdAt
    }
    
    # 工作空间下的工作流
    workflows {
      id
      name
      status
      steps {
        id
        name
        order
        assignee {
          id
          user {
            email
            name
          }
        }
      }
    }
  }
}
```

### 工作空间统计信息

获取特定工作空间的详细统计数据，包括任务状态分布、优先级分布、逾期任务等。

```graphql
query WorkspaceStatistics($workspaceId: ID!) {
  workspaceStats(workspaceId: $workspaceId) {
    workspaceId
    totalProjects
    totalIssues
    teamMembersCount
    overdueIssues
    
    # 按状态分组的任务数量
    issuesByStatus {
      status
      count
    }
    
    # 按优先级分组的任务数量
    issuesByPriority {
      priority
      count
    }
    
    # 即将到期的任务（7天内）
    upcomingDeadlines {
      id
      title
      dueDate
      priority
      directAssignee {
        user {
          email
          name
        }
      }
    }
  }
}
```

变量：
```json
{
  "workspaceId": "YOUR_WORKSPACE_ID"
}
```

### 项目详情与依赖图

获取项目的所有任务及其依赖关系，自动构建依赖图。

```graphql
query ProjectDetailsWithDependencies($projectId: ID!) {
  projectDetails(projectId: $projectId) {
    id
    name
    description
    workspace {
      id
      name
      type
    }
    
    # 项目下的所有任务
    issues {
      id
      title
      description
      status
      priority
      dueDate
      startDate
      
      # 任务创建者
      creator {
        user {
          email
          name
        }
      }
      
      # 直接负责人
      directAssignee {
        user {
          email
          name
        }
      }
      
      # 工作流信息
      workflow {
        id
        name
        status
      }
      
      currentStep {
        id
        name
        order
      }
      
      # 父子任务关系
      parentTask {
        id
        title
      }
      
      subtasks {
        id
        title
        status
      }
      
      # 评论
      comments {
        id
        content
        author {
          user {
            email
            name
          }
        }
        createdAt
      }
      
      # 活动历史
      activities {
        id
        fromStepName
        toStepName
        comment
        actor {
          user {
            email
            name
          }
        }
        createdAt
      }
    }
    
    # 任务依赖图
    dependencyGraph {
      nodes {
        id
        title
        status
        priority
      }
      edges {
        from
        to
        type
      }
    }
  }
}
```

变量：
```json
{
  "projectId": "YOUR_PROJECT_ID"
}
```

### 搜索任务

跨工作空间搜索任务，支持多种过滤条件。

```graphql
query SearchIssuesAcrossWorkspaces(
  $searchTerm: String!
  $filters: IssueSearchFilters
) {
  searchIssues(searchTerm: $searchTerm, filters: $filters) {
    id
    title
    description
    status
    priority
    dueDate
    
    workspace {
      id
      name
    }
    
    project {
      id
      name
    }
    
    creator {
      user {
        email
        name
      }
    }
    
    directAssignee {
      user {
        email
        name
      }
    }
    
    workflow {
      id
      name
    }
    
    currentStep {
      id
      name
    }
  }
}
```

变量示例（搜索所有包含"登录"的高优先级未完成任务）：
```json
{
  "searchTerm": "登录",
  "filters": {
    "priority": "HIGH",
    "status": "TODO"
  }
}
```

可用的过滤器选项：
- `status`: TODO, IN_PROGRESS, BLOCKED, DONE
- `priority`: LOW, NORMAL, HIGH, URGENT
- `assigneeId`: 特定负责人的 ID
- `projectId`: 特定项目的 ID
- `workspaceId`: 特定工作空间的 ID

### 团队工作负载

查看团队所有成员的工作负载分布。

```graphql
query TeamMemberWorkload($teamId: ID!) {
  teamWorkload(teamId: $teamId) {
    member {
      id
      role
      user {
        id
        email
        name
        avatarUrl
      }
    }
    todoCount
    inProgressCount
    blockedCount
    overdueCount
    totalActiveIssues
  }
}
```

变量：
```json
{
  "teamId": "YOUR_TEAM_ID"
}
```

## GraphQL 的优势展示

### 1. 灵活的数据获取

RESTful API 可能需要多次请求：
```bash
# RESTful 方式需要多个请求
GET /workspaces
GET /workspaces/{id}/projects
GET /workspaces/{id}/workflows
GET /teams/{id}/members
```

GraphQL 一次请求获取所有需要的数据：
```graphql
query {
  myWorkspacesWithDetails {
    id
    name
    projects { id, name }
    workflows { id, name, status }
    team { members { user { email } } }
  }
}
```

### 2. 避免过度获取

只请求需要的字段，减少网络传输：
```graphql
# 只获取任务标题和状态
query {
  searchIssues(searchTerm: "bug") {
    id
    title
    status
  }
}
```

### 3. 复杂关系的高效查询

一次查询获取多层嵌套的关系数据：
```graphql
query {
  projectDetails(projectId: "...") {
    issues {
      creator { user { name } }
      directAssignee { user { name } }
      comments { author { user { name } } }
      activities { actor { user { name } } }
      subtasks { title, status }
    }
    dependencyGraph { nodes { id }, edges { from, to } }
  }
}
```

## 性能注意事项

1. **查询深度限制**：避免过深的嵌套查询
2. **分页**：对于大量数据，使用分页参数
3. **字段选择**：只请求需要的字段
4. **缓存**：GraphQL 客户端通常提供智能缓存功能

## 错误处理

GraphQL 错误会在 `errors` 字段返回：
```json
{
  "data": null,
  "errors": [
    {
      "message": "Workspace not found or access denied",
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ]
}
```

## 下一步

1. **添加 Mutations**：实现 GraphQL 的创建、更新、删除操作
2. **订阅 (Subscriptions)**：实现实时数据更新
3. **DataLoader**：优化 N+1 查询问题
4. **字段级权限**：实现更细粒度的权限控制



# 完成的功能：

  1. 安装依赖：
    - @nestjs/graphql
    - @nestjs/apollo
    - @apollo/server
    - graphql
  2. 配置 GraphQL：
    - 在 AppModule 中配置了 GraphQL 模块
    - 启用了 GraphQL Playground
    - 配置了自动生成 schema 文件
  3. 创建类型定义：
    - User、Team、TeamMember
    - Workspace、Project
    - Issue、Workflow、WorkflowStep
    - Comment、IssueActivity、IssueDependency
  4. 实现复杂查询 Resolvers：
    - myWorkspacesWithDetails - 获取用户所有工作空间的详细信息
    - workspaceStats - 工作空间统计数据
    - projectDetails - 项目详情及依赖图
    - searchIssues - 跨工作空间搜索任务
    - teamWorkload - 团队成员工作负载分析
  5. 创建测试文档：
    - 详细的 GraphQL 查询示例
    - 认证配置说明
    - GraphQL 优势展示

  架构设计：

  - 基础 CRUD 操作：继续使用 RESTful API
  - 复杂查询：使用 GraphQL，避免 N+1 查询问题
  - 认证：复用现有的 Supabase 认证机制
  - 权限控制：在 resolver 中验证用户权限

  GraphQL 端点：

  - URL: http://localhost:5678/graphql
  - 支持 GraphQL Playground 交互式调试

  这种混合架构让您能够：
  - 保持现有 RESTful API 的简单性
  - 利用 GraphQL 处理复杂的关联查询
  - 减少前端的网络请求次数
  - 提供灵活的数据获取能力