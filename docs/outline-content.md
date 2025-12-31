数据传递逻辑分析 (Outline → Draft)

整体架构
ProjectWorkspace (父组件)
     │
     ├── 根据 status 决定显示哪个阶段
     │
     ├── StageOutline (Outline 生成界面)
     │      └── onUpdate 保存数据 → Supabase
     │
     └── StageDraft (Content/Draft 生成界面)
            └── 通过 project prop 接收完整 Article 对象


Outline 界面保存的字段汇总：
字段	               说明	                   保存时机
outlineContent	 Markdown 格式的大纲内容	    Submit / Save Draft
outlineSections	 解析后的结构化大纲	            Submit / Save Draft
wordCountRange	 字数范围（如 "1000-2000"）	    选择器更改时
perspective	     写作视角（first/second/third）	选择器更改时
status	         状态更新为 AWAITING_REVIEW_OUTLINE	Submit


数据传递总结图
┌─────────────────────────────────────────────────────────────────┐
│                   Outline 生成界面 (StageOutline)                 │
│                                                                  │
│  用户输入/AI生成:                                                  │
│  ├── outlineContent (Markdown 大纲) ──────┐                      │
│  ├── outlineSections (结构化大纲)   ──────┼──► 保存到数据库        │
│  ├── wordCountRange (字数范围)     ──────┤                       │
│  └── perspective (写作视角)        ──────┘                       │
│                                                                  │
│  从上一阶段继承（不在此阶段保存，但可访问）：                           │
│  ├── selectedTitle (批准的标题)                                   │
│  ├── language (语言)                                             │
│  └── clientComments (客户评论)                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       客户审核 / 批准                             │
│                                                                  │
│  状态变更: AWAITING_REVIEW_OUTLINE → OUTLINE_APPROVED             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Content 生成界面 (StageDraft)                   │
│                                                                  │
│  ══════════════ 从 Outline 阶段传递的核心数据 ══════════════       │
│  │                                                              │
│  │  project.outlineContent ───► 左侧面板显示 + 可编辑大纲          │
│  │  project.wordCountRange ───► 传递给AI生成（控制文章长度）       │
│  │  project.perspective   ───► 传递给AI生成（第一/二/三人称）      │
│  │                                                              │
│  ══════════════════════════════════════════════════════════════  │
│                                                                  │
│  ══════════════ 从 Title 阶段继承的数据 ══════════════             │
│  │                                                              │
│  │  project.selectedTitle ───► 传递给AI + 显示在顶部              │
│  │  project.language     ───► 传递给AI生成（语言设置）             │
│  │  project.clientComments ──► 传递给AI + 右侧 Feedback 面板      │
│  │                                                              │
│  ══════════════════════════════════════════════════════════════  │
│                                                                  │
│  ══════════════ Draft 阶段新增/管理的数据 ══════════════           │
│  │                                                              │
│  │  draftContent    ───► 生成的 Markdown 内容                    │
│  │  draftBlocks     ───► 结构化的内容块（编辑器使用）              │
│  │  seoSummary      ───► SEO 摘要（Short Text）                  │
│  │  coverImage      ───► 封面图片                                │
│  │  category        ───► CMS 分类                                │
│  │                                                              │
│  ══════════════════════════════════════════════════════════════  │
│                                                                  │
│  AI 生成 Draft 时的参数:                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ generateBlogDraft({                                        │ │
│  │   title: project.selectedTitle,      // 来自 Title 阶段     │ │
│  │   outline: editableOutline,          // 来自 Outline 阶段   │ │
│  │   comments: project.clientComments,  // 累积的客户反馈       │ │
│  │   wordCountRange: project.wordCountRange,  // 来自 Outline  │ │
│  │   perspective: project.perspective,        // 来自 Outline  │ │
│  │   language: project.language         // 来自 Title 阶段     │ │
│  │ })                                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘


关键发现
1.outlineContent 是最核心的传递数据 - Draft 界面左侧面板显示的大纲内容完全来自 Outline 阶段
2.大纲可在 Draft 阶段编辑 - Draft 界面有 editableOutline 状态，允许用户在生成文章前修改大纲，修改后会自动保存
3.wordCountRange 和 perspective 实时保存 - 用户在 Outline 界面更改这些设置时立即保存到数据库，Draft 界面直接使用
4.Draft 界面同时使用 Title 和 Outline 阶段的数据：
-从 Title 阶段：selectedTitle, language, clientComments
-从 Outline 阶段：outlineContent, wordCountRange, perspective
5.outlineSections 未在 Draft 界面使用 - 结构化大纲主要用于 Client Portal 显示，Agency 端的 Draft 界面只使用 Markdown 格式的 outlineContent
6.tone 字段缺失 - Title 阶段保存的 tone（语气风格）在 Draft 生成时没有被传递给 AI