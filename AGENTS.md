# AGENTS.md

These instructions apply to the `synaply-backend` project.

## Commit Message Rule

- Always use a conventional, structured commit message.
- Preferred format: `type(scope): short summary`
- Use lowercase `type` values such as `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `build`, `ci`, `perf`, or `revert`.
- Keep the summary concise and action-oriented.

Examples:

- `feat(issue): add realtime broadcast migration support`
- `fix(comment): align parent_id field mapping`
- `refactor(prisma): normalize schema field mapping`

## AI Runtime Guardrails

- 所有 `ai-*` 模块的 service 入口必须首行调用 `TeamMemberService.validateWorkspaceAccess`，先做 workspace 隔离，再处理业务逻辑。
- 跨模块 FK 在 SQL migration 层维护，不在 Prisma schema 里声明 Workspace/User 等反向 relation；沿用 `AiExecutionRecord` / `AiThread*` 当前模式。
- 新增 `ai-execution` action 时，只需要维护 `ACTION_DEFINITIONS`；`getActionManifest` 会自动从定义派生 manifest，不要再手工同步第二份清单。
- `ai_run_step.promptSnapshot` / `ai_run_step.responseSnapshot` 写库前必须截断到合理大小，建议每条不超过 8KB，避免单行数据过大。
