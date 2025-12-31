整体架构
ProjectWorkspace (父组件)
     ├── 管理 Article 状态
     ├── 根据 status 决定显示哪个阶段
     ├── 通过 onUpdate 回调更新数据库
     │
     ├── StageTitles (Title 生成界面)
     │      └── onUpdate 保存数据 → Supabase
     │
     └── StageOutline (Outline 生成界面)
            └── 通过 project prop 接收数据


从 Title 界面保存的数据
字段	        说明
proposedTitles	提议的标题列表（用户填写或AI生成的）
language	    目标语言（如 "English"/"Chinese"）
tone	        语气风格（如 "Professional & Authoritative"）
status	        状态更新为 AWAITING_REVIEW_TITLES

关键点： 每个被批准的标题会创建独立的文章记录，每篇文章包含：
selected_title - 被选中的标题
title - 工作标题
campaign_id - 保持关联原 Campaign

Outline 界面接收的数据
直接使用的字段：
字段	用途	代码位置
project.selectedTitle	显示在绿色 Banner 中的批准标题	Line 285
project.title	工作标题 / 备用标题	Line 614
project.language	传递给 AI 生成大纲	Line 200
project.clientComments	客户反馈（影响 AI 生成内容）	Line 188-199
project.campaignId	用于获取 Campaign 上下文信息	Line 185
project.wordCountRange	字数范围设置	Line 30
project.perspective	写作视角（第一/二/三人称）	Line 31

数据传递总结图

─────────────────────────────────────────────────────────────────┐
│                    Title 生成界面 (StageTitles)                   │
│                                                                  │
│  用户输入/AI生成:                                                  │
│  ├── Topic/Subject (genTopic)                                   │
│  ├── Target Audience (audience)                                 │
│  ├── Target Keywords (selectedKeywords)                         │
│  ├── Language (language)           ──────┐                      │
│  ├── Tone (tone)                   ──────┼──► 保存到 Article     │
│  └── Proposed Titles (titles)      ──────┘                      │
│                                                                  │
│  点击 "Submit to Client" →                                       │
│  保存: proposedTitles, language, tone, status                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   客户审核 / 批准 (ProjectWorkspace)               │
│                                                                  │
│  Forking: 每个批准的标题 → 创建独立 Article                         │
│  ├── selected_title = 批准的标题                                  │
│  ├── title = 批准的标题                                           │
│  ├── campaign_id = 原 Campaign                                   │
│  └── status = TITLES_APPROVED                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Outline 生成界面 (StageOutline)                 │
│                                                                  │
│  从 Article 接收:                                                 │
│  ├── selectedTitle     → 显示批准的标题 (绿色Banner)               │
│  ├── language          → AI生成时的语言设置                        │
│  ├── clientComments    → 客户反馈 (侧边栏显示 + AI考虑)             │
│  ├── wordCountRange    → 字数范围 (影响H2数量)                     │
│  └── perspective       → 写作视角                                 │
│                                                                  │
│  从 Campaign 额外获取:                                            │
│  ├── strategyGoals     → 营销策略目标                              │
│  ├── keywords          → SEO关键词                                │
│  └── targetAudience    → 目标受众                                 │
└─────────────────────────────────────────────────────────────────┘

关键发现
1.tone 字段未被 Outline 界面直接使用 - 虽然 Title 界面保存了 tone，但 Outline 界面并没有将其传递给 AI 生成函数。
2.Campaign 信息是额外获取的 - Outline 界面通过 getCampaignWithClients(project.campaignId) 单独请求 Campaign 数据，获取 keywords、targetAudience、strategyGoals 等信息。
3.Title 界面的部分配置未直接传递：
-targetCountries - 未保存到数据库
-rules (Strict Content Rules) - 未保存到数据库
-selectedKeywords (关键词) - 未直接保存到 Article