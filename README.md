# Old Z

> AI 驱动的个人知识管理桌面应用 — 文件、笔记、待办、AI 对话，一站管理。支持 Windows 桌面端和 Android 移动端。

## 功能特性

- **📊 仪表盘** — 任务、笔记、最近动态一目了然。
- **📁 文件管理** — 上传、整理、预览文件。支持 PDF、Word（DOCX）、Excel、CSV、图片、视频、音频及纯文本。
- **✅ 待办清单** — 任务管理，支持优先级（低/中/高/紧急）、子任务、标签、截止日期和今日待办置顶。
- **📝 笔记** — 富文本笔记，支持标签、关联文件、关联待办和历史快照（版本回溯）。
- **🤖 AI 对话** — AI 智能助手，支持全局对话和单篇笔记内对话。可根据上下文智能建议待办、笔记和提醒。
- **📅 时间线** — 按时间回溯文件上传、待办创建/完成、笔记编辑、对话记录和 AI 提醒。
- **☁️ 云存储** — 基于阿里云 OSS 的文件存储。
- **🔒 身份认证** — 基于 JWT 登录 + bcrypt 密码哈希。
- **🌙 深色主题** — 墨纸色调的深色界面。

## 技术栈

| 层级 | 技术 |
|-------|-----------|
| 前端 | React 18、TypeScript、Vite、Tailwind CSS |
| 状态管理 | Zustand |
| 桌面壳 | Electron |
| 移动端壳 | Capacitor（Android） |
| 后端 | Express.js（TypeScript，通过 tsx 运行） |
| 数据库 | MySQL 2 |
| AI | OpenAI API |
| 图表 | Chart.js + react-chartjs-2 |
| 编辑器 | MDX Editor |
| 文件解析 | PDF.js、Mammoth（DOCX）、SheetJS（xlsx）、PapaParse（CSV） |
| 图标 | Lucide React |

## 环境要求

- **Node.js** >= 18
- **MySQL** 数据库
- **阿里云 OSS** 存储桶（用于文件上传）
- **OpenAI API** 密钥（用于 AI 功能，可选）

## 快速开始

### 1. 克隆并安装

```bash
git clone <repo-url>
cd oldz
npm install
```

### 2. 环境变量

在项目根目录创建 `.env` 文件：

```env
# 数据库
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=oldz

# JWT
JWT_SECRET=your_secret_key

# 阿里云 OSS
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=your_access_key
OSS_ACCESS_KEY_SECRET=your_secret
OSS_BUCKET=your_bucket_name

# OpenAI（可选，用于 AI 对话功能）
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
```

### 3. 开发

全栈开发模式（前端 + 后端 + Electron）：

```bash
npm run dev
```

也可单独启动各模块：

```bash
npm run client:dev      # 仅 Vite 开发服务器
npm run server:dev      # 仅 API 服务器
npm run electron:dev    # 仅 Electron 窗口
```

Vite 开发服务器运行在 `http://localhost:5173`，Express API 运行在 `http://localhost:3001`。

### 4. 构建与打包

**Web 构建：**

```bash
npm run build        # TypeScript + Vite 生产构建
npm run preview      # 预览生产构建
```

**Electron 桌面应用：**

```bash
npm run build:all                 # 构建前端和 Electron
npm run electron:package          # 使用 @electron/packager 打包
npm run electron:installer        # 生成 Windows NSIS 安装包
```

**Android（Capacitor）：**

```bash
npm run cap:sync                  # 同步 Web 构建到 Android 项目
npm run cap:android               # 在 Android Studio 中打开
```

## 项目结构

```
oldz/
├── api/                    # Express API 服务
│   ├── config/             # 数据库配置
│   ├── database/           # 数据库迁移与初始化
│   ├── middleware/         # 认证中间件
│   ├── routes/             # API 路由处理
│   └── services/           # AI、设置、对话服务
├── electron/               # Electron 主进程与预加载
├── src/                    # React 前端
│   ├── components/         # 公共组件
│   │   └── FilePreview/    # 各类型文件预览器
│   ├── hooks/              # 自定义 React Hooks
│   ├── lib/                # 工具函数
│   ├── pages/              # 页面组件
│   ├── stores/             # Zustand 状态管理
│   ├── types/              # TypeScript 类型定义
│   └── utils/              # API 客户端与 OSS 工具
├── android/                # Capacitor Android 项目
└── capacitor.config.ts     # Capacitor 配置
```

## License

Private — Old Z Team
