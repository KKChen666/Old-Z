import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { runInContext, type StorageMode } from '../config/db.js';

if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is required');
  console.error('Please set JWT_SECRET in your .env file');
  process.exit(1);
}

const JWT_SECRET: string = process.env.JWT_SECRET;

export interface AuthRequest extends Request {
  userId?: string;
  storage?: StorageMode;
}

export function generateToken(userId: string, storage: StorageMode = 'cloud'): string {
  return jwt.sign({ userId, storage }, JWT_SECRET, { expiresIn: '30d' });
}

/**
 * 可选认证中间件：不强制要求 token，但如果有则解析。
 * 所有请求都经过此中间件，确保 db.execute() 能路由到正确的库。
 */
export function contextMiddleware(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let userId: string | undefined;
  let storage: StorageMode | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as { userId: string; storage?: StorageMode };
      userId = payload.userId;
      storage = payload.storage === 'local' ? 'local' : 'cloud';
      req.userId = userId;
      req.storage = storage;
    } catch {
      // token 无效时不报错，让 authMiddleware 处理
    }
  }

  runInContext(userId, storage, next);
}

/**
 * 强制认证中间件：必须带有效 token。
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  next();
}
