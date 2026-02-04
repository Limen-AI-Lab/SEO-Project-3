# 直接生成文章功能 - 实施规划

## 1. 功能概述

"直接生成文章"功能允许用户跳过 outline 阶段，从选定的标题直接生成完整文章。系统会先让 AI 内部生成大纲结构，再基于此生成正文，减少误差。

## 2. 用户流程

```
标题生成页面 → 点击"直接生成文章" → 进入配置页面 → 配置各标题参数 → 批量生成 → 返回workspace查看新文章
```

### 详细步骤

1. 用户在标题生成阶段（`StageTitles`），当至少有一个标题时，点击"直接生成文章"按钮
2. 导航到新页面 `/article/{articleId}/direct-generate`
3. 页面显示从原 article 继承的标题列表，用户可以：
   - ✅ 勾选要生成的标题
   - ✏️ 编辑现有标题
   - ➕ 添加新标题
   - 🗑️ 删除标题
4. 每个标题可单独配置生成参数
5. 点击"生成文章"按钮开始批量生成
6. 系统逐个处理选中的标题（显示进度）
7. 生成完成后删除原 article，用户返回 workspace 查看新文章

## 3. 数据模型

### 3.1 新文章的字段值

| 字段 | 值 | 说明 |
|------|-----|------|
| `id` | 新生成的 UUID | 独立的 article 记录 |
| `campaign_id` | 继承原 article | - |
| `title` | 用户选择的标题 | - |
| `selected_title` | 同 title | - |
| `status` | `AWAITING_REVIEW_DRAFT` | 直接进入草稿审核阶段 |
| `language` | 继承原 article | - |
| `tone` | 继承原 article | - |
| `target_keywords` | 继承原 article | 用于 SEO 优化 |
| `wordCountMin` | 用户配置 | 默认 1000 |
| `wordCountMax` | 用户配置 | 默认 2000 |
| `h2Count` | 用户配置 | 默认 5 |
| `h3Count` | 用户配置 | 默认 0 |
| `perspective` | 用户配置 | 默认 `third` |
| `outline_content` | `NULL` | 不存储大纲 |
| `outline_sections` | `NULL` | 不存储大纲 |
| `draft_content` | AI 生成的正文 | Markdown 格式 |
| `draft_blocks` | 结构化正文 | ContentBlock[] |
| `generation_count` | 1 | - |
| `writing_path` | `direct-generate` | 新增类型，标识生成方式 |
| `proposed_titles` | `[]` | 空数组 |

### 3.2 types.ts 修改

```typescript
// 新增 WritingPath 类型值
export type WritingPath = 'keyword-driven' | 'topic-expansion' | 'direct-generate';
```

## 4. 页面设计

### 4.1 页面布局

```
┌─────────────────────────────────────────────────────────────────┐
│  ← 返回                    直接生成文章                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  继承设置（只读展示）                                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 语言: English  |  语气: Professional  |  关键词: AI, SEO... ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  待生成标题                                        [+ 添加标题]  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ☑ 标题1: "10 Ways to Improve SEO"                    [编辑] ││
│  │   字数: [1000]-[2000]  H2: [5]  H3: [0]  人称: [第三人称 ▼] ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ ☑ 标题2: "Complete Guide to AI Writing"              [编辑] ││
│  │   字数: [1000]-[2000]  H2: [5]  H3: [0]  人称: [第三人称 ▼] ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ ☐ 标题3: "Why Content Marketing Matters"             [编辑] ││
│  │   字数: [1000]-[2000]  H2: [5]  H3: [0]  人称: [第三人称 ▼] ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│                                    [生成 2 篇文章]              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 生成进度状态

```
┌─────────────────────────────────────────────────────────────────┐
│  正在生成文章...                                                 │
│                                                                 │
│  ✅ 标题1: "10 Ways to Improve SEO"           完成              │
│  🔄 标题2: "Complete Guide to AI Writing"     生成中...          │
│  ⏳ 标题3: "Why Content Marketing Matters"    等待中             │
│  ❌ 标题4: "Failed Title Example"             失败 [重试]        │
│                                                                 │
│  进度: 2/4                                                      │
│  ████████░░░░░░░░░░░░ 50%                                       │
└─────────────────────────────────────────────────────────────────┘
```

## 5. AI 生成逻辑

### 5.1 两步生成策略

为减少误差，采用分步生成：

**第一步：生成内部大纲结构**
- 调用现有的 `generateBlogOutline` 或类似逻辑
- 根据用户配置的 H2/H3 数量生成大纲
- 大纲仅作为中间产物，不存储到数据库

**第二步：基于大纲生成正文**
- 调用现有的 `generateBlogDraft`
- 使用第一步生成的大纲作为输入
- 生成完整的文章正文

### 5.2 geminiService 新增函数

```typescript
interface DirectGenerateParams {
  title: string;
  language: string;
  tone?: string;
  targetKeywords?: string[];
  wordCountMin: number;
  wordCountMax: number;
  h2Count: number;
  h3Count: number;
  perspective: ArticlePerspective;
}

interface DirectGenerateResult {
  success: boolean;
  draftContent?: string;
  draftBlocks?: ContentBlock[];
  error?: string;
  warnings?: string[];
}

// 新函数：直接生成文章（内部分两步）
export async function generateDirectArticle(
  params: DirectGenerateParams
): Promise<DirectGenerateResult>
```

## 6. 文件修改清单

### 6.1 新建文件

| 文件路径 | 说明 |
|---------|------|
| `components/DirectGeneratePage.tsx` | 直接生成文章配置页面 |

### 6.2 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `App.tsx` | 添加新路由 `/article/:articleId/direct-generate` |
| `types.ts` | `WritingPath` 新增 `'direct-generate'` |
| `services/geminiService.ts` | 新增 `generateDirectArticle` 函数 |
| `components/StageTitles.tsx` | "直接生成文章"按钮添加导航逻辑 |
| `i18n/locales/en/article.json` | 新增英文翻译 |
| `i18n/locales/zh/article.json` | 新增中文翻译 |

## 7. 实施步骤

### Phase 1: 基础架构
1. 修改 `types.ts`，新增 `WritingPath` 类型值
2. 在 `App.tsx` 添加新路由
3. 创建 `DirectGeneratePage.tsx` 基础框架

### Phase 2: 页面 UI
4. 实现标题列表展示（继承自原 article）
5. 实现标题编辑/添加/删除功能
6. 实现单标题配置面板（字数/H2/H3/人称）
7. 实现继承设置的只读展示区

### Phase 3: AI 生成逻辑
8. 在 `geminiService.ts` 实现 `generateDirectArticle` 函数
9. 实现分步生成逻辑（先大纲后正文）

### Phase 4: 批量生成流程
10. 实现批量生成队列逻辑
11. 实现生成进度展示
12. 实现失败重试机制
13. 实现生成完成后删除原 article

### Phase 5: 入口与导航
14. 修改 `StageTitles.tsx`，添加按钮导航逻辑
15. 实现返回 workspace 功能

### Phase 6: 国际化
16. 添加 en/zh 翻译内容

## 8. 关键技术点

### 8.1 路由设计
```typescript
// App.tsx
<Route path="/article/:articleId/direct-generate" element={<DirectGeneratePage />} />
```

### 8.2 数据库操作
```typescript
// 创建新文章
const { data: newArticle } = await supabase
  .from('articles')
  .insert({
    campaign_id: originalArticle.campaign_id,
    title: selectedTitle,
    selected_title: selectedTitle,
    status: 'AWAITING_REVIEW_DRAFT',
    language: originalArticle.language,
    tone: originalArticle.tone,
    target_keywords: originalArticle.target_keywords,
    word_count_min: config.wordCountMin,
    word_count_max: config.wordCountMax,
    h2_count: config.h2Count,
    h3_count: config.h3Count,
    perspective: config.perspective,
    draft_content: generatedDraft,
    draft_blocks: parsedBlocks,
    writing_path: 'direct-generate',
    generation_count: 1,
    proposed_titles: [],
  })
  .select()
  .single();

// 删除原文章
await supabase.from('articles').delete().eq('id', originalArticleId);
```

### 8.3 批量生成队列
```typescript
// 顺序执行，逐个生成
for (const item of selectedTitles) {
  setCurrentGenerating(item.id);
  try {
    const result = await generateDirectArticle(item.params);
    if (result.success) {
      await createNewArticle(item, result);
      setCompletedItems(prev => [...prev, item.id]);
    } else {
      setFailedItems(prev => [...prev, { id: item.id, error: result.error }]);
    }
  } catch (error) {
    setFailedItems(prev => [...prev, { id: item.id, error: error.message }]);
  }
}
```

## 9. 默认值配置

| 参数 | 默认值 | 范围限制 |
|------|--------|---------|
| `wordCountMin` | 1000 | 300-6000 |
| `wordCountMax` | 2000 | 300-6000 |
| `h2Count` | 5 | 0-25 |
| `h3Count` | 0 | 0-30 |
| `perspective` | `third` | first/second/third |

## 10. 错误处理

| 场景 | 处理方式 |
|------|---------|
| 单个标题生成失败 | 记录失败，跳过继续下一个，保留重试入口 |
| 网络错误 | Toast 提示，允许重试 |
| 没有选中任何标题 | 禁用生成按钮 |
| 原 article 不存在 | 导航回 campaign 页面，显示错误提示 |

## 11. i18n 新增键值

### en/article.json
```json
{
  "directGenerate": {
    "title": "Direct Article Generation",
    "backToWorkspace": "Back",
    "inheritedSettings": "Inherited Settings",
    "titlesToGenerate": "Titles to Generate",
    "addTitle": "Add Title",
    "editTitle": "Edit",
    "deleteTitle": "Delete",
    "wordCount": "Word Count",
    "h2Count": "H2 Sections",
    "h3Count": "H3 Sections", 
    "perspective": "Perspective",
    "generateButton": "Generate {count} Article(s)",
    "generating": "Generating...",
    "progress": "Progress: {current}/{total}",
    "completed": "Completed",
    "failed": "Failed",
    "retry": "Retry",
    "waiting": "Waiting",
    "noTitleSelected": "Please select at least one title",
    "generationComplete": "All articles generated successfully",
    "partialSuccess": "{success} succeeded, {failed} failed"
  }
}
```

### zh/article.json
```json
{
  "directGenerate": {
    "title": "直接生成文章",
    "backToWorkspace": "返回",
    "inheritedSettings": "继承设置",
    "titlesToGenerate": "待生成标题",
    "addTitle": "添加标题",
    "editTitle": "编辑",
    "deleteTitle": "删除",
    "wordCount": "字数范围",
    "h2Count": "H2 章节数",
    "h3Count": "H3 章节数",
    "perspective": "人称",
    "generateButton": "生成 {count} 篇文章",
    "generating": "生成中...",
    "progress": "进度: {current}/{total}",
    "completed": "已完成",
    "failed": "失败",
    "retry": "重试",
    "waiting": "等待中",
    "noTitleSelected": "请至少选择一个标题",
    "generationComplete": "所有文章生成成功",
    "partialSuccess": "{success} 篇成功, {failed} 篇失败"
  }
}
```
