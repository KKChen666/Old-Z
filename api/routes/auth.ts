import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import pool from '../config/database.js'
import { generateToken, authMiddleware, type AuthRequest } from '../middleware/auth.js'

const router = Router()

/**
 * 用户注册
 * POST /api/auth/register
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, displayName } = req.body

    if (!username || typeof username !== 'string' || username.length < 3 || username.length > 50) {
      res.status(400).json({ success: false, error: '用户名长度需要在 3-50 个字符之间' })
      return
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ success: false, error: '密码长度至少为 6 个字符' })
      return
    }

    if (displayName && (typeof displayName !== 'string' || displayName.length > 200)) {
      res.status(400).json({ success: false, error: '显示名称过长' })
      return
    }

    // 检查用户名是否已存在
    const [existing] = await pool.execute('SELECT id FROM users WHERE username = ?', [username])
    if ((existing as any[]).length > 0) {
      res.status(409).json({ success: false, error: '用户名已存在' })
      return
    }

    const id = crypto.randomUUID()
    const passwordHash = await bcrypt.hash(password, 10)

    await pool.execute(
      'INSERT INTO users (id, username, password_hash, display_name) VALUES (?, ?, ?, ?)',
      [id, username, passwordHash, displayName || username]
    )

    const token = generateToken(id)

    res.status(201).json({
      success: true,
      data: {
        token,
        user: { id, username, displayName: displayName || username },
      },
    })
  } catch (error: any) {
    console.error('POST /auth/register error:', error)
    // 提供更具体的错误信息
    let errorMsg = '注册失败'
    if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND') {
      errorMsg = '数据库连接失败，请检查数据库配置'
    } else if (error?.code === 'ER_NO_SUCH_TABLE') {
      errorMsg = '数据库表不存在，请重启服务初始化数据库'
    } else if (error?.code === 'ER_DUP_ENTRY') {
      errorMsg = '用户名已存在'
    } else if (error?.message) {
      errorMsg = `注册失败：${error.message}`
    }
    res.status(500).json({ success: false, error: errorMsg })
  }
})

/**
 * 用户登录
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      res.status(400).json({ success: false, error: '用户名和密码不能为空' })
      return
    }

    const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username])
    const users = rows as any[]

    if (users.length === 0) {
      res.status(401).json({ success: false, error: '用户名或密码错误' })
      return
    }

    const user = users[0]
    const valid = await bcrypt.compare(password, user.password_hash)

    if (!valid) {
      res.status(401).json({ success: false, error: '用户名或密码错误' })
      return
    }

    const token = generateToken(user.id)

    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, username: user.username, displayName: user.display_name },
      },
    })
  } catch (error: any) {
    console.error('POST /auth/login error:', error)
    let errorMsg = '登录失败'
    if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND') {
      errorMsg = '数据库连接失败，请检查数据库配置'
    } else if (error?.code === 'ER_NO_SUCH_TABLE') {
      errorMsg = '数据库表不存在，请重启服务初始化数据库'
    } else if (error?.message) {
      errorMsg = `登录失败：${error.message}`
    }
    res.status(500).json({ success: false, error: errorMsg })
  }
})

/**
 * 忘记密码 / 重置密码
 * POST /api/auth/reset-password
 */
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, newPassword } = req.body

    if (!username || typeof username !== 'string') {
      res.status(400).json({ success: false, error: '请输入用户名' })
      return
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ success: false, error: '新密码长度至少为 6 个字符' })
      return
    }

    // 检查用户是否存在
    const [rows] = await pool.execute('SELECT id, username FROM users WHERE username = ?', [username])
    const users = rows as any[]

    if (users.length === 0) {
      res.status(404).json({ success: false, error: '用户不存在' })
      return
    }

    const user = users[0]
    const passwordHash = await bcrypt.hash(newPassword, 10)

    // 更新密码
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id])

    // 生成新 token 并自动登录
    const token = generateToken(user.id)

    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, username: user.username, displayName: user.display_name },
      },
    })
  } catch (error: any) {
    console.error('POST /auth/reset-password error:', error)
    let errorMsg = '密码重置失败'
    if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND') {
      errorMsg = '数据库连接失败，请检查数据库配置'
    } else if (error?.code === 'ER_NO_SUCH_TABLE') {
      errorMsg = '数据库表不存在，请重启服务初始化数据库'
    } else if (error?.message) {
      errorMsg = `密码重置失败：${error.message}`
    }
    res.status(500).json({ success: false, error: errorMsg })
  }
})

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.execute('SELECT id, username, display_name, created_at FROM users WHERE id = ?', [req.userId!])
    const users = rows as any[]

    if (users.length === 0) {
      res.status(404).json({ success: false, error: '用户不存在' })
      return
    }

    const user = users[0]
    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        createdAt: user.created_at,
      },
    })
  } catch (error) {
    console.error('GET /auth/me error:', error)
    res.status(500).json({ success: false, error: '获取用户信息失败' })
  }
})

/**
 * 更新用户资料（昵称 / 用户名）
 * PATCH /api/auth/profile
 */
router.patch('/profile', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { displayName, username } = req.body;

    if (displayName !== undefined && (typeof displayName !== 'string' || displayName.length > 200)) {
      res.status(400).json({ success: false, error: '显示名称过长' });
      return;
    }

    if (username !== undefined) {
      if (typeof username !== 'string' || username.length < 3 || username.length > 50) {
        res.status(400).json({ success: false, error: '用户名长度需要在 3-50 个字符之间' });
        return;
      }
      // 检查唯一性
      const [existing] = await pool.execute(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username, req.userId!]
      );
      if ((existing as any[]).length > 0) {
        res.status(409).json({ success: false, error: '用户名已被占用' });
        return;
      }
      await pool.execute('UPDATE users SET username = ? WHERE id = ?', [username, req.userId!]);
    }

    if (displayName !== undefined) {
      await pool.execute('UPDATE users SET display_name = ? WHERE id = ?', [displayName, req.userId!]);
    }

    const [rows] = await pool.execute('SELECT id, username, display_name, created_at FROM users WHERE id = ?', [req.userId!]);
    const user = (rows as any[])[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('PATCH /auth/profile error:', error);
    res.status(500).json({ success: false, error: '更新资料失败' });
  }
});

/**
 * 修改密码
 * POST /api/auth/change-password
 */
router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      res.status(400).json({ success: false, error: '请输入旧密码和新密码' });
      return;
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ success: false, error: '新密码长度至少为 6 个字符' });
      return;
    }

    // 验证旧密码
    const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [req.userId!]);
    const users = rows as any[];
    if (users.length === 0) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    const valid = await bcrypt.compare(oldPassword, users[0].password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: '旧密码错误' });
      return;
    }

    // 更新密码
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.userId!]);

    res.json({ success: true, data: { message: '密码修改成功' } });
  } catch (error) {
    console.error('POST /auth/change-password error:', error);
    res.status(500).json({ success: false, error: '密码修改失败' });
  }
});

export default router
