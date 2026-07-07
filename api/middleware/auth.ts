import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'

if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is required')
  console.error('Please set JWT_SECRET in your .env file')
  process.exit(1)
}

const JWT_SECRET: string = process.env.JWT_SECRET

export interface AuthRequest extends Request {
  userId?: string
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' })
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }

  const token = authHeader.split(' ')[1]
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string }
    req.userId = payload.userId
    next()
  } catch {
    res.status(401).json({ success: false, error: 'Invalid token' })
  }
}
