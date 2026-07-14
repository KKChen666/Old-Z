/**
 * MySQL 数据库提供者。
 * 将现有的 mysql2/promise 连接池封装为 DatabaseProvider 接口。
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import type { DatabaseProvider, DatabaseConnection } from './database-provider.js';

dotenv.config();

// ---- MySQLConnection（单连接）----
class MySQLConnection implements DatabaseConnection {
  private conn: mysql.PoolConnection;

  constructor(conn: mysql.PoolConnection) {
    this.conn = conn;
  }

  async execute(sql: string, params?: any[]): Promise<[any[], any]> {
    return this.conn.execute(sql, params);
  }

  async beginTransaction(): Promise<void> {
    await this.conn.beginTransaction();
  }

  async commit(): Promise<void> {
    await this.conn.commit();
  }

  async rollback(): Promise<void> {
    await this.conn.rollback();
  }

  release(): void {
    this.conn.release();
  }
}

// ---- MySQLProvider ----
export class MySQLProvider implements DatabaseProvider {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
    console.log('[MySQL] Connection pool created');
  }

  async execute(sql: string, params?: any[]): Promise<[any[], any]> {
    return this.pool.execute(sql, params) as Promise<[any[], any]>;
  }

  async getConnection(): Promise<DatabaseConnection> {
    const conn = await this.pool.getConnection();
    return new MySQLConnection(conn);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const conn = await this.pool.getConnection();
      await conn.ping();
      conn.release();
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
