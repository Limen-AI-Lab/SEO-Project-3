# 两个项目集成指南

## 概述

本文档说明 Agency Portal 和 Client Portal 如何通过 Supabase 数据库进行交互。

## 项目结构

### Agency Portal (SEO-2-version-main)
- **位置**：当前项目
- **角色**：内容创作机构
- **主要功能**：创建 campaigns、生成文章内容、管理客户

### Client Portal (SEO-client-version)
- **GitHub URL**：https://github.com/lufeizhan-ops/SEO-client-version.git
- **角色**：客户
- **主要功能**：审查和批准文章内容

## 共享资源

### 1. Supabase 数据库
两个项目共享同一个 Supabase 数据库实例：
- **表**：`clients`, `campaigns`, `articles`
- **连接**：使用相同的 Supabase URL 和 Anon Key

### 2. 状态常量
两个项目必须使用相同的状态常量值。

**Agency Portal** 中的状态常量文件：
- `constants/status.ts` - 定义 `ARTICLE_STATUS` 常量

**Client Portal** 需要：
- 复制 `constants/status.ts` 文件到 Client Portal 项目
- 或创建相同的状态常量定义

## 数据库 Schema

### 当前 Schema
参考 `supabase_setup.sql` 文件

### 更新 Schema
运行 `supabase_schema_update.sql` 来：
1. 添加 `last_updated` 字段
2. 添加 `selected_title` 字段
3. 添加状态约束
4. 添加索引优化
5. 创建自动更新时间戳触发器

## 状态流转

### 完整流程

```
1. Agency 创建文章
   → status: NEEDS_TITLES

2. Agency 生成标题并提交
   → status: AWAITING_REVIEW_TITLES
   → proposed_titles: ["Title 1", "Title 2", ...]

3. Client 选择标题
   → status: TITLES_APPROVED
   → title: "Selected Title"
   → selected_title: "Selected Title"

4. Agency 创建大纲并提交
   → status: AWAITING_REVIEW_OUTLINE
   → outline_content: "..."

5. Client 审查大纲
   → 批准: status: OUTLINE_APPROVED
   → 拒绝: status: NEEDS_REVISION + 添加评论

6. Agency 创建草稿并提交
   → status: AWAITING_REVIEW_DRAFT
   → draft_content: "..."

7. Client 审查草稿
   → 批准: status: DRAFT_APPROVED (完成)
   → 拒绝: status: NEEDS_REVISION + 添加评论
```

## 数据字段映射

### articles 表字段

| 数据库字段 | TypeScript 字段 | 说明 |
|-----------|----------------|------|
| `id` | `id` | UUID |
| `campaign_id` | `campaignId` | 外键 |
| `title` | `title` | 最终标题（客户端选择后） |
| `selected_title` | `selectedTitle` | 客户端选择的标题 |
| `status` | `status` | 状态（必须匹配预定义值） |
| `proposed_titles` | `proposedTitles` | 标题数组 |
| `outline_content` | `outlineContent` | 大纲内容 |
| `draft_content` | `draftContent` | 草稿内容 |
| `client_comments` | `clientComments` | JSONB 评论数组 |
| `created_at` | - | 创建时间 |
| `last_updated` | `lastUpdated` | 最后更新时间 |

### client_comments JSONB 结构

```typescript
[
  {
    id: string;        // UUID
    author: string;    // "Client"
    text: string;      // 评论内容
    timestamp: string; // ISO 日期字符串
  }
]
```

## 客户端门户集成步骤

### 1. 复制状态常量文件

在 Client Portal 项目中创建 `constants/status.ts`：

```typescript
export const ARTICLE_STATUS = {
  NEEDS_TITLES: 'NEEDS_TITLES',
  AWAITING_REVIEW_TITLES: 'AWAITING_REVIEW_TITLES',
  TITLES_APPROVED: 'TITLES_APPROVED',
  AWAITING_REVIEW_OUTLINE: 'AWAITING_REVIEW_OUTLINE',
  OUTLINE_APPROVED: 'OUTLINE_APPROVED',
  AWAITING_REVIEW_DRAFT: 'AWAITING_REVIEW_DRAFT',
  DRAFT_APPROVED: 'DRAFT_APPROVED',
  NEEDS_REVISION: 'NEEDS_REVISION',
} as const;
```

### 2. 配置 Supabase 客户端

确保 Client Portal 使用相同的 Supabase 配置：
- 相同的 Project URL
- 相同的 Anon Key

### 3. 实现审查页面

参考 `components/ClientReviewPage.tsx` 的实现：
- 从 URL 获取 `articleId`
- 根据状态显示不同的审查界面
- 实现批准/拒绝操作

### 4. 路由配置

在 Client Portal 中添加路由：
```typescript
// 示例：使用 React Router
<Route path="/review" element={<ClientReviewPage />} />
```

访问方式：
```
/client-review?articleId=<article-id>
```

## 数据同步

### 当前实现
- **轮询**：客户端页面定期刷新
- **手动刷新**：操作后自动重新加载

### 推荐实现（可选）
- **Supabase Realtime**：实时监听数据库变化
- **WebSocket**：自定义实时通信

## 错误处理

### 常见错误场景
1. **文章不存在**：显示友好错误信息
2. **状态不匹配**：防止无效的状态转换
3. **网络错误**：显示重试选项
4. **权限错误**：提示用户联系管理员

## 测试清单

### 完整流程测试
- [ ] Agency 创建文章
- [ ] Agency 生成标题并提交
- [ ] Client 选择标题
- [ ] Agency 创建大纲并提交
- [ ] Client 批准大纲
- [ ] Agency 创建草稿并提交
- [ ] Client 批准草稿

### 拒绝流程测试
- [ ] Client 拒绝大纲
- [ ] Agency 查看评论并修改
- [ ] Agency 重新提交
- [ ] Client 再次审查

## 安全建议

### 开发环境
- RLS 已禁用（当前配置）
- 使用 anon key

### 生产环境
1. 启用 RLS
2. 为客户端创建只读策略
3. 为机构端创建读写策略
4. 使用服务端角色进行敏感操作

## 故障排查

### 问题：状态不匹配
**解决方案**：确保两个项目使用相同的状态常量值

### 问题：数据不同步
**解决方案**：
1. 检查 Supabase 连接配置
2. 验证数据库权限
3. 检查网络连接

### 问题：评论丢失
**解决方案**：
1. 验证 `client_comments` JSONB 结构
2. 检查数据序列化/反序列化逻辑

