# AI 功能配置指南

## 问题说明

AI 功能（Suggest Keywords 和 Generate with Gemini）无法使用是因为缺少 Gemini API Key 配置。

## 解决方案

### 步骤 1: 获取 Gemini API Key

1. 访问 Google AI Studio: https://aistudio.google.com/apikey
2. 登录你的 Google 账号
3. 点击 "Create API Key" 按钮
4. 复制生成的 API Key

### 步骤 2: 创建 .env 文件

在项目根目录（`SEO-2-version-main`）创建一个名为 `.env` 的文件：

```bash
# 在项目根目录创建 .env 文件
VITE_GEMINI_API_KEY=你的API_Key
```

**重要提示**:
- 文件名必须是 `.env`（前面有个点）
- 不要有空格
- 将 `你的API_Key` 替换为你在步骤 1 中获取的实际 API Key

### 步骤 3: 重启开发服务器

1. 停止当前运行的开发服务器（按 `Ctrl + C`）
2. 重新启动：
   ```bash
   npm run dev
   ```

### 步骤 4: 测试 AI 功能

1. 打开文章的标题生成页面
2. 点击 "Suggest Keywords" 按钮 - 应该能生成关键词建议
3. 点击 "Generate with Gemini" 按钮 - 应该能生成标题

---

## Windows 系统创建 .env 文件的方法

### 方法 1: 使用记事本

1. 打开记事本
2. 输入：
   ```
   VITE_GEMINI_API_KEY=你的API_Key
   ```
3. 点击 "文件" → "另存为"
4. 文件名输入：`.env`（包括前面的点）
5. 保存类型选择："所有文件"
6. 保存到项目根目录：`d:\AA Limen_work\SEO Project\SEO-2-version-main\`

### 方法 2: 使用命令行

1. 打开命令提示符（cmd）
2. 进入项目目录：
   ```bash
   cd "d:\AA Limen_work\SEO Project\SEO-2-version-main"
   ```
3. 创建文件：
   ```bash
   echo VITE_GEMINI_API_KEY=你的API_Key > .env
   ```

### 方法 3: 复制模板文件

项目中已经有 `.env.example` 文件：

1. 复制 `.env.example` 文件
2. 重命名为 `.env`
3. 用记事本打开，替换 `your_gemini_api_key_here` 为你的实际 API Key

---

## 验证配置是否成功

打开浏览器的开发者工具（按 F12），查看 Console 标签页：

- **配置成功**: 不会看到 "VITE_GEMINI_API_KEY is not set" 的警告
- **配置失败**: 会看到警告信息，AI 功能无法使用

---

## 常见问题

### Q: 我创建了 .env 文件，但 AI 功能还是不工作？

**A**: 确保你已经重启了开发服务器。Vite 只在启动时读取 .env 文件。

### Q: 我的 API Key 是否正确？

**A**: 
1. API Key 应该是一长串字符，类似：`AIzaSyD...`
2. 确保没有多余的空格或引号
3. 在 Google AI Studio 中确认 API Key 状态为"已启用"

### Q: API Key 会过期吗？

**A**: 
- 免费的 API Key 通常不会过期
- 但有使用配额限制（每分钟请求次数）
- 可以在 Google AI Studio 中查看使用情况

### Q: .env 文件需要提交到 Git 吗？

**A**: 
- **不要提交** `.env` 文件到 Git
- `.env` 包含敏感信息（API Key）
- 项目的 `.gitignore` 应该已经包含了 `.env`
- 只提交 `.env.example` 作为模板

---

## 安全提示

⚠️ **重要**: 
- 不要在代码中直接写入 API Key
- 不要将 `.env` 文件上传到 GitHub 等公共仓库
- 如果不小心泄露了 API Key，立即在 Google AI Studio 中删除并重新生成

---

## Client Portal 配置

Client Portal 也使用 Gemini AI，需要同样的配置：

1. 在 `C:\Users\lenovo\Desktop\其他\taxflow-client-portal\` 目录
2. 创建 `.env` 文件
3. 添加相同的 API Key：
   ```
   VITE_GEMINI_API_KEY=你的API_Key
   ```
4. 重启 Client Portal 的开发服务器

---

## 技术说明

### 为什么使用 `import.meta.env` 而不是 `process.env`？

- Vite 使用 `import.meta.env` 来访问环境变量
- 只有以 `VITE_` 开头的变量才会暴露给客户端代码
- 这是 Vite 的安全机制，防止意外暴露服务器端的环境变量

### 修改的文件

- `services/geminiService.ts`: 修改了 API Key 的读取方式
- `.env.example`: 创建了环境变量模板文件

---

如有其他问题，请查看项目的 README.md 或联系技术支持。

