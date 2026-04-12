# Synaply Backend

Synaply Backend 是 Synaply 的后端服务，负责承载协作领域模型、认证校验、项目与事项逻辑、文档与收件箱能力，以及 AI 执行相关的服务端接口。

它不是一个通用脚手架项目，而是服务于 Synaply 这套产品模型的 NestJS API：

`Project -> Issue -> Workflow -> Doc -> Inbox`

如果你想看整个产品的定位、前后端关系和本地联调方式，请优先回到根仓库。

## 服务职责

这个服务当前主要负责：

- 基于 Supabase JWT 的用户认证与权限校验
- 项目、事项、状态流转、依赖、评论等协作对象的服务端逻辑
- Workflow / handoff / review / unblock 等协作动作
- Docs、Inbox、Workspace、Team 等业务模块
- AI execution、AI thread、AI context 等 AI 相关服务端能力
- GraphQL schema 暴露、Swagger 文档和 REST 接口
- Prisma 与 PostgreSQL 的数据访问层

## 技术栈

- NestJS 10
- Apollo GraphQL
- Swagger
- Prisma 7
- PostgreSQL
- Supabase Auth
- Jest

## 当前模块

从当前代码结构看，后端已经包含这些主要模块：

- `auth`
- `user`
- `team`
- `workspace`
- `project`
- `issue`
- `issue-state`
- `workflow`
- `doc`
- `comment`
- `calendar`
- `task`
- `inbox`
- `ai-execution`
- `ai-thread`
- `ai-context`

这些模块共同服务于 Synaply 的核心协作链路，而不是彼此独立的工具箱。

## API 入口

默认本地端口是 `5678`。

常用入口如下：

- Health: `GET /health`
- Swagger: `/api`
- GraphQL: `/graphql`

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

先复制模板：

```bash
cp .env.example .env
```

后端启动至少需要这些变量：

```env
PORT=5678
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SUPABASE_URL=http://127.0.0.1:54321
JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
```

说明：

- `DATABASE_URL` 应指向本地 Supabase 启动出来的 Postgres
- `SUPABASE_URL` 用于 JWT issuer 与相关服务通信
- `JWT_SECRET` 必须与本地 Supabase 配置保持一致，且长度至少 32 位
- `PORT` 默认是 `5678`

如果你是从根仓库进行联调，建议按根目录的部署文档先启动本地 Supabase，再回到这里启动后端。

### 3. 启动开发服务

```bash
pnpm start:dev
```

### 4. 验证服务

```bash
curl http://localhost:5678/health
```

预期会返回类似：

```json
{
  "status": "ok",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

## 常用命令

```bash
pnpm start:dev
pnpm build
pnpm start:prod
pnpm test
pnpm test:e2e
pnpm lint
```

## 数据与认证

当前服务默认围绕本地 Supabase 开发环境工作：

- 数据库存储使用 PostgreSQL
- 用户认证依赖 Supabase JWT
- Prisma 负责数据库访问与 schema 管理

这意味着：

- 不要把本地 `.env` 提交进仓库
- 不要把 `service_role`、OAuth secret 或其他本地密钥写进代码
- 涉及本地基础设施时，应优先参考根仓库的 `DEPLOYMENT.md`

## 仓库结构

```text
synaply-backend/
├── src/
│   ├── auth/
│   ├── project/
│   ├── issue/
│   ├── workflow/
│   ├── doc/
│   ├── inbox/
│   ├── ai-execution/
│   ├── ai-thread/
│   ├── ai-context/
│   └── prisma/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── test/
├── docs/
├── .env.example
└── package.json
```

## 开发原则

如果你准备修改这个服务，建议优先遵循这些原则：

- 保持领域模型围绕 Synaply 的核心协作链路
- 优先让 handoff、blocker、review、decision context 这些协作动作更清晰
- 不要把后端扩展成和产品定位无关的通用管理平台
- 改动接口、认证方式或本地启动方式时，同步更新文档

## 与前端的关系

`synaply-backend` 不是独立产品，而是 Synaply 整体系统中的后端服务。

前端仓库负责：

- 产品界面
- 国际化路由
- 文档编辑体验
- workflow 可视化

后端仓库负责：

- 领域逻辑
- 权限与认证
- API 暴露
- 数据持久化

## License

本仓库当前采用 `Elastic License 2.0 (ELv2)`。

这意味着源码公开可见并可在许可范围内使用，但不应被表述成标准 OSI 开源项目。更准确的说法是：`source-available`。

如果要将 Synaply 本身作为 hosted / managed service 对外提供，需要额外的商业授权。
