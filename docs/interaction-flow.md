# 两个项目交互流程文档

## 项目概述

### Agency Portal (SEO-2-version-main)
- **角色**：内容创作机构
- **功能**：创建和管理 campaigns、articles，生成标题、大纲、草稿
- **技术栈**：React + TypeScript + Supabase + Vite

### Client Portal (SEO-client-version)
- **角色**：客户
- **功能**：审查和批准文章内容（标题、大纲、草稿）
- **技术栈**：React + TypeScript + Supabase + Vite

## 状态机定义

### 完整状态列表

#### 标题阶段 (Title Phase)
1. `NEEDS_TITLES` - 机构需要生成标题
2. `AWAITING_REVIEW_TITLES` - 等待客户端审查标题
3. `TITLES_APPROVED` - 标题已批准，机构可以继续
4. `NEEDS_TITLES_REVISION` - 标题需要修改（客户端拒绝）

#### 大纲阶段 (Outline Phase)
5. `NEEDS_OUTLINE` - 机构需要创建大纲
6. `AWAITING_REVIEW_OUTLINE` - 等待客户端审查大纲
7. `OUTLINE_APPROVED` - 大纲已批准
8. `NEEDS_OUTLINE_REVISION` - 大纲需要修改（客户端拒绝）

#### 草稿阶段 (Draft Phase)
9. `NEEDS_DRAFT` - 机构需要创建草稿
10. `AWAITING_REVIEW_DRAFT` - 等待客户端审查草稿
11. `DRAFT_APPROVED` - 草稿已批准（完成）
12. `NEEDS_DRAFT_REVISION` - 草稿需要修改（客户端拒绝）

#### 其他状态
13. `PUBLISHED` - 已发布
14. `NEEDS_REVISION` - (已弃用) 保留用于向后兼容

## 状态流转图

```
┌─────────────────┐
│  NEEDS_TITLES   │ (机构工作)
└────────┬────────┘
         │ [机构生成标题并提交]
         ↓
┌─────────────────────────┐
│ AWAITING_REVIEW_TITLES  │ (客户端审查)
└────────┬────────────────┘
         │ [客户端选择标题]
    ┌────┴────┐
    │         │
    ↓         ↓
┌─────────┐ ┌───────────────────────┐
│TITLES_  │ │NEEDS_TITLES_REVISION  │
│APPROVED │ │                       │
└────┬────┘ └───────────┬───────────┘
     │                  │ [机构修改后重新提交]
     │                  ↓
     │          ┌─────────────────────────┐
     │          │ AWAITING_REVIEW_TITLES  │
     │          └─────────────────────────┘
     │
     │ [机构创建大纲并提交]
     ↓
┌─────────────────┐
│  NEEDS_OUTLINE  │ (机构工作)
└────────┬────────┘
         │ [机构提交大纲]
         ↓
┌──────────────────────────┐
│ AWAITING_REVIEW_OUTLINE  │ (客户端审查)
└────────┬─────────────────┘
         │ [客户端批准/拒绝]
    ┌────┴────┐
    │         │
    ↓         ↓
┌─────────┐ ┌────────────────────────┐
│OUTLINE_ │ │NEEDS_OUTLINE_REVISION  │
│APPROVED │ │                        │
└────┬────┘ └───────────┬────────────┘
     │                  │ [机构修改后重新提交]
     │                  ↓
     │          ┌──────────────────────────┐
     │          │ AWAITING_REVIEW_OUTLINE  │
     │          └──────────────────────────┘
     │
     │ [机构创建草稿并提交]
     ↓
┌─────────────────┐
│   NEEDS_DRAFT   │ (机构工作)
└────────┬────────┘
         │ [机构提交草稿]
         ↓
┌─────────────────────────┐
│ AWAITING_REVIEW_DRAFT   │ (客户端审查)
└────────┬────────────────┘
         │ [客户端批准/拒绝]
    ┌────┴────┐
    │         │
    ↓         ↓
┌─────────┐ ┌──────────────────────┐
│ DRAFT_  │ │NEEDS_DRAFT_REVISION  │
│APPROVED │ │                      │
└────┬────┘ └───────────┬──────────┘
     │                  │ [机构修改后重新提交]
     │                  ↓
     │          ┌─────────────────────────┐
     │          │ AWAITING_REVIEW_DRAFT   │
     │          └─────────────────────────┘
     ↓
┌─────────────────┐
│   PUBLISHED     │
└─────────────────┘
```

## 数据交互方式

### 共享数据库表
两个项目共享同一个 Supabase 数据库的以下表：
- `clients` - 客户信息
- `campaigns` - 营销活动
- `articles` - 文章内容

### 关键字段说明

#### articles 表
- `status` (TEXT) - 当前状态，必须匹配预定义的状态值
- `proposed_titles` (TEXT[]) - 机构生成的标题列表
- `title` (TEXT) - 客户端选择的最终标题
- `outline_content` (TEXT) - 文章大纲
- `draft_content` (TEXT) - 文章草稿
- `client_comments` (JSONB) - 客户端评论历史

#### client_comments JSONB 结构
```json
[
  {
    "id": "uuid",
    "author": "Client",
    "text": "评论内容",
    "timestamp": "2024-01-01T00:00:00Z"
  }
]
```

## 交互流程详解

### 1. 标题生成流程
**Agency Portal:**
1. 机构在 `StageTitles` 组件中生成多个标题
2. 保存 `proposed_titles` 数组
3. 设置状态为 `AWAITING_REVIEW_TITLES`
4. 通知客户端（通过邮件/链接）

**Client Portal:**
1. 客户端访问审查页面（通过 articleId）
2. 查看 `proposed_titles` 列表
3. 选择一个标题
4. 点击"批准"，更新：
   - `status` = `TITLES_APPROVED`
   - `title` = 选中的标题
5. 或点击"请求修改"，更新：
   - `status` = `NEEDS_TITLES_REVISION`
   - 添加评论到 `client_comments`

### 2. 大纲审查流程
**Agency Portal:**
1. 机构在 `StageOutline` 组件中创建大纲
2. 保存 `outline_content`
3. 设置状态为 `AWAITING_REVIEW_OUTLINE`

**Client Portal:**
1. 客户端查看 `outline_content`
2. 可以添加评论（可选）
3. 选择操作：
   - **批准**：`status` = `OUTLINE_APPROVED`
   - **拒绝**：`status` = `NEEDS_OUTLINE_REVISION`，添加评论到 `client_comments`

### 3. 草稿审查流程
**Agency Portal:**
1. 机构在 `StageDraft` 组件中创建草稿
2. 保存 `draft_content`
3. 设置状态为 `AWAITING_REVIEW_DRAFT`

**Client Portal:**
1. 客户端查看 `draft_content`
2. 可以添加评论（可选）
3. 选择操作：
   - **批准**：`status` = `DRAFT_APPROVED`（完成）
   - **拒绝**：`status` = `NEEDS_DRAFT_REVISION`，添加评论到 `client_comments`

### 4. 修改流程
**Agency Portal:**
1. 检测到对应的 `NEEDS_*_REVISION` 状态
2. 显示对应阶段的编辑界面：
   - `NEEDS_TITLES_REVISION` → 显示标题编辑界面
   - `NEEDS_OUTLINE_REVISION` → 显示大纲编辑界面
   - `NEEDS_DRAFT_REVISION` → 显示草稿编辑界面
3. 读取 `client_comments` 获取反馈
4. 修改内容后重新提交
5. 设置状态回到对应的 `AWAITING_REVIEW_*` 状态

## 数据同步机制

### 当前实现
- **轮询**：客户端页面定期刷新检查状态
- **手动刷新**：用户操作后自动重新加载数据

### 未来优化（可选）
- **Supabase Realtime**：实时监听数据库变化
- **WebSocket**：自定义实时通信
- **推送通知**：状态变更时通知用户

## 安全考虑

### 当前实现
- RLS (Row Level Security) 已禁用（开发阶段）
- 使用 anon key 进行所有操作

### 生产环境建议
1. 启用 RLS
2. 为客户端创建只读策略
3. 为机构端创建读写策略
4. 使用服务端角色（service_role）进行敏感操作

## API 端点映射

### Agency Portal 操作
- `GET /articles?campaign_id=xxx` - 获取文章列表
- `POST /articles` - 创建文章
- `PATCH /articles/:id` - 更新文章（包括状态）
- `GET /campaigns/:id` - 获取活动详情

### Client Portal 操作
- `GET /articles/:id` - 获取单个文章（通过 articleId）
- `PATCH /articles/:id` - 更新状态和评论

## 错误处理

### 常见错误场景
1. **文章不存在**：显示友好错误信息
2. **状态不匹配**：防止无效的状态转换
3. **网络错误**：显示重试选项
4. **权限错误**：提示用户联系管理员

## 测试场景

### 完整流程测试
1. 机构创建文章 → `NEEDS_TITLES`
2. 机构生成标题 → `AWAITING_REVIEW_TITLES`
3. 客户端选择标题 → `TITLES_APPROVED`
4. 机构创建大纲 → `AWAITING_REVIEW_OUTLINE`
5. 客户端批准大纲 → `OUTLINE_APPROVED`
6. 机构创建草稿 → `AWAITING_REVIEW_DRAFT`
7. 客户端批准草稿 → `DRAFT_APPROVED`

### 拒绝流程测试（标题）
1. 客户端拒绝标题 → `NEEDS_TITLES_REVISION`
2. 机构查看评论并修改
3. 机构重新提交 → `AWAITING_REVIEW_TITLES`
4. 客户端再次审查

### 拒绝流程测试（大纲）
1. 客户端拒绝大纲 → `NEEDS_OUTLINE_REVISION`
2. 机构查看评论并修改
3. 机构重新提交 → `AWAITING_REVIEW_OUTLINE`
4. 客户端再次审查

### 拒绝流程测试（草稿）
1. 客户端拒绝草稿 → `NEEDS_DRAFT_REVISION`
2. 机构查看评论并修改
3. 机构重新提交 → `AWAITING_REVIEW_DRAFT`
4. 客户端再次审查
