团队模块已经完成。

  ---

  测试方法：


  在测试团队模块之前，请确保您的 Nest.js
  服务正在运行，并且您有一个有效的 Access Token。


  测试场景 1: 创建团队

   1. 请求：


   1     curl -X POST \
   2       http://localhost:5678/teams \
   3       -H 'Content-Type: application/json' \
   4       -H 'Authorization: Bearer 
     YOUR_ACCESS_TOKEN' \
   5       -d '{
   6         "name": "My First Team"
   7       }'

   2. 预期结果：
       * 成功响应 (HTTP 201
         Created)，返回创建的团队信息，包括 id, name,
         createdAt, updatedAt。
       * members 数组中应包含当前用户作为 OWNER。
       * workspace 对象应包含一个 type: "TEAM" 的工作空间。
       * 验证数据库： 检查 public.teams
         表，确认新团队已创建。检查 public.team_members
         表，确认当前用户已作为 OWNER 加入。检查
         public.workspaces 表，确认已为团队创建了 TEAM
         类型的工作空间。

  测试场景 2: 获取用户所属的所有团队

   1. 请求：


   1     curl -X GET \
   2       http://localhost:5678/teams \
   3       -H 'Authorization: Bearer 
     YOUR_ACCESS_TOKEN'

   2. 预期结果：
       * 成功响应 (HTTP 200 OK)，返回一个数组，包含当前用
         户所属的所有团队信息。


  测试场景 3: 获取特定团队详情


   1. 前提： 您已经创建了一个团队，并获取了其 teamId。
   2. 请求：

   1     curl -X GET \
   2       http://localhost:5678/teams/YOUR_TEAM_ID
     \
   3       -H 'Authorization: Bearer 
     YOUR_ACCESS_TOKEN'

   3. 预期结果：
       * 成功响应 (HTTP 200 OK)，返回该 teamId
         对应的团队详细信息，包括成员列表和团队工作空间。

  测试场景 4: 邀请成员加入团队


   1. 前提：
       * 您已经创建了一个团队，并获取了其 teamId。
       * 您有一个已注册但未加入该团队的用户的邮箱（例如，您
         可以在 Supabase 中注册一个新用户）。
   2. 请求：


   1     curl -X POST \
   2 
     http://localhost:5678/teams/YOUR_TEAM_ID/invit
     e \
   3       -H 'Content-Type: application/json' \
   4       -H 'Authorization: Bearer 
     YOUR_ACCESS_TOKEN' \
   5       -d '{
   6         "email": "invited_user@example.com"
   7       }'

   3. 预期结果：
       * 成功响应 (HTTP 201 Created)，返回 { "message": 
         "Member invited successfully." }。
       * 验证数据库： 检查 public.team_members
         表，确认被邀请的用户已作为 MEMBER 加入该团队。

  测试场景 5: 更新团队成员角色


   1. 前提：
       * 您已经创建了一个团队。
       * 您已经邀请了一个成员加入该团队，并获取了该成员的
         userId。
       * 您的 Access Token 对应的用户是该团队的 OWNER 或
         ADMIN。
   2. 请求：


   1     curl -X PATCH \
   2 
     http://localhost:5678/teams/YOUR_TEAM_ID/membe
     rs/MEMBER_USER_ID/role \
   3       -H 'Content-Type: application/json' \
   4       -H 'Authorization: Bearer 
     YOUR_ACCESS_TOKEN' \
   5       -d '{
   6         "role": "ADMIN"
   7       }'

       * role 可以是 OWNER, ADMIN, MEMBER。
   3. 预期结果：
       * 成功响应 (HTTP 200 OK)，返回更新后的 TeamMember
         对象。
       * 验证数据库： 检查 public.team_members
         表，确认该成员的角色已更新。

  测试场景 6: 移除团队成员


   1. 前提：
       * 您已经创建了一个团队。
       * 您已经邀请了一个成员加入该团队，并获取了该成员的
         userId。
       * 您的 Access Token 对应的用户是该团队的 OWNER 或
         ADMIN。
   2. 请求：


   1     curl -X DELETE \
   2 
     http://localhost:5678/teams/YOUR_TEAM_ID/membe
     rs/MEMBER_USER_ID \
   3       -H 'Authorization: Bearer 
     YOUR_ACCESS_TOKEN'

   3. 预期结果：
       * 成功响应 (HTTP 200 OK)，返回 { "message": "Member 
         removed successfully." }。
       * 验证数据库： 检查 public.team_members
         表，确认该成员已从团队中移除。


  请您进行测试，并告诉我结果。如果一切正常，我们将进入最
  后一个模块：工作空间模块。好的，我们继续。

  ---


