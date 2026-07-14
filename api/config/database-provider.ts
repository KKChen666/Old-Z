/**
 * 数据库抽象接口。
 * 所有 service/route 层不直接依赖 MySQL 或 SQLite，仅依赖此接口。
 * execute() 签名与 mysql2/promise 的 pool.execute() 保持一致：返回 [rows[], fields]。
 */

export interface DatabaseConnection {
  execute(sql: string, params?: any[]): Promise<[any[], any]>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
}

export interface DatabaseProvider {
  /** 执行单条 SQL，返回 [rows, fields] */
  execute(sql: string, params?: any[]): Promise<[any[], any]>;

  /** 获取独立连接（用于事务） */
  getConnection(): Promise<DatabaseConnection>;

  /** 健康检查 */
  healthCheck(): Promise<boolean>;

  /** 关闭连接 */
  close(): Promise<void>;
}
