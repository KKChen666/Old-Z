/**
 * 双数据库架构（AsyncLocalStorage 版）：
 *   - MySQL（云端）：登录用户，多设备共享
 *   - SQLite（本地）：local-user / 无用户上下文，离线也可用
 *
 * db.execute() 自动根据当前请求的 userId 选择数据库。
 * 无需修改任何 route 文件。
 */

import { AsyncLocalStorage } from 'async_hooks';
import type { DatabaseProvider } from './database-provider.js';
import { MySQLProvider } from './mysql-provider.js';
import sqliteProvider from './sqlite-provider.js';
import type { Pool } from 'mysql2/promise';

// ---- 请求上下文 ----
export type StorageMode = 'local' | 'cloud';

const requestContext = new AsyncLocalStorage<{ userId?: string; storage?: StorageMode }>();

/** 在请求上下文中执行回调（中间件调用） */
export function runInContext(userId: string | undefined, storage: StorageMode | undefined, fn: () => void): void {
  requestContext.run({ userId, storage }, fn);
}

/** 获取当前请求的 userId */
export function getCurrentUserId(): string | undefined {
  return requestContext.getStore()?.userId;
}

export function getCurrentStorage(): StorageMode | undefined {
  return requestContext.getStore()?.storage;
}

// ---- 数据库实例 ----
let _mysqlProvider: MySQLProvider | null = null;
let _mysqlPool: Pool | null = null;
let _mysqlAvailable = false;

if (process.env.DB_HOST) {
  try {
    _mysqlProvider = new MySQLProvider();
    _mysqlPool = (_mysqlProvider as any).pool;
    _mysqlAvailable = true;
    console.log('[DB] MySQL available (cloud)');
  } catch (e: any) {
    console.warn('[DB] MySQL init failed:', e?.message || e);
  }
} else {
  console.log('[DB] No MySQL credentials — SQLite only');
}

export function isMySQLAvailable(): boolean {
  return _mysqlAvailable;
}

// ---- 核心：自动路由的 execute ----

async function routeExecute(sql: string, params?: any[]): Promise<[any[], any]> {
  const userId = getCurrentUserId();
  const storage = getCurrentStorage();
  // local-user 或无上下文 → SQLite；其他用户 → MySQL
  if (storage !== 'local' && userId && _mysqlProvider && _mysqlAvailable) {
    return _mysqlProvider.execute(sql, params);
  }
  await sqliteProvider.initialize();
  return sqliteProvider.execute(sql, params);
}

// 兼容旧代码的 getConnection（按需选择库）
async function routeGetConnection(): Promise<import('./database-provider.js').DatabaseConnection> {
  const userId = getCurrentUserId();
  const storage = getCurrentStorage();
  if (storage !== 'local' && userId && _mysqlProvider && _mysqlAvailable) {
    return _mysqlProvider.getConnection();
  }
  await sqliteProvider.initialize();
  return sqliteProvider.getConnection();
}

// ---- 显式路由（auth 路由专用） ----

/** 强制用 SQLite 执行 */
export async function executeOnSQLite(sql: string, params?: any[]): Promise<[any[], any]> {
  await sqliteProvider.initialize();
  return sqliteProvider.execute(sql, params);
}

/** 强制用 MySQL 执行 */
export async function executeOnMySQL(sql: string, params?: any[]): Promise<[any[], any]> {
  if (!_mysqlProvider) throw new Error('MySQL not available');
  return _mysqlProvider.execute(sql, params);
}

/** 强制获取 MySQL 连接（同步密钥认证的云端请求使用） */
export async function getConnectionOnMySQL(): Promise<import('./database-provider.js').DatabaseConnection> {
  if (!_mysqlProvider) throw new Error('MySQL not available');
  return _mysqlProvider.getConnection();
}

/** 根据用户名推测用户类型，路由到正确的库 */
export function executeForUsername(username: string | undefined, sql: string, params?: any[]): Promise<[any[], any]> {
  if (username === 'local-user') return executeOnSQLite(sql, params);
  if (_mysqlAvailable) return executeOnMySQL(sql, params);
  return executeOnSQLite(sql, params);
}

// ---- 便携 upsert（自动选 MySQL / SQLite 语法）----

/**
 * INSERT ... ON DUPLICATE KEY UPDATE（MySQL）或 INSERT OR REPLACE（SQLite）
 * 根据当前请求上下文自动选择。
 * columns: 所有列名（含 id）
 * conflictColumns: MySQL 冲突检测的列（如 ['user_id', 'report_date']）
 */
export async function upsert(
  table: string, columns: string[], values: any[], conflictColumns: string[]
): Promise<[any[], any]> {
  const userId = getCurrentUserId();
  const storage = getCurrentStorage();
  if (storage !== 'local' && userId && _mysqlProvider && _mysqlAvailable) {
    // MySQL: INSERT ... ON DUPLICATE KEY UPDATE
    const placeholders = columns.map(() => '?').join(', ');
    const updates = columns
      .filter(c => !conflictColumns.includes(c))
      .map(c => `${c} = VALUES(${c})`)
      .join(', ');
    return _mysqlProvider.execute(
      `INSERT INTO ${table} (${columns.join(', ')})
       VALUES (${placeholders})
       ON DUPLICATE KEY UPDATE ${updates}`,
      values
    );
  }
  // SQLite: INSERT OR REPLACE
  await sqliteProvider.initialize();
  const placeholders = columns.map(() => '?').join(', ');
  return sqliteProvider.execute(
    `INSERT OR REPLACE INTO ${table} (${columns.join(', ')})
     VALUES (${placeholders})`,
    values
  );
}

// ---- 导出 ----

export { routeExecute as execute };
export { routeGetConnection as getConnection };
export function getPool(): Pool | null { return _mysqlPool; }

const db = { execute: routeExecute, getConnection: routeGetConnection };
export default db;
