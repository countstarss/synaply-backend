P0 版本升级已完成。以下是升级总结：                                                                         
                                                                                                              
  ---                                                                                                         
  升级完成总结                                                                                                
                                                                                                              
  已完成的工作                                                                                                
                                                                                                              
  1. Prisma Schema 升级                                                                                       
  - 新增 IssueState 模型（动态状态配置）                                                                      
  - 新增 IssueStateCategory 枚举                                                                              
  - 新增 Label、IssueLabel、IssueAssignee 模型                                                                
  - Issue 模型新增字段：stateId、projectId、visibility、creatorMemberId、key、sequence                        
  - Workspace 模型新增 issuePrefix 字段                                                                       
                                                                                                              
  2. 数据库迁移                                                                                               
  - 创建迁移文件：prisma/migrations/20260128012330_issue_state_upgrade/migration.sql                          
  - 已应用到数据库                                                                                            
                                                                                                              
  3. IssueState 模块                                                                                          
  - src/issue-state/issue-state.service.ts - 状态 CRUD + 默认状态初始化                                       
  - src/issue-state/issue-state.controller.ts - REST API                                                      
  - src/issue-state/dto/ - DTO 定义                                                                           
                                                                                                              
  4. Issue Service/Controller 升级                                                                            
  - 支持新字段创建                                                                                            
  - 支持 scope 过滤（team/personal/all）                                                                      
  - 支持多种查询参数过滤                                                                                      
  - 自动生成 key/sequence                                                                                     
                                                                                                              
  5. 前端升级指导文档                                                                                         
  - docs/FRONTEND_UPGRADE_GUIDE.md                                                                            
                                                                                                              
  新增 API 端点                                                                                               
                                                                                                              
  GET    /workspaces/:workspaceId/issue-states                                                                
  POST   /workspaces/:workspaceId/issue-states                                                                
  GET    /workspaces/:workspaceId/issue-states/:id                                                            
  PATCH  /workspaces/:workspaceId/issue-states/:id                                                            
  DELETE /workspaces/:workspaceId/issue-states/:id                                                            
                                                                                                              
  GET    /workspaces/:workspaceId/issues/:id  (新增)                                                          
                                                                                                              
  向后兼容性                                                                                                  
                                                                                                              
  - 所有新字段都是可选的                                                                                      
  - 现有 API 调用无需修改即可继续工作                                                                         
  - stateId 不传时自动使用默认状态                                                                            
  - visibility 默认为 TEAM_EDITABLE


# Issue Model P0 升级 - 前端升级指导文档

## 概述

本次后端升级实现了 Issue Model 的 P0 版本，主要变更包括：
1. 新增 `IssueState` 动态状态配置（替代静态状态）
2. Issue 支持 `stateId`、`projectId`、`visibility` 等新字段
3. Issue 支持 `key`/`sequence` 编号（如 "SYN-123"）
4. 新增 `scope` 过滤（Team Issues / Personal Issues）
5. 新增 `Label` 和 `IssueAssignee` 关联

---

## 一、API 变更

### 1. 新增 API

#### IssueState 状态配置 API

```typescript
// 获取 workspace 的所有状态（首次访问会自动初始化默认状态）
GET /workspaces/:workspaceId/issue-states

// 创建新状态
POST /workspaces/:workspaceId/issue-states
Body: {
  name: string;           // 状态名称
  color?: string;         // 颜色，默认 "#6B7280"
  category?: IssueStateCategory; // 分类：BACKLOG | TODO | IN_PROGRESS | DONE | CANCELED
  position?: number;      // 排序位置
  isDefault?: boolean;    // 是否为默认状态
}

// 获取单个状态
GET /workspaces/:workspaceId/issue-states/:id

// 更新状态
PATCH /workspaces/:workspaceId/issue-states/:id
Body: {
  name?: string;
  color?: string;
  category?: IssueStateCategory;
  position?: number;
  isDefault?: boolean;
  isArchived?: boolean;   // 软删除
}

// 删除状态
DELETE /workspaces/:workspaceId/issue-states/:id
```

#### 响应示例

```json
{
  "id": "uuid",
  "workspaceId": "uuid",
  "name": "In Progress",
  "color": "#F59E0B",
  "category": "IN_PROGRESS",
  "position": 2,
  "isDefault": false,
  "isArchived": false,
  "createdAt": "2026-01-28T00:00:00.000Z",
  "updatedAt": "2026-01-28T00:00:00.000Z"
}
```

### 2. Issue 列表 API 变更

```typescript
// 获取任务列表（新增查询参数）
GET /workspaces/:workspaceId/issues

// 新增查询参数
?scope=all|team|personal    // 范围过滤（默认 all）
&stateId=uuid               // 按状态 ID 过滤
&stateCategory=TODO|IN_PROGRESS|DONE|CANCELED  // 按状态分类过滤
&projectId=uuid             // 按项目过滤
&assigneeId=uuid            // 按分配人过滤
&labelId=uuid               // 按标签过滤
&issueType=NORMAL|WORKFLOW  // 按类型过滤
&priority=LOW|NORMAL|HIGH|URGENT  // 按优先级过滤
&sortBy=createdAt|updatedAt|priority  // 排序字段
&sortOrder=asc|desc         // 排序方向
&cursor=uuid                // 分页游标
&limit=50                   // 每页数量
```

#### scope 说明

| scope | 说明 |
|-------|------|
| `all` | 返回所有 Issue（默认） |
| `team` | 仅返回 visibility 不为 PRIVATE 的 Issue |
| `personal` | 仅返回 visibility 为 PRIVATE 且 creatorMemberId 为当前用户的 Issue |

### 3. Issue 创建 API 变更

```typescript
// 创建任务
POST /workspaces/:workspaceId/issues/direct-assignee

// 新增字段
Body: {
  title: string;
  description?: string;
  directAssigneeId?: string;
  dueDate?: string;

  // P0 新增字段
  stateId?: string;         // 状态 ID（不传则使用默认状态）
  projectId?: string;       // 项目 ID
  visibility?: VisibilityType;  // PRIVATE | TEAM_READONLY | TEAM_EDITABLE | PUBLIC
  priority?: IssuePriority;     // LOW | NORMAL | HIGH | URGENT
  assigneeIds?: string[];       // 分配人 TeamMember ID 数组
  labelIds?: string[];          // 标签 ID 数组
}
```

### 4. Issue 响应结构变更

```typescript
interface Issue {
  id: string;
  title: string;
  description?: string;
  workspaceId: string;

  // P0 新增字段
  key: string;              // Issue 编号，如 "SYN-123"
  sequence: number;         // workspace 内序号
  stateId?: string;
  projectId?: string;
  visibility: VisibilityType;
  creatorMemberId?: string;

  // 关联数据（列表和详情都会返回）
  state?: IssueState;
  project?: Project;
  assignees?: IssueAssignee[];
  labels?: IssueLabel[];

  // 原有字段保留
  issueType: IssueType;
  priority: IssuePriority;
  currentStepStatus: IssueStatus;  // Workflow Issue 专用
  // ...
}
```

---

## 二、数据结构变更

### 1. 新增枚举

```typescript
// 状态分类（用于聚合统计）
enum IssueStateCategory {
  BACKLOG = 'BACKLOG',
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  CANCELED = 'CANCELED',
}

// 范围过滤
enum IssueScope {
  ALL = 'all',
  TEAM = 'team',
  PERSONAL = 'personal',
}
```

### 2. 新增类型

```typescript
interface IssueState {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  category: IssueStateCategory;
  position: number;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

interface IssueAssignee {
  id: string;
  issueId: string;
  memberId: string;
  assignedAt: string;
  member: TeamMember & { user: User };
}

interface IssueLabel {
  id: string;
  issueId: string;
  labelId: string;
  createdAt: string;
  label: Label;
}

interface Label {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## 三、前端改造建议

### 1. 状态配置动态化

**移除静态配置**

```typescript
// 删除或废弃 src/lib/data/issueConfig.tsx 中的静态状态配置
// const ISSUE_STATUSES = [...] // 不再使用
```

**新增 Hook**

```typescript
// src/hooks/useIssueStates.ts
export function useIssueStates(workspaceId: string) {
  return useQuery({
    queryKey: ['issue-states', workspaceId],
    queryFn: () => fetch(`/api/workspaces/${workspaceId}/issue-states`).then(r => r.json()),
  });
}
```

**状态渲染**

```tsx
// 使用动态状态渲染
function IssueStatusBadge({ issue }: { issue: Issue }) {
  const state = issue.state;
  if (!state) return null;

  return (
    <Badge style={{ backgroundColor: state.color }}>
      {state.name}
    </Badge>
  );
}
```

### 2. Issues 页面改造

**Tab 切换**

```tsx
// Team Workspace 下显示 Tab 切换
function IssuesPage() {
  const [scope, setScope] = useState<IssueScope>('all');

  return (
    <div>
      {workspace.type === 'TEAM' && (
        <Tabs value={scope} onValueChange={setScope}>
          <TabsList>
            <TabsTrigger value="all">All Issues</TabsTrigger>
            <TabsTrigger value="team">Team Issues</TabsTrigger>
            <TabsTrigger value="personal">Personal Issues</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <IssueList scope={scope} />
    </div>
  );
}
```

**列表请求**

```typescript
// src/lib/fetchers/issue.ts
export async function fetchIssues(workspaceId: string, params?: {
  scope?: IssueScope;
  stateId?: string;
  stateCategory?: IssueStateCategory;
  projectId?: string;
  assigneeId?: string;
  labelId?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.scope) searchParams.set('scope', params.scope);
  if (params?.stateId) searchParams.set('stateId', params.stateId);
  // ...

  return fetch(`/api/workspaces/${workspaceId}/issues?${searchParams}`);
}
```

### 3. Issue 创建弹窗改造

```tsx
function CreateIssueDialog() {
  const { data: states } = useIssueStates(workspaceId);
  const { data: projects } = useProjects(workspaceId);

  return (
    <Dialog>
      <form>
        {/* 原有字段 */}
        <Input name="title" />
        <Textarea name="description" />

        {/* P0 新增字段 */}
        <Select name="stateId">
          {states?.map(state => (
            <SelectItem key={state.id} value={state.id}>
              <span style={{ color: state.color }}>{state.name}</span>
            </SelectItem>
          ))}
        </Select>

        <Select name="projectId">
          <SelectItem value="">No Project</SelectItem>
          {projects?.map(project => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </Select>

        <Select name="visibility">
          <SelectItem value="TEAM_EDITABLE">Team Editable</SelectItem>
          <SelectItem value="TEAM_READONLY">Team Readonly</SelectItem>
          <SelectItem value="PRIVATE">Private</SelectItem>
        </Select>

        <Select name="priority">
          <SelectItem value="NORMAL">Normal</SelectItem>
          <SelectItem value="LOW">Low</SelectItem>
          <SelectItem value="HIGH">High</SelectItem>
          <SelectItem value="URGENT">Urgent</SelectItem>
        </Select>
      </form>
    </Dialog>
  );
}
```

### 4. Issue 详情页改造

```tsx
function IssueDetail({ issue }: { issue: Issue }) {
  return (
    <div>
      {/* Issue 编号 */}
      <span className="text-muted">{issue.key}</span>

      {/* 状态 */}
      <IssueStatusBadge issue={issue} />

      {/* Workflow Issue 额外显示步骤进度 */}
      {issue.issueType === 'WORKFLOW' && (
        <WorkflowProgress issue={issue} />
      )}

      {/* 分配人 */}
      <div>
        <h4>Assignees</h4>
        {issue.assignees?.map(a => (
          <Avatar key={a.id} src={a.member.user.avatarUrl} />
        ))}
      </div>

      {/* 标签 */}
      <div>
        <h4>Labels</h4>
        {issue.labels?.map(l => (
          <Badge key={l.id} style={{ backgroundColor: l.label.color }}>
            {l.label.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}
```

---

## 四、迁移注意事项

### 1. 向后兼容

- 所有新字段都是可选的，现有 Issue 创建逻辑无需立即修改
- `stateId` 不传时会自动使用 workspace 的默认状态
- `visibility` 默认为 `TEAM_EDITABLE`
- `key` 和 `sequence` 会自动生成

### 2. 状态映射

对于 Workflow Issue，`currentStepStatus` 与 `stateId` 的映射关系：

| currentStepStatus | IssueStateCategory |
|-------------------|-------------------|
| TODO | TODO |
| IN_PROGRESS | IN_PROGRESS |
| DONE | DONE |
| BLOCKED | IN_PROGRESS |

### 3. 默认状态

首次访问 `/workspaces/:id/issue-states` 时，系统会自动为 workspace 创建 5 个默认状态：

| name | category | color | isDefault |
|------|----------|-------|-----------|
| Backlog | BACKLOG | #6B7280 | false |
| Todo | TODO | #3B82F6 | true |
| In Progress | IN_PROGRESS | #F59E0B | false |
| Done | DONE | #10B981 | false |
| Canceled | CANCELED | #EF4444 | false |

---

## 五、后续规划 (P1/P2)

### P1 功能（规划中）
- Labels CRUD API
- Assignee/Watcher 管理 API
- Milestone/Cycle 支持
- IssueRelation（Blocks/Parent/Child）
- 简单的 filter + saved view

### P2 功能（规划中）
- 自定义字段
- 自动化规则
- 统计与仪表盘

---

## 六、测试建议

1. **状态配置测试**
   - 访问 `/workspaces/:id/issue-states` 验证默认状态创建
   - 创建/更新/删除自定义状态

2. **Issue 创建测试**
   - 不传 `stateId`，验证使用默认状态
   - 传入 `stateId`、`projectId`、`visibility` 等新字段

3. **Issue 列表测试**
   - 测试 `scope=team` 和 `scope=personal` 过滤
   - 测试 `stateId`、`stateCategory` 等过滤参数

4. **Issue 编号测试**
   - 验证 `key` 格式正确（如 "SYN-1"）
   - 验证 `sequence` 自增

---

如有问题，请联系后端开发。
