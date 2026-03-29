# UI/UX Improvement Handoff

## 1. 文档目的

这份 handoff 只聚焦 2026-03-30 这一轮首页 UI/UX 提升工作。

目标不是记录架构迁移，而是给后续接手的设计 / 前端 agent 一个清晰基线：
- 当前页面已经改到了什么程度
- 哪些方向已经被确认可接受
- 哪些尝试用户不喜欢，不要回退重做
- 下一步最值得继续打磨的点是什么

如果你需要了解 ArcGIS Online 数据接入、服务端渲染、API 路由、环境变量，请先读 `docs/HANDOFF.md`。

## 2. 本轮 UI/UX 改造目标

本轮不是重新做一个“通用 AI marketplace”，而是把首页收敛成更符合 ArcGIS / Esri 语境的 Skill Hub MVP。

核心方向：
- 从“泛化技能市场”收敛为 “ArcGIS Skill Hub”
- 语义上强调 `location intelligence`、`agentic workflows`、ArcGIS platform
- 视觉上参考 ArcGIS Online / Living Atlas 一类官方内容目录体验
- 在 MVP 范围内优先做：信息密度、卡片层级、hero 主题感、header 品牌感
- 明确避免：过度营销化、无意义装饰、大量解释性文案

## 3. 当前页面已确认的设计方向

### 3.1 Header

当前 header 已完成这些调整：
- 品牌主标题为 `ArcGIS Skill Hub`
- 副标题为 `Empowering agentic workflows across the ArcGIS platform`
- 左侧 icon 已从纯开发工具感图标，调整为更偏 `skill / capability` 语义的图标
- 右侧保留 `Browse`、`API`，并新增一个仅用于视觉占位的 `Sign in` 按钮

其中 `Sign in` 当前只是未来认证入口占位：
- 不接真实登录流程
- 仅作为视觉和信息架构预留

### 3.2 Hero

当前 hero 已确认的方向：
- 不再是纯白底文本区
- 已改为更明确可见的浅蓝主题背景
- 保持 ArcGIS/Esri 语境下相对克制的企业产品风格
- 文案已经加入 `agentic` 语义

当前 hero 主标题：
- `Bring ArcGIS skills into agentic location intelligence workflows.`

用户已明确确认：
- hero 当前状态“可以了”

### 3.3 卡片系统

卡片经历了几轮迭代，当前已确认的方向是：
- 卡片需要比最初版本更有 figure-ground
- 但不接受“顶部额外封面块”那种装饰性内容
- 卡片内部需要更紧凑，减少空白
- tag 需要更像真正的 tag / chip，而不是轻描淡写的边框文字
- stats 需要更轻更紧，不要喧宾夺主

当前卡片已调整为：
- 更强的外层边界和内容层次
- 更紧凑的内部 spacing
- tag 强度已提高
- `Views / Ratings` 已改成单条 metadata strip，而不是两块独立小卡
- 长描述支持 `Read more / Show less`

用户当前反馈：
- “卡片基本可以了”

### 3.4 Browse / Filter 区

当前 browse 区已做过一轮方向调整：
- 外层 panel 比早期更像目录容器，而不是平铺内容
- 筛选器可用，但仍然偏功能层，视觉重要性低于 hero 和 cards
- 页面整体段落间距已做过一轮收紧

这个区域还不是最终状态，后续仍可继续精修。

## 4. 用户明确不喜欢的方向

以下内容已经被用户明确否定，后续不要回退：

### 4.1 卡片顶部的额外封面内容块

用户原话：
- “我不喜欢卡片顶部多出来的这块内容，没有意义”

结论：
- 不要再在卡片顶部塞入解释性装饰块
- 卡片上方只保留真正有用的 metadata 即可

### 4.2 视觉变化过小的“微调式优化”

用户多次明确指出：
- 如果肉眼看不出区别，就等于没有改

结论：
- 后续 UI 修改不要停留在 1px 或极小 token 级微调
- 如果是要解决“看不出变化”的问题，优先做结构或层级变化，而不是细抠数值

## 5. 当前文案基线

后续若继续改文案，先从这套已确认基线出发：

### Header
- 标题：`ArcGIS Skill Hub`
- Slogan：`Empowering agentic workflows across the ArcGIS platform`

### Hero
- Overline：`ArcGIS platform`
- Badge：`Live from ArcGIS Online`
- Badge：`Location intelligence workflows`
- H1：`Bring ArcGIS skills into agentic location intelligence workflows.`

### Footer / CTA
- Footer 的开发者入口保留为 `Developer API`
- `Sign in` 已预留，但未接真实认证

## 6. 关键文件

这一轮 UI/UX 改造主要集中在以下文件：

- `src/components/header.tsx`
  - 品牌标题、slogan、logo、Sign in 占位入口

- `src/components/skill-hub-client.tsx`
  - hero、summary、browse panel、整体段距

- `src/components/skill-card.tsx`
  - 卡片层级、metadata、tag、stats、Read more

- `src/components/search-filter.tsx`
  - 搜索/分类/排序的结构和 Reset 行为

- `src/app/globals.css`
  - 全局氛围、基础色、字体、页面底色

- `src/app/layout.tsx`
  - 字体与 metadata

## 7. 本轮已完成的 UX/UI 决策

### 已完成
- 将首页品牌语义切换到 ArcGIS / agentic workflow 方向
- hero 改成明确可见的主题色背景区
- header 加入 `Sign in` 视觉占位，为未来认证留口
- 卡片内部信息密度显著收紧
- tag 与 stats 的视觉语义更清晰
- 页面段落之间的空白较早期版本已大幅收敛

### 暂不继续做
- 不接真实 ArcGIS OAuth 登录
- 不做详情页 / modal / 新路由
- 不扩展安装体验到多步工作流
- 不做大规模设计系统重构

## 8. 当前可继续提升的地方

如果后续要继续 pickup，优先级建议如下。

### 优先级 1: Browse / Filter 区的视觉层级

当前这个区域仍然相对保守。后续可继续看：
- 筛选器是否还能更像“目录控制条”而不是普通表单
- `Available skills` 标题区是否可以进一步合并进 filter 下方
- browse panel 的容器感是否要再收敛或再增强

### 优先级 2: Header 右侧动作一致性

当前 header 右侧已有三个动作：
- `Browse`
- `API`
- `Sign in`

后续需要决定：
- 未来移动端如何展示这些动作
- `API` 是否保留在 header，还是只留在 footer
- `Sign in` 接入后是跳转页、弹窗还是用户菜单

### 优先级 3: Hero 信息密度

hero 已经可接受，但不是最终极版。后续可以看：
- summary stats 是否还能压成更紧凑的信息带
- 某些辅助说明是否还可以减少一层
- Hero panel 的透明度和背景关系是否还需微调

### 优先级 4: 文案体系统一

当前已从 “generic skill marketplace” 明确收敛，但还可以继续统一：
- `agentic workflows`
- `location intelligence`
- `ArcGIS platform`
- `skills discovery and distribution`

后续如果要继续改文案，建议统一从这几个关键词发散，不要重新回到泛 AI 语言。

## 9. 验证状态

这一轮 UI/UX 调整过程中，最近几次关键变更后都已验证：
- `npm run test -- --run` 通过
- 30/30 tests passed
- `npm run build` 曾多次通过

注意：
- 本地 `npm run dev` 可能会因为已有 Next dev server 占用端口而报冲突
- 这不是当前 UI 代码问题，而是本地已有进程存在

## 10. 给下一个 Agent 的建议

如果你是接手后续 UI/UX 继续优化的 agent，建议顺序如下：

1. 先读这份文档，再读 `docs/HANDOFF.md`
2. 再读：
   - `src/components/header.tsx`
   - `src/components/skill-hub-client.tsx`
   - `src/components/skill-card.tsx`
   - `src/components/search-filter.tsx`
3. 用当前 UI 直接人工看页面，不要只看代码
4. 如果用户说“看不出区别”，优先做结构变化，不要再做弱微调
5. 不要重新引入卡片顶部无意义装饰块

## 11. 一句话总结

这一轮 UI/UX 工作，已经把首页从“能跑的目录页”推进到了“可用于团队 MVP 讨论的 ArcGIS Skill Hub 首页基线”，后续工作应该在这个基线之上继续精修，而不是重新推翻方向。