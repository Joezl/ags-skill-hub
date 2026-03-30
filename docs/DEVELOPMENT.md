# Skill Hub - 开发规范

**版本**: 1.0  
**日期**: 2026-03-25

---

## 1. Git 工作流

### 1.1 分支策略 (GitHub Flow)

```
main (protected)
  ↑
feature/US-001-search-filter
  ↑
commit → commit → PR → Review → Merge
```

### 1.2 分支命名
- 功能: `feature/US-XXX-short-desc`
- 修复: `fix/issue-XXX-short-desc`
- 文档: `docs/what-changed`
- 优化: `perf/what-optimized`

### 1.3 Commit 规范 (Conventional Commits)

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**类型**:
- `feat`: 新功能
- `fix`: 修复
- `docs`: 文档
- `style`: 格式 (不影响代码)
- `refactor`: 重构
- `test`: 测试
- `chore`: 构建/工具

**示例**:
```
feat(search): add debounced search input

- Add 300ms debounce to search input
- Update SearchFilter component
- Add unit tests

Closes #3
```

---

## 2. 代码审查规范

### 2.1 PR 模板

```markdown
## 描述
简要描述这个 PR 做了什么

## 变更类型
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## 检查清单
- [ ] 代码通过 ESLint
- [ ] 测试通过
- [ ] 文档已更新
- [ ] 手动测试验证

## 相关 Issue
Fixes #123
```

### 2.2 审查检查项
- [ ] 代码符合项目规范
- [ ] 有适当的测试覆盖
- [ ] 无 console.log 残留
- [ ] 类型定义正确
- [ ] 性能考虑

---

## 3. 代码风格

### 3.1 TypeScript 规范

**推荐**:
```typescript
// ✅ 明确返回类型
function formatNumber(num: number): string {
  return num.toLocaleString();
}

// ✅ 使用接口定义 Props
interface SkillCardProps {
  skill: Skill;
  onInstall?: (id: string) => void;
}

// ✅ 使用类型别名
type SortOption = 'downloads' | 'stars' | 'updatedAt' | 'name';
```

**避免**:
```typescript
// ❌ 隐式 any
function process(data) {
  return data.map(x => x.name);
}

// ❌ 过度使用 any
const result: any = await fetchData();
```

### 3.2 React 规范

**推荐**:
```typescript
// ✅ 使用函数组件
export function SkillCard({ skill }: SkillCardProps) {
  const [copied, setCopied] = useState(false);
  
  // ✅ 使用 useMemo 缓存计算
  const formattedDate = useMemo(() => {
    return formatDate(skill.updatedAt);
  }, [skill.updatedAt]);
  
  return (
    <Card>{/* ... */}</Card>
  );
}

// ✅ 默认导出页面
export default function Home() {
  // ...
}
```

---

## 4. 测试规范

### 4.1 测试文件位置
```
src/
├── components/
│   ├── skill-card.tsx
│   └── __tests__/
│       └── skill-card.test.tsx
```

### 4.2 测试命名
```typescript
// 组件测试
describe('SkillCard', () => {
  it('should render skill name', () => {});
  it('should call onCopy when copy button clicked', () => {});
  it('should display formatted download count', () => {});
});

// 工具函数测试
describe('formatNumber', () => {
  it('should format thousands with k suffix', () => {});
  it('should format ten-thousands with w suffix', () => {});
});
```

### 4.3 测试原则
- 一个测试只测一件事
- 使用有意义的描述
- 避免测试实现细节，测试行为

---

## 5. 项目命令

```bash
# 开发
npm run dev

# 构建
npm run build

# 生产启动
npm run start

# 测试
npm run test
npm run test:run
npm run test:ui      # Vitest UI
npm run test:coverage # 覆盖率

# 代码检查
npm run lint

# 类型检查
npm run type-check

# ArcGIS installer
npm run login:arcgis
npm run install:skill -- --item <arcgis-item-id> --portal https://www.arcgis.com
```

---

## 6. 目录结构

```
skill-hub/
├── .github/
│   └── workflows/       # CI/CD 配置
├── docs/                # 文档
├── public/              # 静态资源
├── src/
│   ├── app/             # Next.js App Router
│   ├── components/      # 组件
│   │   ├── ui/          # 基础 UI
│   │   ├── __tests__/   # 测试
│   │   └── *.tsx
│   ├── lib/             # 工具函数
│   ├── types/           # 类型定义
│   ├── data/            # 静态数据
│   └── hooks/           # 自定义 Hooks
├── tests/               # E2E 测试
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## 7. 环境变量

```bash
# .env.local
ARCGIS_PORTAL_URL=https://www.arcgis.com
ARCGIS_ORG_ID=<your-org-id>
ARCGIS_MAX_ITEMS=100

# Optional: override the ArcGIS search query completely
ARCGIS_AGENT_SKILL_QUERY=orgid:<your-org-id> AND type:"Code Sample" AND typekeywords:"Agent Skill"

# Web OAuth for the Skill Hub app
ARCGIS_OAUTH_CLIENT_ID=<your-oauth-client-id>
ARCGIS_OAUTH_CLIENT_SECRET=<optional-client-secret>
SKILL_HUB_SESSION_SECRET=<random-long-secret>
ARCGIS_OAUTH_REDIRECT_URI=http://localhost:3000/skill-hub/api/auth/arcgis/callback

# Local installer behavior
ARCGIS_OAUTH_CALLBACK_PORT=8976
ARCGIS_INSTALL_ROOT=~/.skillhub/skills
```

说明:

- Web app 的回调地址必须在 ArcGIS OAuth app 中显式注册。
- 如果未配置 `ARCGIS_OAUTH_REDIRECT_URI`，应用会基于当前 origin 自动生成 `/skill-hub/api/auth/arcgis/callback`。
- `SKILL_HUB_SESSION_SECRET` 用于加密网页登录 session cookie，不应提交到仓库。
- `ARCGIS_INSTALL_ROOT` 只影响本地 installer，不影响网页端 Skill Hub。
- 推荐先复制 `.env.example` 到 `.env.local`，再填入本地实际值。

## 7.1 环境模板

仓库提供 `.env.example` 作为本地启动模板，避免遗漏 ArcGIS 查询、网页登录和 installer 所需变量。

---

## 8. 发布流程

1. 更新版本号 (`package.json`)
2. 更新 `CHANGELOG.md`
3. 创建 PR: `release/vX.Y.Z`
4. 通过所有 CI 检查
5. 合并到 `main`
6. 打 Tag: `git tag vX.Y.Z`
7. 推送到 GitHub: `git push origin vX.Y.Z`
8. 创建 GitHub Release

---

## 9. 问题反馈

发现问题请创建 Issue：
- Bug: `[Bug] 简短描述`
- Feature: `[Feature] 简短描述`
- Question: `[Question] 问题描述`
