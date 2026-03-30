# ArcGIS OAuth Install MVP Plan

## 1. 目标

做一个比当前 `Copy Install` 更顺的快速 MVP：

1. 用户在 Skill Hub 里选择一个 skill。
2. 用户把结构化安装 prompt 交给受支持的 agent 或 AI client app。
3. agent 识别这是一个 ArcGIS skill，并判断当前需要 ArcGIS 登录。
4. agent 打开浏览器，用户在 ArcGIS Online 登录。
5. agent 获取 OAuth token。
6. agent 使用 token 拉取 item metadata、item data 和 skill 包。
7. agent 在本地完成 skill 安装。

这个方案的重点是：
- 不要求 Skill Hub 网页直接写用户本地文件。
- 不要求任意第三方 agent 都支持。
- 只要求先支持一个受控的 agent 或 AI client app。

## 2. 适用边界

这个 MVP 适用于：
- 你们自己控制的 agent/client app。
- 可明确约束安装目录和 skill 包格式的场景。
- 只先支持 ArcGIS Online。

这个 MVP 不适用于：
- 希望网页直接安装到任意外部 agent。
- 希望任何通用 LLM client 都无需适配就能完成安装。
- 希望第一版就支持多 portal、多账户切换、复杂权限策略。

## 3. 总体架构

建议拆成 4 个模块。

### 模块 A: Skill Hub 侧安装描述输出

Skill Hub 继续负责提供结构化安装信息，但格式要从“纯自然语言”收敛成更容易被 agent 稳定解析的文本块。

建议输出内容：
- `portalUrl`
- `itemId`
- `itemUrl`
- `itemType`
- `typeKeywords`
- `accessLevel`
- `installMode=arcgis-oauth-required`

建议保留一小段自然语言说明，但把机器可解析字段放在前面。

### 模块 B: Agent 侧 OAuth 登录

agent/client app 负责：
- 识别 install prompt
- 判断当前是否已有可用 ArcGIS token
- 没有 token 时拉起浏览器登录
- 接收 OAuth callback
- 用 authorization code 换取 access token 和 refresh token

建议采用：
- ArcGIS OAuth authorization code flow
- 优先 PKCE

### 模块 C: Agent 侧 Skill 下载与解析

拿到 token 后，agent/client app 负责：
- 请求 item metadata
- 请求 item data
- 下载 zip/package
- 解压并解析 skill 内容
- 判断安装所需文件和目录结构

### 模块 D: Agent 侧本地安装器

agent/client app 需要有一个明确的本地安装执行器，负责：
- 创建目标目录
- 拷贝或解压文件
- 执行必要的 manifest 校验
- 返回安装成功或失败结果

第一版不建议做太多抽象，直接只支持一种 skill 包结构即可。

## 4. 推荐的最小流程

### 用户流程

1. 用户在 Skill Hub 复制 install block。
2. 用户把 install block 粘贴给受支持的 agent/client app。
3. app 识别到：
   - 这是 ArcGIS skill
   - 需要 OAuth 登录
4. app 如果没有有效 token，就打开浏览器去 ArcGIS 登录。
5. 用户完成登录。
6. app 拿到 token 后自动下载 skill。
7. app 完成安装并提示结果。

### 工程流程

1. 解析 install block。
2. 检查本地 token cache。
3. 若 token 不存在或过期：
   - 生成 `code_verifier`
   - 生成 `code_challenge`
   - 打开 ArcGIS `/sharing/rest/oauth2/authorize`
4. 登录回调拿到 `code`。
5. 调用 `/sharing/rest/oauth2/token` 换 token。
6. 用 token 请求：
   - `/sharing/rest/content/items/{itemId}`
   - `/sharing/rest/content/items/{itemId}/data`
7. 下载并安装。

## 5. Install Block 建议格式

建议不要只输出自由文本，第一版直接采用一个容易被 agent 解析的块格式。

示例：

```text
ARC_SKILL_INSTALL
portal_url=https://www.arcgis.com
item_id=abcd1234efgh5678
item_url=https://www.arcgis.com/home/item.html?id=abcd1234efgh5678
item_type=Code Sample
type_keywords=Agent Skill
access_level=org
auth=oauth
END_ARC_SKILL_INSTALL

Install this ArcGIS skill. If authentication is required, open a browser for ArcGIS Online OAuth login, obtain a valid token, download the item package, inspect the package contents, and install the skill locally.
```

原因：
- 机器更容易解析。
- 仍然兼容人类阅读。
- 便于后续扩展更多字段。

## 6. OAuth 建议实现方式

### 推荐方案

对 agent/client app 使用：
- authorization code flow
- PKCE

理由：
- 比直接让用户手输 token 更顺。
- 比用户名密码或 `generateToken` 更合理。
- ArcGIS 官方支持这条路线。

### 登录入口

agent/client app 打开浏览器到：
- `https://www.arcgis.com/sharing/rest/oauth2/authorize`

需要带：
- `client_id`
- `response_type=code`
- `redirect_uri`
- `code_challenge`
- `code_challenge_method=S256`

### callback 方式

第一版推荐两种方式二选一：

#### 方式 A: 本地回环地址

例如：
- `http://127.0.0.1:<port>/oauth/callback`

优点：
- 对桌面 app / 本地 agent 比较直接。
- 容易和本地安装流程串起来。

#### 方式 B: 自定义 URI scheme

例如：
- `skillhub-agent://oauth/callback`

优点：
- 用户体验更像原生应用。

第一版建议优先选方式 A，更快。

## 7. Token 管理建议

第一版只做最小能力：

- 本地安全存储：
  - `access_token`
  - `refresh_token`
  - `expires_at`
  - `portal_url`
  - `username`（若返回）

- 每次安装前：
  - 先检查 token 是否有效
  - 若 access token 过期则尝试 refresh
  - refresh 失败才重新拉起浏览器登录

不要在第一版里做：
- 多账户切换 UI
- 复杂 token 管理面板
- 跨 portal 的高级策略

## 8. Skill 下载与安装边界

### 第一版建议只支持

- 单一 ArcGIS Online portal
- 单一 skill 包结构
- 单一安装目录约定
- 单一目标 agent/client app

### 安装前校验

至少要做：
- item type 校验
- type keywords 校验
- package 是否可下载
- package 解压是否成功
- manifest 或关键入口文件是否存在

### 安装失败处理

至少要返回：
- 登录失败
- token 失效
- item 无访问权限
- package 下载失败
- package 结构不符合预期
- 本地写入失败

## 9. 快速 MVP 的最小交付范围

如果目标是“尽快先跑通一版”，建议只交付以下能力：

### Skill Hub 侧

- 将 `installPrompt` 改成稳定的 install block 格式
- 保留现有 `Copy Install` 入口即可

### Agent/client app 侧

- 新增 `arcgis skill install` handler
- 能解析 install block
- 能拉起 ArcGIS OAuth 登录
- 能拿到 token
- 能下载 skill 包
- 能安装到本地固定目录

### 不进入第一版范围

- 网页内一键安装
- 通用第三方 agent 兼容
- 复杂 UI
- 复杂多账户管理
- 管理后台

## 10. 实施优先级

### P0

1. 定 install block schema
2. 注册 ArcGIS OAuth app
3. 在 agent/client app 中打通浏览器登录 + callback
4. 完成 token exchange
5. 完成 item download
6. 完成本地安装

### P1

1. access token 过期自动 refresh
2. 更明确的错误提示
3. 安装结果页或日志

### P2

1. 多账户支持
2. 多 portal 支持
3. 更智能的 skill 包解析

## 11. 风险点

最主要的风险不是 OAuth 本身，而是以下几点：

1. 目标 agent/client app 是否有稳定的本地安装入口
2. skill 包结构是否稳定
3. OAuth callback 在本地环境是否容易接收
4. token 存储方式是否安全且足够简单
5. 用户组织权限是否允许访问目标 item

## 12. 推荐结论

这个方案适合作为下一阶段的快速 MVP，因为它比“手动复制 prompt 再手动找 token”明显顺，同时又避免了“网页直接安装任意外部 agent”这种当前不现实的目标。

最务实的做法是：
- Skill Hub 只负责输出可解析的安装描述。
- 受控 agent/client app 负责 OAuth、下载和本地安装。

先把这条链路在一个受控客户端里跑通，再决定要不要把它做成更通用的安装生态。