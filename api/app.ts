/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import filesRoutes from './routes/files.js'
import todosRoutes from './routes/todos.js'
import notesRoutes from './routes/notes.js'
import chatRoutes from './routes/chat.js'
import timelineRoutes from './routes/timeline.js'
import settingsRoutes from './routes/settings.js'
import reportsRoutes from './routes/reports.js'
import { llmRequestContextMiddleware } from './services/llmRequestContext.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

// CORS 白名单 — 从环境变量读取允许的域名
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://localhost:8080')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

app.use(cors({
  origin(origin, cb) {
    // 允许同源请求（origin 为 undefined）和白名单域名
    if (!origin || corsOrigins.includes(origin)) {
      cb(null, true)
    } else {
      cb(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))

// 安全头 + 隐藏 X-Powered-By
app.use(helmet({ crossOriginResourcePolicy: false }))

// 通用速率限制：每 IP 每分钟 100 次请求
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '请求过于频繁，请稍后再试' },
})

// 登录/注册/重置密码：每 IP 每 15 分钟 10 次请求
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '尝试次数过多，请 15 分钟后再试' },
})

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use('/api/', apiLimiter)
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)
app.use('/api/auth/reset-password', authLimiter)
app.use(llmRequestContextMiddleware)

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/files', filesRoutes)
app.use('/api/todos', todosRoutes)
app.use('/api/notes', notesRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/timeline', timelineRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/reports', reportsRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', error)
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
