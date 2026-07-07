# Old Z 项目记忆

## 项目概览
- **技术栈**：React + TypeScript + Vite + Zustand + Electron + Capacitor
- **后端**：Express + MySQL + 阿里云 OSS
- **项目路径**：`D:\code\oldz`

## 关键架构决策
- OSS 凭证仅在服务端使用（`api/routes/files.ts` POST /upload 代理），前端不持有密钥
- JWT Secret 必须通过环境变量配置，未设置则服务启动即退出
- AI 聊天使用 SSE 流式响应（`/api/chat/stream`），前端逐字显示
- 路由级 code splitting：所有页面 `React.lazy` + `Suspense`
- Zustand v5 使用 `useShallow` selector 防止全局 re-render
- Toast 通知系统使用全局 listener 模式，非组件代码可调用

## 环境变量
- `JWT_SECRET`（必需）：随机字符串，至少 32 位
- `CORS_ORIGINS`：允许的前端域名，逗号分隔
- `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET`：后端 OSS 凭证
- `VITE_API_BASE_URL`：前端直连 API 地址（Capacitor/Electron 用）

## npm 注意事项
- 安装包时使用 `--cache "$HOME/.npm-cache"` 避免权限问题
- compression 包安装可能失败，可跳过 gzip 中间件
