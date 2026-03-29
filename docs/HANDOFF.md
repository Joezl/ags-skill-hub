# Skill Hub Handoff

## 1. 当前状态

截至 2026-03-29，Skill Hub 已完成从本地 mock 数据目录页到 ArcGIS Online 实时数据目录的第一轮迁移。

当前能力：
- 首页会在服务端实时读取 ArcGIS Online 组织内的 Agent Skill items。
- 前端仍保留本地搜索、分类筛选、排序交互。
- 每张卡片已展示标题、描述、标签、最近更新时间，并将 `Views` 作为当前阶段的“下载量替代语义”。
- 卡片支持复制安装提示文本，内容包含原始 ArcGIS item URL 和自然语言安装指引。
- `npm run type-check`、`npm run test -- --run`、`npm run build` 均已通过。

当前这一版可以作为后续 UI/UX 精修、安装体验优化、OAuth 认证升级的基础版本继续推进。

## 2. 已完成的关键决策

### 2.1 运行模式

项目不再使用 static export。

原因：
- 数据源是私有或组织内可见的 ArcGIS Online items。
- 用户要求每次打开页面或刷新时都获取最新数据。
- 访问 token 不能暴露到前端。

因此当前方案改为：
- 首页使用服务端动态渲染。
- 通过 Next Route Handler 提供统一的 skills API。
- 所有 ArcGIS 请求都在服务端发起，使用本地环境变量中的 token。

### 2.2 数据来源

当前技能列表来自 ArcGIS Online search API，默认查询条件为：

`orgid:oC086ufSSQ6Avnw2 AND type:"Code Sample" AND typekeywords:"Agent Skill"`

这套查询已经验证可以命中多个真实 skill items。

### 2.3 安装体验

当前没有继续沿用原来 mock 时代的固定 shell 命令模式。

当前实现采用：
- 复制一段安装提示文本。
- 提示文本里包含 item URL、portal URL、item ID、access level，以及让外部 AI editor/agent 继续完成安装的自然语言说明。

这只是第一版。后续可以继续细化文案、按钮命名和多按钮分工。

## 3. 当前架构

### 3.1 页面数据流

1. `src/app/page.tsx`
   - 服务端调用 `getArcGISSkills()`。
   - 成功时将 skills 传给客户端目录组件。
   - 失败时返回空列表并展示错误横幅。

2. `src/components/skill-hub-client.tsx`
   - 承担前端搜索、筛选、排序和列表渲染。

3. `src/components/skill-card.tsx`
   - 渲染单个技能卡片。
   - 复制 `installPrompt`。
   - 外链跳转到原始 ArcGIS item 页面。

### 3.2 服务端数据层

核心逻辑在 `src/lib/arcgis.ts`：
- 从环境变量读取 portal、org、token、max items、可选 query。
- 请求 ArcGIS search API。
- 将原始 item 映射到前端统一的 `Skill` 类型。
- 生成 `installPrompt`。
- 推断 `category`。
- 对不适合直接展示在卡片上的结构化 description 做清洗和 fallback。

### 3.3 API 层

`src/app/api/skills/route.ts` 提供动态 route：
- `GET /api/skills`
- Node.js runtime
- `force-dynamic`

这个接口目前已经可用，但首页当前是直接在服务端页面里调用数据层，不依赖浏览器再请求一次 API。

## 4. 关键文件清单

建议后续 agent 先读这些文件：

- `next.config.ts`
  - 已移除 `output: 'export'`
  - 仍保留 `distDir: 'dist'` 和 `basePath: '/skill-hub'`

- `src/lib/arcgis.ts`
  - ArcGIS 数据接入主入口
  - 查询参数、映射策略、install prompt 生成都在这里

- `src/types/skill.ts`
  - 当前 `Skill` 类型定义
  - 已扩展出 `access`、`averageRating`、`portalUrl`、`snippet`、`thumbnailUrl`、`type`、`typeKeywords`

- `src/app/page.tsx`
  - 首页服务端读取逻辑

- `src/components/skill-hub-client.tsx`
  - 客户端交互和信息架构

- `src/components/skill-card.tsx`
  - 卡片展示和复制行为

- `src/components/search-filter.tsx`
  - 当前筛选和排序文案

- `src/app/api/skills/route.ts`
  - 可复用的数据 API

- `src/lib/arcgis.test.ts`
  - 映射逻辑和 install prompt 的测试样例

## 5. 环境配置

当前实现依赖本地 `.env.local`。

已使用的环境变量：
- `ARCGIS_PORTAL_URL`
- `ARCGIS_ORG_ID`
- `ARCGIS_ACCESS_TOKEN`
- `ARCGIS_MAX_ITEMS`
- `ARCGIS_AGENT_SKILL_QUERY`（可选）

说明：
- `.env.local` 已被 gitignore 忽略，不会进入远程仓库。
- 当前 token 是本地开发态方案，不是最终生产认证方案。
- 后续若引入 OAuth，需要重构这一层，但可以保留 `arcgis.ts` 的大部分映射逻辑。

## 6. 当前 UI/数据语义说明

有几处是“为了快速接上真实数据”做的兼容性处理，后续 agent 需要知情：

### 6.1 `downloads` 实际承载的是 `numViews`

`Skill` 类型里的 `downloads` 字段目前仍然存在，但页面展示文案已经改成 `Views`。

原因：
- ArcGIS item 没有直接可用的标准“下载量”字段。
- 当前阶段先用 `numViews` 承载这类热度信息。

后续如果要继续演进，建议选一个方向：
- 方向 A：保留内部字段名不动，只继续改 UI 文案。
- 方向 B：正式把 `downloads` 重命名为 `views`，同步修改类型、组件和测试。

### 6.2 `stars` 实际承载的是 `numRatings`

页面文案已经改为 `Ratings`，但内部字段名仍是 `stars`，属于同类兼容处理。

### 6.3 安装按钮文案还未最终定稿

当前复制按钮仍显示 `Copy Install`。

用户已经明确表达：
- 不太认可之前提议的 `Copy Install Prompt` 这个命名。

因此后续 agent 在改按钮文案前，建议先把整体安装体验一并设计，而不是只改单个 label。

## 7. 已验证结果

已完成并通过的验证：

### 7.1 类型检查

命令：
`npm run type-check`

结果：通过。

### 7.2 测试

命令：
`npm run test -- --run`

结果：通过。

当前已知通过的测试包括：
- `src/lib/arcgis.test.ts`
- `src/components/__tests__/skill-card.test.tsx`
- 以及项目中已有的类型、数据、utils 测试

### 7.3 生产构建

命令：
`npm run build`

结果：通过。

构建输出确认：
- `/` 为动态 route
- `/api/skills` 为动态 route
- `/_not-found` 为静态 route

## 8. 当前已知问题和注意事项

### 8.1 Next workspace root warning

构建时会出现一个 warning：
- Next 推断 workspace root 到上层目录，因为检测到多个 lockfile。

这不会阻塞当前开发，但后续可以考虑：
- 清理多余 lockfile，或
- 在 Next 配置里显式设置 Turbopack root

### 8.2 `discussion_summary.md` 曾经记录了旧运行模式

旧内容停留在 static export 时代，已经不适用于当前实现。

如果后续 agent 依赖历史总结，请优先以本 handoff 文档和当前代码为准。

### 8.3 `src/data/skills.ts` 仍然保留

当前首页已经不再依赖这个 mock 数据文件，但它还在仓库里，并且相关测试还存在。

后续可以选择：
- 保留为 fallback fixture
- 或在数据层稳定后清理掉

## 9. 建议的下一阶段工作

### 优先级 1: 安装体验细化

建议从整体交互而不是单个按钮文案入手，重点包括：
- 卡片应该保留几个动作按钮
- 复制的文本结构是否需要更短、更像给 AI agent 的 instruction block
- 是否拆成 `Open Item`、`Copy URL`、`Copy Install` 三类动作
- 是否在 UI 上显式展示这是“需要登录 ArcGIS 才能访问的私有 skill”

### 优先级 2: UI/UX 精简和重新编排

这是用户已经明确提出的下一大块工作。建议聚焦：
- 减少首页上不必要的说明文字
- 收紧 Hero 区和统计区的信息密度
- 调整卡片层级，让 metadata 更聚焦
- 根据真实数据规模重新看筛选控件是否需要保留全部维度

### 优先级 3: OAuth 认证升级

当前仅是本地 token 驱动的开发实现。后续如果要进入更稳妥的生产方案，需要设计：
- ArcGIS OAuth 登录方式
- token 存储位置和刷新策略
- 服务端会话模型
- 多环境配置方式

建议把这部分视为独立工作流，不要把它和 UI/UX 改动混在一个 PR 里。

### 优先级 4: 领域模型清理

当 UI 和认证方案稳定后，可以做一轮命名和数据结构收敛：
- `downloads` -> `views`
- `stars` -> `ratings`
- 明确哪些字段是 ArcGIS 原始元数据，哪些字段是 Hub 派生字段

## 10. 给下一个 Agent 的执行建议

如果你是接手这个项目的后续 agent，建议顺序如下：

1. 先读 `src/lib/arcgis.ts`、`src/types/skill.ts`、`src/app/page.tsx`、`src/components/skill-hub-client.tsx`。
2. 再确认 `.env.local` 已配置且当前 token 可用。
3. 用 `npm run test -- --run` 和 `npm run build` 先验证本地基线。
4. 再选择一个清晰边界的方向继续做：
   - 安装体验
   - UI/UX 精简
   - OAuth 认证
   - 字段命名清理

不建议一开始就同时改这四块，因为它们会互相影响，容易把当前已验证的可运行基线打散。

## 11. 总结

这一轮工作的结果不是“把 mock 数据替换成另一份静态数据”，而是已经完成：
- 从真实 ArcGIS Online 组织中检索多个 Agent Skill items
- 在服务端实时读取并映射到 Skill Hub
- 在页面中保留现有交互能力继续展示
- 为后续的安装 UX 和 OAuth 升级留下了清晰扩展点

接下来的工作，适合由其他 agent 在这个基线之上继续做细化，而不是重新推翻当前架构。