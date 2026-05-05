# 故事魔法师 Story Magician

面向 3–6 岁幼儿的绘本创编伙伴智能体，通过 AI 引导式对话帮助孩子完成故事共创，并自动生成配图、短视频与图文小书。

---

## 项目目标

- **激发创造力**：以四阶段叙事模型引导孩子从角色选择到情绪反思，逐步构建完整故事
- **年龄适配**：针对 3–4 岁、4–5 岁、5–6 岁三个阶段定制语言风格与问题深度
- **多模态输出**：对话结束后一键生成配图绘本与动态视频，将文字故事转化为视觉作品
- **成长记录**：通过能力报告从发散思维、词汇量、逻辑性、共情力、故事结构感五个维度量化孩子的叙事能力

---

## 架构设计

```
story-magician/
├── app.js              # Express 服务入口，统一错误处理
├── routes/
│   └── index.js        # 所有页面路由与 REST API 端点
├── services/
│   ├── aiService.js    # 接入字节跳动 Ark 大模型（豆包）
│   ├── prompts.js      # 系统提示词、年龄策略、四阶段模型
│   ├── safety.js       # 内容安全过滤（暴力/死亡词汇替换）
│   ├── sessionStore.js # 内存会话管理（最多 500 条，2 小时 TTL）
│   ├── historyService.js # JSON 文件持久化历史记录
│   ├── imageService.js # 火山引擎文生图（同步，1120×1120px）
│   ├── videoService.js # 火山引擎文生视频（异步，16:9，约 15s）
│   └── volcSign.js     # 火山引擎 HMAC-SHA256 请求签名
├── views/
│   └── index.ejs       # 单页 HTML 模板（EJS）
└── public/
    ├── css/style.css   # 响应式布局
    └── js/app.js       # 前端交互逻辑（原生 JS）
```

**技术栈**

| 层次 | 技术 |
|------|------|
| 后端框架 | Node.js + Express |
| 前端 | 原生 JavaScript + EJS 模板 |
| 大语言模型 | 字节跳动 Ark（豆包 doubao-seed） |
| 图像生成 | 火山引擎 CVProcess API |
| 视频生成 | 火山引擎 CVSync2Async API |
| 会话存储 | 内存（运行时）+ JSON 文件（持久化） |

**请求流程**

```
浏览器 → POST /api/chat
          │
          ├─ sessionStore 读取上下文
          ├─ safety.js 安全过滤输入
          ├─ prompts.js 构造带年龄策略和阶段上下文的消息
          ├─ aiService.js 调用 Ark LLM
          │    └─ 返回 {reply, action, imagePrompt, videoPrompt, phase}
          ├─ 若 action=image → imageService 文生图
          ├─ 若 action=video → videoService 异步提交任务
          └─ 返回 JSON 给前端

前端轮询 GET /api/image/:taskId 或 /api/video/:taskId 获取媒体结果
```

---

## 功能说明

### 故事共创（四阶段模型）

| 阶段 | 名称 | 目标 |
|------|------|------|
| 第一阶段 | 灵感唤醒 | 选择角色与场景，激活想象力 |
| 第二阶段 | 感官细节 | 用五感问题丰富故事画面 |
| 第三阶段 | 逻辑挑战 | 引入障碍事件，培养问题解决思维 |
| 第四阶段 | 情绪反思 | 引导情绪识别与故事总结 |

### 多模态生成

- **文生图**：每个关键叙事节点自动生成儿童插画风配图
- **文生视频**：可选开启，将故事片段转为动态短视频（需设置 `ENABLE_VIDEO=true`）
- **图文小书**：一键将完整对话整理为 4–8 页绘本，含页面文字与插图描述
- **能力报告**：AI 分析对话内容，输出五维能力星级评定与个性化鼓励语

### 交互体验

- **语音输入**：基于 Web Speech API 的麦克风输入
- **朗读功能**：TTS 朗读 AI 回复（中文语音）
- **历史记录**：自动保存每次对话，支持侧边栏浏览与续写
- **年龄选择**：首次进入时选择孩子年龄段，全程适配表达难度

---

## 安装与运行

### 前置要求

- Node.js ≥ 18
- 字节跳动 Ark 平台账号（获取 API Key 及模型 ID）
- 火山引擎账号（获取 Access Key ID 与 Secret Access Key，开通图像/视频生成服务）

### 1. 克隆项目

```bash
git clone <repo-url>
cd story-magician
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制示例文件并填写密钥：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
# 字节跳动 Ark 大模型
ARK_API_KEY=your_ark_api_key_here
ARK_MODEL=doubao-seed-2-0-lite-260215

# 火山引擎（图像 & 视频生成）
VOLC_ACCESS_KEY_ID=your_volc_access_key_id_here
VOLC_SECRET_ACCESS_KEY=your_volc_secret_access_key_here

# 服务端口（默认 3200）
PORT=3200

# 是否开启文生视频功能（默认关闭）
ENABLE_VIDEO=false
```

### 4. 启动服务

```bash
# 生产模式
npm start

# 开发模式（需安装 nodemon）
npm run dev
```

### 5. 访问应用

打开浏览器访问：[http://localhost:3200](http://localhost:3200)

首次进入会弹出年龄选择界面，选择孩子所在年龄段即可开始。

---

## API 端点速览

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/session` | 创建新会话，传入 `{ ageGroup }` |
| `POST` | `/api/chat` | 发送对话消息，返回 AI 回复与媒体指令 |
| `POST` | `/api/image` | 提交文生图任务，返回图片 URL |
| `GET` | `/api/image/:taskId` | 轮询图片生成状态 |
| `POST` | `/api/video` | 提交文生视频任务，返回 taskId |
| `GET` | `/api/video/:taskId` | 轮询视频生成状态 |
| `POST` | `/api/book` | 根据对话历史生成绘本内容 |
| `POST` | `/api/report` | 生成孩子能力发展报告 |
| `GET` | `/api/histories` | 获取所有保存的历史记录列表 |
| `GET` | `/api/histories/:id` | 获取指定历史记录详情 |
| `POST` | `/api/histories/:id/resume` | 从历史记录恢复会话 |

---

## 注意事项

- 会话数据默认保存在内存中，服务重启后当前会话丢失；已完成的对话会持久化到 `.history/` 目录
- 内存会话上限为 500 条，超出后自动清除最旧的会话
- 文生视频为异步任务，生成时间较长（通常 30–120 秒），默认关闭以节省 API 调用
- 内容安全模块会自动过滤暴力、死亡等不适宜儿童的词汇，替换为温和表达
