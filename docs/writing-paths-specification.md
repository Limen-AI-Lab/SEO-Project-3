# 文章类型写作路径说明文档

> 本文档描述了不同文章类型的写作路径、数据传递逻辑和共享组件关系。

## 一、产品架构概览

### 1.1 文章类型分类

系统支持两大类文章类型：

#### Featured Methods（主要功能模式）
| ID | 名称 | 状态 | 说明 |
|---|---|---|---|
| `keyword-driven` | Keyword-Driven Writing | 🚧 待开发 | 输入目标关键词，生成以该关键词为中心的 SEO 优化文章 |
| `topic-expansion` | Topic Expansion Writing | ✅ 已完成 | 输入任意主题/想法，探索创意可能性，自动生成内容 |
| `article-integration` | Article Integration | 📋 规划中 | 输入多篇文章 URL，分析并整合创建新文章 |

#### Specific Article Types（特定文章类型）
| ID | 名称 | 状态 | 说明 |
|---|---|---|---|
| `overview` | Overview Article | 📋 规划中 | 列表类文章，如 "10 Best..." |
| `how-to` | How-to Guide | 📋 规划中 | 步骤式操作指南 |
| `comparison` | Comparison Article | 📋 规划中 | 产品/服务对比分析 |
| `explanatory` | Explanatory Article | 📋 规划中 | 概念/现象详细解释 |
| `analytical` | Analytical Article | 📋 规划中 | 数据/趋势深度分析 |

### 1.2 核心设计原则

**路径分离与复用原则**：
- **分离点**：Title 生成界面（每种文章类型有独立的 UI 和交互逻辑）
- **复用点**：Outline 生成界面 + Content 生成界面（所有类型共享）
- **数据接口统一**：所有 Title 界面向 Outline 传递相同的数据结构

---

## 二、写作路径流程图

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              SelectWritingMethodModal                               │
│                                  选择文章类型                                         │
└───────────────────────────────────────┬─────────────────────────────────────────────┘
                                        │
            ┌───────────────────────────┼───────────────────────────┐
            │                           │                           │
            ▼                           ▼                           ▼
┌───────────────────────┐   ┌───────────────────────┐   ┌───────────────────────┐
│   keyword-driven      │   │   topic-expansion     │   │  article-integration  │
│  Keyword-Driven Title │   │  Topic Expansion      │   │  Article Integration  │
│      Generator        │   │   Title Generator     │   │    Title Generator    │
│                       │   │                       │   │                       │
│  ┌─────────────────┐  │   │  ┌─────────────────┐  │   │  ┌─────────────────┐  │
│  │ • Target Keyword│  │   │  │ • Topic/Subject │  │   │  │ • Article URLs  │  │
│  │ • Search Intent │  │   │  │ • Target Audience│ │   │  │ • Integration   │  │
│  │ • Competitors   │  │   │  │ • Keywords      │  │   │  │   Strategy      │  │
│  │ • SERP Analysis │  │   │  │ • Language      │  │   │  │ • Key Points    │  │
│  │ • Language      │  │   │  │ • Tone          │  │   │  │ • Language      │  │
│  │ • Tone          │  │   │  │ • Rules         │  │   │  │ • Tone          │  │
│  └─────────────────┘  │   │  └─────────────────┘  │   │  └─────────────────┘  │
│                       │   │                       │   │                       │
│  🚧 StageTitles       │   │  ✅ StageTitles       │   │  📋 待定组件           │
│     Keyword.tsx       │   │     .tsx (现有)       │   │                       │
└───────────┬───────────┘   └───────────┬───────────┘   └───────────┬───────────┘
            │                           │                           │
            │                           │                           │
            └───────────────────────────┼───────────────────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         │     统一数据传输接口         │
                         │  ┌───────────────────────┐  │
                         │  │ • proposedTitles      │  │
                         │  │ • selectedTitle       │  │
                         │  │ • language            │  │
                         │  │ • tone                │  │
                         │  │ • status              │  │
                         │  │ • (articleType)       │  │
                         │  └───────────────────────┘  │
                         └──────────────┬──────────────┘
                                        │
                                        ▼
            ┌───────────────────────────────────────────────────────┐
            │                  StageOutline.tsx                     │
            │                   Outline 生成界面                     │
            │                      (共享组件)                        │
            │                                                       │
            │   接收数据:                                            │
            │   • selectedTitle (批准的标题)                         │
            │   • language (语言设置)                                │
            │   • clientComments (客户反馈)                          │
            │                                                       │
            │   本阶段配置:                                          │
            │   • wordCountRange (字数范围)                          │
            │   • perspective (写作视角)                             │
            │                                                       │
            │   输出数据:                                            │
            │   • outlineContent (Markdown 大纲)                     │
            │   • outlineSections (结构化大纲)                        │
            │   • wordCountRange                                    │
            │   • perspective                                       │
            └───────────────────────────┬───────────────────────────┘
                                        │
                                        ▼
            ┌───────────────────────────────────────────────────────┐
            │                   StageDraft.tsx                      │
            │                  Content 生成界面                      │
            │                     (共享组件)                         │
            │                                                       │
            │   接收数据:                                            │
            │   • selectedTitle (标题)                               │
            │   • language (语言)                                    │
            │   • clientComments (客户反馈)                          │
            │   • outlineContent (大纲内容)                          │
            │   • wordCountRange (字数范围)                          │
            │   • perspective (写作视角)                             │
            │                                                       │
            │   输出数据:                                            │
            │   • draftContent (Markdown 正文)                       │
            │   • draftBlocks (结构化内容块)                          │
            │   • seoSummary (SEO 摘要)                              │
            │   • coverImage (封面图片)                              │
            │   • category (CMS 分类)                                │
            └───────────────────────────────────────────────────────┘
```

---

## 三、数据传递详细说明

### 3.1 Title → Outline 数据接口（统一规范）

所有 Title 生成界面必须通过 `onUpdate` 回调传递以下字段：

```typescript
// Title 阶段保存的数据结构
interface TitleStageOutput {
  // 必填字段
  proposedTitles: string[];           // 提议的标题列表
  status: ArticleStatus;              // 状态更新
  
  // 可选但建议填写
  language?: string;                  // 目标语言 (如 "English", "Chinese")
  tone?: string;                      // 语气风格 (如 "Professional", "Casual")
  
  // 未来扩展（可选）
  articleType?: string;               // 文章类型标识
  additionalContext?: {               // 类型特定的额外上下文
    [key: string]: any;
  };
}
```

### 3.2 各阶段数据流转表

| 阶段 | 输入字段 | 本阶段配置 | 输出字段 |
|-----|---------|-----------|---------|
| **Title** | `campaign.*` (上下文) | Topic, Audience, Keywords, Language, Tone | `proposedTitles`, `language`, `tone`, `status` |
| **Outline** | `selectedTitle`, `language`, `clientComments`, `campaignId` | `wordCountRange`, `perspective` | `outlineContent`, `outlineSections`, `wordCountRange`, `perspective`, `status` |
| **Draft** | `selectedTitle`, `language`, `outlineContent`, `wordCountRange`, `perspective`, `clientComments` | `seoSummary`, `coverImage`, `category` | `draftContent`, `draftBlocks`, `seoSummary`, `coverImage`, `category`, `status` |

### 3.3 状态流转

```
NEEDS_TITLES
    │ Submit to Client
    ▼
AWAITING_REVIEW_TITLES ──► [Client Approved] ──► TITLES_APPROVED
    │                                                  │
    │ [Request Revision]                               │ (Forking: 每个批准的标题
    ▼                                                  │  创建独立的 Article)
NEEDS_TITLES_REVISION                                  ▼
                                              ┌────────────────┐
                                              │ New Article(s) │
                                              │ selectedTitle  │
                                              └───────┬────────┘
                                                      │
                                                      ▼
                                              TITLES_APPROVED
                                                      │
                                                      ▼
                                              AWAITING_REVIEW_OUTLINE
                                                      │
                                    ┌─────────────────┴─────────────────┐
                                    │                                   │
                               [Approved]                        [Request Revision]
                                    │                                   │
                                    ▼                                   ▼
                             OUTLINE_APPROVED                  NEEDS_OUTLINE_REVISION
                                    │
                                    ▼
                             AWAITING_REVIEW_DRAFT
                                    │
                      ┌─────────────┴─────────────┐
                      │                           │
                 [Approved]                [Request Revision]
                      │                           │
                      ▼                           ▼
               DRAFT_APPROVED             NEEDS_DRAFT_REVISION
                      │
                      ▼
                 PUBLISHED
```

---

## 四、路径实现指南

### 4.1 Topic Expansion Writing（已实现 - 参考实现）

**组件**：`StageTitles.tsx`

**Title 界面特有配置项**：
- Topic/Subject（主题）
- Target Audience（目标受众）
- Target Countries（目标国家）
- Target Keywords（关键词标签 + AI 建议）
- Language（语言）
- Tone（语气）
- Strict Content Rules（内容规则）

**保存数据**：
```typescript
onUpdate({ 
  proposedTitles: validTitles,
  language: language,
  tone: tone,
  status: ARTICLE_STATUS.AWAITING_REVIEW_TITLES
});
```

### 4.2 Keyword-Driven Writing（待开发）

**建议组件**：`StageTitlesKeyword.tsx`

**Title 界面特有配置项**（建议）：
- **Primary Keyword**（主要关键词）⭐ 核心输入
- **Secondary Keywords**（次要关键词）
- **Search Intent**（搜索意图：Informational / Commercial / Transactional / Navigational）
- **SERP Analysis**（搜索结果分析 - 可选高级功能）
- **Competitor Titles**（竞品标题参考 - 可选）
- Language（语言）
- Tone（语气）

**与 Topic Expansion 的差异**：
| 维度 | Topic Expansion | Keyword-Driven |
|-----|-----------------|----------------|
| 核心输入 | 主题/想法 | 目标关键词 |
| 关注点 | 创意发散 | SEO 排名优化 |
| 关键词角色 | 辅助参考 | 核心驱动 |
| 标题生成逻辑 | 围绕主题探索 | 围绕关键词优化 |

**保存数据**（保持统一接口）：
```typescript
onUpdate({ 
  proposedTitles: validTitles,
  language: language,
  tone: tone,
  status: ARTICLE_STATUS.AWAITING_REVIEW_TITLES,
  // 可扩展：存储关键词相关上下文
  // additionalContext: { primaryKeyword, searchIntent, ... }
});
```

### 4.3 Article Integration（规划中）

**建议组件**：`StageTitlesIntegration.tsx`

**Title 界面特有配置项**（建议）：
- **Source Article URLs**（源文章 URL 列表）
- **Integration Strategy**（整合策略：合并/对比/扩展）
- **Key Points to Extract**（提取要点）
- Language（语言）
- Tone（语气）

---

## 五、开发规范

### 5.1 新增文章类型的步骤

1. **在 `SelectWritingMethodModal.tsx` 中注册**
   - 添加到 `featuredMethods` 或 `specificTypes` 数组
   - 配置 `id`, `title`, `description`, `icon` 等

2. **创建对应的 Title 组件**
   - 命名规范：`StageTitles{TypeName}.tsx`
   - 实现独特的配置 UI
   - 确保输出符合统一数据接口

3. **在 `ProjectWorkspace.tsx` 中添加路由逻辑**
   - 根据 `article.articleType` 决定渲染哪个 Title 组件
   - 后续阶段继续复用 `StageOutline.tsx` 和 `StageDraft.tsx`

### 5.2 Props 接口规范

所有 Title 组件应实现以下 Props 接口：

```typescript
interface StageTitlesProps {
  project: Article;           // 当前文章对象
  campaign?: Campaign;        // 关联的 Campaign（提供上下文）
  onUpdate: (updates: Partial<Article>) => void;  // 更新回调
}
```

### 5.3 AI 服务调用规范

Title 生成服务位于 `services/geminiService.ts`：

```typescript
// 现有服务
generateBlogTitles(params: TitleGenerationParams): Promise<string[]>
suggestBlogKeywords(topic, audience, clientName): Promise<KeywordSuggestion[]>

// 建议新增（针对 Keyword-Driven）
generateKeywordDrivenTitles(params: KeywordTitleParams): Promise<string[]>
analyzeSearchIntent(keyword: string): Promise<SearchIntentAnalysis>
```

---

## 六、数据库字段说明

### 6.1 Article 表核心字段

| 字段 | 类型 | 说明 | 设置阶段 |
|-----|-----|------|---------|
| `id` | UUID | 文章唯一标识 | 创建时 |
| `campaign_id` | UUID | 关联的 Campaign | 创建时 |
| `title` | string | 工作标题 | Title |
| `status` | string | 当前状态 | 各阶段 |
| `proposed_titles` | string[] | 提议的标题列表 | Title |
| `selected_title` | string | 批准的标题 | Title→Outline |
| `language` | string | 目标语言 | Title |
| `tone` | string | 语气风格 | Title |
| `outline_content` | text | Markdown 大纲 | Outline |
| `outline_sections` | jsonb | 结构化大纲 | Outline |
| `word_count_range` | string | 字数范围 | Outline |
| `perspective` | string | 写作视角 | Outline |
| `draft_content` | text | Markdown 正文 | Draft |
| `draft_blocks` | jsonb | 结构化内容块 | Draft |
| `seo_summary` | string | SEO 摘要 | Draft |
| `cover_image` | string | 封面图片 URL | Draft |
| `category` | string | CMS 分类 | Draft |
| `client_comments` | jsonb | 客户评论 | 各审核阶段 |

### 6.2 扩展字段建议

针对不同文章类型，可考虑添加：

```typescript
// 建议扩展字段
article_type?: string;              // 文章类型标识
article_type_config?: {             // 类型特定配置
  // Keyword-Driven
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  searchIntent?: string;
  
  // Article Integration
  sourceUrls?: string[];
  integrationStrategy?: string;
};
```

---

## 七、附录

### 7.1 组件依赖关系图

```
SelectWritingMethodModal.tsx
         │
         │ onBlogWizard(method)
         ▼
ProjectWorkspace.tsx ──────────────────────────────────────────────┐
         │                                                         │
         │ 根据 status 和 articleType 路由                          │
         │                                                         │
         ├──► StageTitles.tsx (topic-expansion)                   │
         │         │                                               │
         ├──► StageTitlesKeyword.tsx (keyword-driven) [待开发]     │
         │         │                                               │
         ├──► StageTitlesIntegration.tsx [规划中]                  │
         │         │                                               │
         │         └──────────┬────────────────────────────────────┤
         │                    │                                    │
         │                    ▼                                    │
         ├──────────────► StageOutline.tsx (共享)                  │
         │                    │                                    │
         │                    ▼                                    │
         └──────────────► StageDraft.tsx (共享)                    │
                                                                   │
         ◄─────────────────────────────────────────────────────────┘
```

### 7.2 相关文件清单

| 文件 | 用途 |
|-----|------|
| `components/SelectWritingMethodModal.tsx` | 文章类型选择弹窗 |
| `components/ProjectWorkspace.tsx` | 工作区主组件，阶段路由 |
| `components/StageTitles.tsx` | Topic Expansion Title 界面 |
| `components/StageOutline.tsx` | 共享 Outline 界面 |
| `components/StageDraft.tsx` | 共享 Draft 界面 |
| `services/geminiService.ts` | AI 生成服务 |
| `types.ts` | 类型定义 |
| `constants/status.ts` | 状态常量 |

---

**文档版本**: v1.0  
**最后更新**: 2024-12-31  
**维护者**: Agency Portal Team

