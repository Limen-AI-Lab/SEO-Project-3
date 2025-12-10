# Client Portal 集成设置指南

## 概述

本文档说明如何在 Client Portal 项目（SEO-client-version）中集成与 Agency Portal 的交互功能。

## 步骤 1：复制状态常量文件

在 Client Portal 项目中创建 `constants/status.ts` 文件：

```typescript
/**
 * Article Status Constants
 * These constants define the state machine for article workflow.
 * Both Agency Portal and Client Portal must use these exact values.
 */

export const ARTICLE_STATUS = {
  // Agency working states
  NEEDS_TITLES: 'NEEDS_TITLES',
  TITLES_APPROVED: 'TITLES_APPROVED',
  OUTLINE_APPROVED: 'OUTLINE_APPROVED',
  DRAFT_APPROVED: 'DRAFT_APPROVED',
  
  // Client review states
  AWAITING_REVIEW_TITLES: 'AWAITING_REVIEW_TITLES',
  AWAITING_REVIEW_OUTLINE: 'AWAITING_REVIEW_OUTLINE',
  AWAITING_REVIEW_DRAFT: 'AWAITING_REVIEW_DRAFT',
  
  // Revision state
  NEEDS_REVISION: 'NEEDS_REVISION',
} as const;

export type ArticleStatus = typeof ARTICLE_STATUS[keyof typeof ARTICLE_STATUS];
```

## 步骤 2：配置 Supabase 客户端

确保 Client Portal 使用与 Agency Portal 相同的 Supabase 配置：

1. 复制 `services/supabaseClient.js` 文件
2. 使用相同的 Supabase URL 和 Anon Key
3. 确保连接到同一个 Supabase 项目

## 步骤 3：复制 ClientReviewPage 组件

从 Agency Portal 项目复制 `components/ClientReviewPage.tsx` 到 Client Portal 项目。

或者，如果 Client Portal 已有不同的结构，确保实现以下功能：
- 从 URL 查询参数获取 `articleId`
- 根据状态显示不同的审查界面
- 实现批准/拒绝操作
- 实现评论功能

## 步骤 4：更新数据库 Schema

在 Supabase SQL Editor 中运行 `supabase_schema_update.sql`：

1. 添加 `last_updated` 字段
2. 添加 `selected_title` 字段
3. 添加状态约束
4. 添加索引
5. 创建触发器

## 步骤 5：路由配置

在 Client Portal 中添加路由以访问审查页面：

### 使用 React Router（如果使用）
```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ClientReviewPage from './components/ClientReviewPage';

<Routes>
  <Route path="/review" element={<ClientReviewPage />} />
</Routes>
```

### 直接访问
```
http://your-client-portal-domain/review?articleId=<article-id>
```

## 步骤 6：测试集成

### 测试场景 1：标题审查
1. 在 Agency Portal 中创建文章并生成标题
2. 设置状态为 `AWAITING_REVIEW_TITLES`
3. 在 Client Portal 中访问审查页面
4. 选择标题并批准
5. 验证状态变为 `TITLES_APPROVED`

### 测试场景 2：大纲审查
1. 在 Agency Portal 中创建大纲
2. 设置状态为 `AWAITING_REVIEW_OUTLINE`
3. 在 Client Portal 中审查大纲
4. 批准或拒绝
5. 验证状态和评论正确保存

### 测试场景 3：草稿审查
1. 在 Agency Portal 中创建草稿
2. 设置状态为 `AWAITING_REVIEW_DRAFT`
3. 在 Client Portal 中审查草稿
4. 批准或拒绝
5. 验证最终状态

## 数据验证

### 验证状态值
确保所有状态值完全匹配：
- `NEEDS_TITLES`
- `AWAITING_REVIEW_TITLES`
- `TITLES_APPROVED`
- `AWAITING_REVIEW_OUTLINE`
- `OUTLINE_APPROVED`
- `AWAITING_REVIEW_DRAFT`
- `DRAFT_APPROVED`
- `NEEDS_REVISION`

### 验证 JSONB 结构
确保 `client_comments` 字段的结构正确：
```json
[
  {
    "id": "uuid-string",
    "author": "Client",
    "text": "comment text",
    "timestamp": "2024-01-01T00:00:00Z"
  }
]
```

## 常见问题

### Q: 如何获取文章的审查链接？
**A**: 在 Agency Portal 中，当文章状态变为 `AWAITING_REVIEW_*` 时，生成链接：
```
https://your-client-portal-domain/review?articleId=<article-id>
```

### Q: 客户端如何知道有新文章需要审查？
**A**: 当前实现需要手动通知。未来可以：
- 集成邮件通知
- 使用 Supabase Realtime 监听
- 创建通知系统

### Q: 如何处理多个客户端？
**A**: 当前实现中，每个 campaign 关联一个 client。如果需要多个客户端审查同一篇文章，需要扩展数据库 schema。

## 下一步优化

1. **实时通知**：使用 Supabase Realtime 或 WebSocket
2. **邮件集成**：状态变更时发送邮件通知
3. **权限管理**：实现基于角色的访问控制（RLS）
4. **审计日志**：记录所有状态变更历史
5. **批量操作**：支持批量审查多个文章

