化实施规划

## 一、需求概述

| 项目 | 说明 |
|------|------|
| 默认语言 | 中文 |
| 支持语言 | 中文 (zh) / 英文 (en) |
| 路由策略 | 不更换路由，实时渲染切换 |
| 技术方案 | react-i18next |
| 状态保持 | 切换语言时保留用户输入和当前流程状态 |

---

## 二、技术架构设计

### 2.1 语言切换机制

```
用户点击语言切换
       ↓
更新 i18next 语言设置
       ↓
触发 React 重新渲染
       ↓
所有 t() 函数返回新语言文本
       ↓
UI 实时更新（状态保留）
```

### 2.2 核心依赖

```json
{
  "react-i18next": "^14.x",
  "i18next": "^23.x",
  "i18next-browser-languagedetector": "^7.x"
}
```

### 2.3 文件结构

```
SEO-2-version-main/
├── i18n/                     # 与 components/ 同级
│   ├── index.ts              # i18next 初始化配置
│   ├── locales/
│   │   ├── zh/
│   │   │   ├── common.json   # 通用文本（按钮、标签等）
│   │   │   ├── auth.json     # 登录/注册相关
│   │   │   ├── dashboard.json # Dashboard 页面
│   │   │   ├── campaign.json  # Campaign 相关
│   │   │   ├── article.json   # Article 工作流相关
│   │   │   ├── client.json    # 客户管理
│   │   │   ├── admin.json     # 管理员功能（邀请码、用户管理）
│   │   │   ├── status.json    # 状态文本
│   │   │   └── errors.json    # 错误提示
│   │   └── en/
│   │       ├── common.json
│   │       ├── auth.json
│   │       ├── dashboard.json
│   │       ├── campaign.json
│   │       ├── article.json
│   │       ├── client.json
│   │       ├── admin.json
│   │       ├── status.json
│   │       └── errors.json
│   └── types.ts              # TypeScript 类型定义
├── components/
├── services/
├── contexts/
└── ...
```

---

## 三、实施步骤

### Phase 1: 基础设施搭建

#### Step 1.1: 安装依赖
```bash
npm install react-i18next i18next i18next-browser-languagedetector
```

#### Step 1.2: 创建 i18n 配置文件
- 初始化 i18next 实例
- 语言检测策略：优先从 localStorage 读取，否则固定使用中文（不检测浏览器语言）
- 设置默认语言为中文 (zh)
- 配置命名空间（namespace）结构

#### Step 1.3: 在 App 入口集成
- 用 `I18nextProvider` 包裹 App
- 确保在 `AuthProvider` 外层

---

### Phase 2: 翻译文件准备

#### Step 2.1: 提取所有需翻译文本

需要翻译的页面/组件清单：

| 类别 | 组件 | 优先级 |
|------|------|--------|
| 公共页面 | Login, SignUp, ForgotPassword, ResetPassword | P0 |
| 外部页面 | ClientReviewPage（外部客户审核页） | P0 |
| 主布局 | MainLayout (侧边栏) | P0 |
| 核心页面 | Dashboard, CampaignDetail | P0 |
| 工作流 | ProjectWorkspace, StageTitles, StageTitlesKeyword, StageOutline, StageDraft | P0 |
| 功能页面 | KeywordDiscovery, ClientManagement | P1 |
| 管理页面 | InviteCodeManagement, UserManagement | P1 |
| 通用组件 | Modal, Toast, ConfirmDialog, StatusBadge | P0 |
| 其他 | GenerationProgressModal, SelectWritingMethodModal | P1 |

#### Step 2.2: 创建翻译 JSON 文件

**示例结构 (zh/common.json):**
```json
{
  "buttons": {
    "save": "保存",
    "cancel": "取消",
    "confirm": "确认",
    "delete": "删除",
    "edit": "编辑",
    "back": "返回",
    "next": "下一步",
    "submit": "提交",
    "signIn": "登录",
    "signOut": "退出登录",
    "signUp": "注册"
  },
  "labels": {
    "email": "邮箱地址",
    "password": "密码",
    "rememberMe": "记住我",
    "search": "搜索"
  },
  "messages": {
    "loading": "加载中...",
    "success": "操作成功",
    "error": "操作失败"
  }
}
```

**示例结构 (zh/status.json):**
```json
{
  "article": {
    "NEEDS_TITLES": "待生成标题",
    "AWAITING_REVIEW_TITLES": "标题待审核",
    "TITLES_APPROVED": "标题已通过",
    "NEEDS_TITLES_REVISION": "标题需修改",
    "NEEDS_OUTLINE": "待生成大纲",
    "AWAITING_REVIEW_OUTLINE": "大纲待审核",
    "OUTLINE_APPROVED": "大纲已通过",
    "NEEDS_OUTLINE_REVISION": "大纲需修改",
    "NEEDS_DRAFT": "待生成草稿",
    "AWAITING_REVIEW_DRAFT": "草稿待审核",
    "DRAFT_APPROVED": "草稿已通过",
    "NEEDS_DRAFT_REVISION": "草稿需修改",
    "PUBLISHED": "已发布"
  },
  "campaign": {
    "ACTIVE": "进行中",
    "ARCHIVED": "已归档"
  }
}
```

---

### Phase 3: 组件改造

#### Step 3.1: 创建语言切换组件

```tsx
// components/LanguageSwitcher.tsx
const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  
  const toggleLanguage = () => {
    const newLang = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };
  
  return (
    <button onClick={toggleLanguage}>
      {i18n.language === 'zh' ? 'EN' : '中文'}
    </button>
  );
};
```

#### Step 3.2: 添加语言切换按钮

**位置策略：**
- **MainLayout 侧边栏**：放在用户信息区域上方或导航菜单底部
- **公共页面（Login, SignUp, ForgotPassword, ResetPassword）**：页面右上角独立按钮
- **ClientReviewPage（外部客户审核页）**：页面右上角独立按钮

#### Step 3.3: 逐组件替换硬编码文本

改造方式：
```tsx
// Before
<button>Save Changes</button>

// After
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();
<button>{t('common:buttons.save')}</button>
```

---

### Phase 4: 特殊场景处理

#### 4.1 状态文本转换

创建工具函数用于状态显示：

```tsx
// utils/statusTranslation.ts
export const getStatusLabel = (status: ArticleStatus, t: TFunction) => {
  return t(`status:article.${status}`);
};
```

#### 4.2 动态内容处理

对于带变量的文本：

```json
// zh/dashboard.json
{
  "articleCount": "共 {{count}} 篇文章",
  "remainingQuota": "剩余配额: {{remaining}}"
}
```

```tsx
t('dashboard:articleCount', { count: 5 })
// 输出: "共 5 篇文章"
```

#### 4.3 表单验证信息

```json
// zh/errors.json
{
  "validation": {
    "required": "此字段为必填项",
    "email": "请输入有效的邮箱地址",
    "minLength": "最少需要 {{min}} 个字符"
  }
}
```

#### 4.4 后端错误信息映射

对于 Supabase 等后端返回的错误信息，创建映射表：

```tsx
// utils/errorTranslation.ts
const errorMap: Record<string, string> = {
  'email not confirmed': 'errors:auth.emailNotConfirmed',
  'Invalid login credentials': 'errors:auth.invalidCredentials',
  // ...
};

export const translateError = (error: string, t: TFunction) => {
  const key = errorMap[error];
  return key ? t(key) : error;
};
```

---

### Phase 5: 状态保持确认

#### 5.1 已有状态保持机制

当前项目使用 React state 管理以下状态，切换语言时**自动保持**：
- `currentView` - 当前视图
- `selectedCampaignId` - 选中的 Campaign
- `selectedArticleId` - 选中的 Article
- 各种表单输入值

#### 5.2 语言偏好持久化

```tsx
// i18n/index.ts
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng);
});
```

---

## 四、组件改造清单

### 4.1 P0 优先级（核心流程）

| 组件 | 预估文本数量 | 复杂度 |
|------|------------|--------|
| Login.tsx | ~20 | 低 |
| SignUp.tsx | ~25 | 低 |
| ForgotPassword.tsx | ~10 | 低 |
| ResetPassword.tsx | ~10 | 低 |
| ClientReviewPage.tsx | ~30 | 中 |
| MainLayout.tsx | ~15 | 低 |
| Dashboard.tsx | ~50 | 中 |
| CampaignDetail.tsx | ~40 | 中 |
| ProjectWorkspace.tsx | ~30 | 中 |
| StageTitles.tsx | ~35 | 中 |
| StageTitlesKeyword.tsx | ~30 | 中 |
| StageOutline.tsx | ~35 | 中 |
| StageDraft.tsx | ~40 | 中 |
| StatusBadge.tsx | ~15 | 低 |
| Modal.tsx | ~5 | 低 |
| Toast.tsx | ~5 | 低 |
| ConfirmDialog.tsx | ~5 | 低 |

### 4.2 P1 优先级

| 组件 | 预估文本数量 | 复杂度 |
|------|------------|--------|
| KeywordDiscovery.tsx | ~30 | 中 |
| ClientManagement.tsx | ~35 | 中 |
| InviteCodeManagement.tsx | ~25 | 中 |
| UserManagement.tsx | ~25 | 中 |
| SelectWritingMethodModal.tsx | ~15 | 低 |
| GenerationProgressModal.tsx | ~10 | 低 |
| OutlinePreview.tsx | ~10 | 低 |
| RichTextEditor.tsx | ~20 | 中 |
| DraggableAiBar.tsx | ~15 | 低 |

---

## 五、types.ts 中需要翻译的配置

```typescript
// 需要翻译的配置项
WORD_COUNT_CONFIG  // label 字段
PERSPECTIVE_CONFIG // label 和 description 字段
```

这些配置项建议创建翻译函数而非修改原对象：

```tsx
// utils/configTranslation.ts
export const getWordCountLabel = (range: WordCountRange, t: TFunction) => {
  return t(`config:wordCount.${range}`);
};

export const getPerspectiveLabel = (perspective: ArticlePerspective, t: TFunction) => {
  return t(`config:perspective.${perspective}.label`);
};
```

---

## 六、测试清单

- [ ] 语言切换后所有文本正确显示
- [ ] 切换语言后表单内容保留
- [ ] 切换语言后当前视图/流程保持
- [ ] 刷新页面后语言偏好保持
- [ ] 所有状态徽章正确显示翻译后的状态
- [ ] 错误提示正确显示翻译后的内容
- [ ] 动态文本（带变量）正确渲染
- [ ] 移动端侧边栏语言切换正常工作

---

## 七、预估工作量

| 阶段 | 内容 | 预估 |
|------|------|------|
| Phase 1 | 基础设施搭建 | 1-2小时 |
| Phase 2 | 翻译文件准备 | 3-4小时 |
| Phase 3 | 组件改造 (P0) | 4-6小时 |
| Phase 4 | 特殊场景处理 | 2-3小时 |
| Phase 5 | P1 组件改造 | 3-4小时 |
| 测试 | 全面测试 | 2小时 |
| **总计** | | **15-21小时** |

---

## 八、注意事项

1. **翻译质量**：中文翻译需要符合软件本地化规范，避免直译
2. **文本长度**：中英文长度差异可能影响 UI 布局，需要测试
3. **SEO 考虑**：如未来需要 SEO，可能需要升级到路由方案
4. **第三方组件**：如有第三方组件的固定文本，需单独处理
5. **Gemini API 提示词**：`geminiService.ts` 中的 prompt 保持不变
6. **UI 语言 vs AI 内容语言**：两者相互独立
   - UI 语言：由 i18n 控制，用户通过语言切换按钮选择
   - AI 生成内容语言：由用户在文章设置中的 `language` 字段控制，不受 UI 语言影响

---

## 九、后续扩展

如未来需要支持更多语言或 SEO 优化，可以考虑：
- 升级为路由前缀方案 (`/zh/dashboard`, `/en/dashboard`)
- 添加 SSR 支持
- 集成翻译管理平台（如 Crowdin, Lokalise）