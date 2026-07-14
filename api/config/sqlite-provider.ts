/**
 * SQLite 数据库提供者（基于 sql.js / WASM）。
 *
 * sql.js 是纯 WebAssembly 实现的 SQLite3，无需任何原生编译。
 * 支持 FTS5、JSON 扩展、WAL 模式。
 *
 * 数据库文件位置：
 *   - Electron 生产模式：<userData>/oldz-data.db
 *   - 开发模式：项目根目录 data/oldz-data.db
 *   - 通过 OLDZ_DB_PATH 环境变量可自定义
 *
 * 注意：sql.js 运行在内存中，通过 autoSave() 持久化到磁盘。
 *       每次写入操作后自动保存（频率不高的情况下开销可忽略）。
 */

import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';
import path from 'path';
import fs from 'fs';
import type { DatabaseProvider, DatabaseConnection } from './database-provider.js';

// ---- 解析数据库文件路径 ----
function resolveDbPath(): string {
  if (process.env.OLDZ_DB_PATH) {
    return process.env.OLDZ_DB_PATH;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electronApp = require('electron')?.app;
    if (electronApp?.isPackaged) {
      const userData = electronApp.getPath('userData');
      return path.join(userData, 'oldz-data.db');
    }
  } catch {
    // 非 Electron 环境
  }

  const dataDir = process.env.OLDZ_DATA_DIR || path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'oldz-data.db');
}

// ---- SQLiteConnection ----
class SQLiteConnection implements DatabaseConnection {
  private db: SqlJsDatabase;
  private provider: SQLiteProvider;

  constructor(db: SqlJsDatabase, provider: SQLiteProvider) {
    this.db = db;
    this.provider = provider;
  }

  async execute(sql: string, params?: any[]): Promise<[any[], any]> {
    return executeSQL(this.db, sql, params, this.provider);
  }

  async beginTransaction(): Promise<void> {
    this.db.run('BEGIN IMMEDIATE');
  }

  async commit(): Promise<void> {
    this.db.run('COMMIT');
    this.provider.autoSave();
  }

  async rollback(): Promise<void> {
    this.db.run('ROLLBACK');
  }

  release(): void {
    // sql.js 连接是共享同一个 Database 对象
  }
}

// ---- SQL 执行辅助 ----

/** 将 JS Date 转为 ISO 字符串，其他类型保持不变（sql.js 不支持 Date 绑定） */
function normalizeParams(params: any[] | undefined): any[] | undefined {
  if (!params) return params;
  return params.map((p) => (p instanceof Date ? p.toISOString().replace('T', ' ').slice(0, 19) : p));
}

function executeSQL(
  db: SqlJsDatabase,
  sql: string,
  params: any[] | undefined,
  provider: SQLiteProvider
): [any[], any] {
  const normalized = normalizeParams(params);
  const trimmed = sql.trim().toUpperCase();
  const isQuery =
    trimmed.startsWith('SELECT') ||
    trimmed.startsWith('WITH') ||
    trimmed.startsWith('PRAGMA');

  try {
    if (isQuery) {
      const rows = queryAll(db, sql, normalized);
      return [rows, { affectedRows: rows.length }];
    }

    // DML 操作
    db.run(sql, normalized || []);
    // 获取 affected rows（SQLite 的 changes() 函数）
    const changesResult = db.exec('SELECT changes() AS changed');
    const changes = changesResult.length > 0 ? changesResult[0].values[0][0] : 0;
    const lastIdResult = db.exec('SELECT last_insert_rowid() AS id');
    const insertId = lastIdResult.length > 0 ? Number(lastIdResult[0].values[0][0]) : undefined;

    provider.autoSave();
    return [[], { affectedRows: changes, insertId }];
  } catch (e: any) {
    // 重新抛出，保留原始错误信息
    throw new Error(`SQL error: ${e?.message || e}`);
  }
}

/**
 * 执行 SELECT 查询，返回所有行的对象数组。
 */
function queryAll(
  db: SqlJsDatabase,
  sql: string,
  params: any[] | undefined
): any[] {
  const stmt = db.prepare(sql);
  try {
    if (params && params.length > 0) {
      stmt.bind(params);
    }

    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    return rows;
  } finally {
    stmt.free();
  }
}

// ---- SQLiteProvider ----
export class SQLiteProvider implements DatabaseProvider {
  private db: SqlJsDatabase | null = null;
  private sqlJs: SqlJsStatic | null = null;
  private dbPath: string;
  private _initialized = false;
  private _readyPromise: Promise<void> | null = null;
  private _autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.dbPath = resolveDbPath();
  }

  /**
   * 异步初始化：加载 WASM 并打开/创建数据库。
   * 在使用任何方法前，确保调用了此方法或等待 ready。
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;
    if (this._readyPromise) return this._readyPromise;

    this._readyPromise = (async () => {
      console.log(`[SQLite] Loading WASM, database at: ${this.dbPath}`);

      this.sqlJs = await initSqlJs();

      // 尝试从磁盘加载已有数据库
      let buffer: Uint8Array | undefined;
      try {
        if (fs.existsSync(this.dbPath)) {
          const fileBuffer = fs.readFileSync(this.dbPath);
          buffer = new Uint8Array(fileBuffer);
          console.log(`[SQLite] Loaded existing database (${fileBuffer.length} bytes)`);
        } else {
          console.log('[SQLite] Creating new database');
        }
      } catch {
        console.log('[SQLite] Failed to read existing file, creating new database');
      }

      this.db = new this.sqlJs.Database(buffer);

      // 启用 WAL 和性能设置
      this.db.run('PRAGMA journal_mode = WAL');
      this.db.run('PRAGMA synchronous = NORMAL');
      this.db.run('PRAGMA foreign_keys = ON');
      this.db.run('PRAGMA cache_size = -8000');

      // 写入初始文件（如果新建）
      if (!fs.existsSync(this.dbPath)) {
        this.saveToDisk();
      }

      this._initialized = true;
      console.log('[SQLite] Database ready');
    })();

    return this._readyPromise;
  }

  /**
   * 确保已初始化，否则抛出错误。
   */
  private ensureReady(): SqlJsDatabase {
    if (!this.db || !this._initialized) {
      throw new Error('[SQLite] Database not initialized. Call await provider.initialize() first.');
    }
    return this.db;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  get databasePath(): string {
    return this.dbPath;
  }

  /**
   * 获取原始 sql.js Database 对象（用于高级操作如 FTS5）。
   */
  get raw(): SqlJsDatabase {
    return this.ensureReady();
  }

  async execute(sql: string, params?: any[]): Promise<[any[], any]> {
    return executeSQL(this.ensureReady(), sql, params, this);
  }

  async getConnection(): Promise<DatabaseConnection> {
    return new SQLiteConnection(this.ensureReady(), this);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const db = this.ensureReady();
      db.run('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    // 最后的自动保存
    if (this._autoSaveTimeout) {
      clearTimeout(this._autoSaveTimeout);
      this._autoSaveTimeout = null;
    }
    this.saveToDisk();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this._initialized = false;
  }

  /**
   * 写入操作后自动保存（带防抖，合并 100ms 内的多次写入）。
   */
  autoSave(): void {
    if (this._autoSaveTimeout) {
      clearTimeout(this._autoSaveTimeout);
    }
    this._autoSaveTimeout = setTimeout(() => {
      this.saveToDisk();
      this._autoSaveTimeout = null;
    }, 100);
  }

  /**
   * 立即将数据库写入磁盘。
   */
  saveToDisk(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 原子写入：先写临时文件，再重命名
      const tmpPath = this.dbPath + '.tmp';
      fs.writeFileSync(tmpPath, buffer);
      fs.renameSync(tmpPath, this.dbPath);
    } catch (e: any) {
      console.error('[SQLite] Failed to save database:', e?.message || e);
    }
  }

  /**
   * 获取 schema 版本。
   */
  getUserVersion(): number {
    const db = this.ensureReady();
    const result = db.exec('PRAGMA user_version');
    if (result.length > 0 && result[0].values.length > 0) {
      return Number(result[0].values[0][0]);
    }
    return 0;
  }

  /**
   * 设置 schema 版本。
   */
  setUserVersion(version: number): void {
    const db = this.ensureReady();
    db.run(`PRAGMA user_version = ${version}`);
    this.autoSave();
  }
}

// 创建单例（需要在使用前调用 await sqliteProvider.initialize()）
const sqliteProvider = new SQLiteProvider();
export default sqliteProvider;
