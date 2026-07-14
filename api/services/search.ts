/**
 * 全文搜索服务。
 * 使用 Bigram 分词 + inverted index（bigrams 列 + LIKE 匹配）。
 * 不依赖 FTS5 扩展（兼容 sql.js WASM 默认构建）。
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import sqliteProvider from '../config/sqlite-provider.js';
import { bigramTokenStream, bigramSearchExpression, extractPreview, extractTitle } from './bigram.js';

export interface SearchResult {
  entityType: 'note' | 'todo' | 'file';
  entityId: string;
  title: string;
  preview: string;
}

export interface SearchOptions {
  kind?: 'note' | 'todo' | 'file' | 'all';
  userId?: string;
  limit?: number;
}

const MIN_QUERY_CHARS = 2;
const MAX_RESULTS = 50;

// ---- 辅助：sql.js 查询 ----
function queryAll(db: SqlJsDatabase, sql: string, params: any[]): any[] {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows: any[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

function queryOne(db: SqlJsDatabase, sql: string, params: any[]): any | undefined {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    if (stmt.step()) return stmt.getAsObject();
    return undefined;
  } finally {
    stmt.free();
  }
}

// ---- 索引操作 ----

function buildBigrams(name: string, title: string, content: string): string {
  return [bigramTokenStream(name), bigramTokenStream(title), bigramTokenStream(content)]
    .filter(Boolean)
    .join(' ');
}

async function upsertIndex(
  entityType: 'note' | 'todo' | 'file',
  entityId: string, userId: string,
  name: string, title: string, preview: string, content: string
): Promise<void> {
  await sqliteProvider.initialize();
  const db = sqliteProvider.raw;
  const bigrams = buildBigrams(name, title, content);

  db.run(`INSERT INTO search_index (entity_type, entity_id, user_id, name, title, preview, bigrams, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(entity_type, entity_id) DO UPDATE SET
      name = excluded.name, title = excluded.title,
      preview = excluded.preview, bigrams = excluded.bigrams,
      updated_at = datetime('now')`,
    [entityType, entityId, userId, name, title, preview, bigrams]
  );
  sqliteProvider.autoSave();
}

export async function indexNote(noteId: string, title: string, content: string, userId: string): Promise<void> {
  if (process.env.DB_PROVIDER === 'mysql') return;
  await upsertIndex('note', noteId, userId, title, extractTitle(content, title), extractPreview(content), content);
}

export async function indexTodo(todoId: string, title: string, description: string | null, userId: string): Promise<void> {
  if (process.env.DB_PROVIDER === 'mysql') return;
  await upsertIndex('todo', todoId, userId, title, title, description ? extractPreview(description) : '', description || '');
}

export async function indexFile(fileId: string, name: string, content: string | null, userId: string): Promise<void> {
  if (process.env.DB_PROVIDER === 'mysql') return;
  await upsertIndex('file', fileId, userId, name, name, content ? extractPreview(content) : '', content || '');
}

export async function removeFromIndex(entityType: 'note' | 'todo' | 'file', entityId: string): Promise<void> {
  if (process.env.DB_PROVIDER === 'mysql') return;
  await sqliteProvider.initialize();
  sqliteProvider.raw.run('DELETE FROM search_index WHERE entity_type = ? AND entity_id = ?', [entityType, entityId]);
  sqliteProvider.autoSave();
}

// ---- 搜索 ----

/**
 * 将查询转为 bigram token，在 bigrams 列中 LIKE 匹配。
 * 多个 bigram token 之间用 AND 连接（所有 token 都必须匹配）。
 */
function buildBigramLikeClause(query: string): { clause: string; params: string[] } {
  const tokens = bigramTokenStream(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return { clause: '1=0', params: [] };

  const conditions = tokens.map(() => `si.bigrams LIKE ?`);
  const params = tokens.map((t) => `%${t}%`);
  return { clause: conditions.join(' AND '), params };
}

export async function searchAll(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const { kind = 'all', userId, limit = MAX_RESULTS } = options;
  if ([...query.trim()].length < MIN_QUERY_CHARS) return [];

  await sqliteProvider.initialize();
  const db = sqliteProvider.raw;

  const { clause, params } = buildBigramLikeClause(query);
  if (params.length === 0) return [];

  let where = clause;
  if (kind !== 'all') { where += ' AND si.entity_type = ?'; params.push(kind); }
  if (userId) { where += ' AND si.user_id = ?'; params.push(userId); }

  const sql = `SELECT si.entity_type, si.entity_id, si.title, si.preview
    FROM search_index si WHERE ${where}
    ORDER BY si.title COLLATE NOCASE
    LIMIT ${Math.min(limit, 200)}`;

  const rows = queryAll(db, sql, params);
  return rows.map((r: any) => ({
    entityType: r.entity_type,
    entityId: r.entity_id,
    title: r.title,
    preview: r.preview || '',
  }));
}

export async function searchByKind(
  kind: 'note' | 'todo' | 'file', queries: string[], options: SearchOptions = {}
): Promise<SearchResult[]> {
  if (process.env.DB_PROVIDER === 'mysql') return searchLikeFallback(queries.join(' '), { ...options, kind });

  const { userId, limit = MAX_RESULTS } = options;
  // 合并多个查询词
  const combinedQuery = queries.join(' ');
  if ([...combinedQuery.trim()].length < MIN_QUERY_CHARS) return [];

  await sqliteProvider.initialize();
  const db = sqliteProvider.raw;

  const { clause, params } = buildBigramLikeClause(combinedQuery);
  if (params.length === 0) return [];

  let where = `${clause} AND si.entity_type = ?`;
  params.push(kind);
  if (userId) { where += ' AND si.user_id = ?'; params.push(userId); }

  const rows = queryAll(db, `SELECT si.entity_type, si.entity_id, si.title, si.preview
    FROM search_index si WHERE ${where}
    ORDER BY si.title COLLATE NOCASE LIMIT ${Math.min(limit, 200)}`, params);

  return rows.map((r: any) => ({
    entityType: r.entity_type,
    entityId: r.entity_id,
    title: r.title,
    preview: r.preview || '',
  }));
}

export async function rebuildUserIndex(userId: string): Promise<number> {
  if (process.env.DB_PROVIDER === 'mysql') return 0;
  await sqliteProvider.initialize();
  const db = sqliteProvider.raw;
  let count = 0;

  db.run('DELETE FROM search_index WHERE user_id = ?', [userId]);

  const notes = queryAll(db, 'SELECT id, title, content FROM notes WHERE user_id = ?', [userId]);
  for (const note of notes) { await indexNote(note.id, note.title, note.content, userId); count++; }

  const todos = queryAll(db, 'SELECT id, title, description FROM todos WHERE user_id = ?', [userId]);
  for (const todo of todos) { await indexTodo(todo.id, todo.title, todo.description, userId); count++; }

  const files = queryAll(db, 'SELECT id, name, content FROM files WHERE user_id = ?', [userId]);
  for (const file of files) { await indexFile(file.id, file.name, file.content, userId); count++; }

  return count;
}

// MySQL 降级搜索
async function searchLikeFallback(query: string, options: SearchOptions): Promise<SearchResult[]> {
  const { kind = 'all', userId, limit = MAX_RESULTS } = options;
  const keyword = `%${query.trim()}%`;
  if ([...query.trim()].length < MIN_QUERY_CHARS) return [];

  const { default: db } = await import('../config/db.js');
  const results: SearchResult[] = [];

  const search = async (sql: string, params: any[], type: SearchResult['entityType']) => {
    const [rows] = await db.execute(sql, params);
    for (const row of rows as any[]) {
      results.push({ entityType: type, entityId: row.id, title: row.title || row.name,
        preview: extractPreview(row.preview || row.content || '') });
    }
  };

  if (kind === 'all' || kind === 'note') {
    const p: any[] = [keyword]; if (userId) p.push(userId);
    await search(`SELECT id, title, content AS preview FROM notes WHERE title LIKE ? ${userId ? 'AND user_id = ?' : ''} LIMIT ${limit}`, p, 'note');
  }
  if (kind === 'all' || kind === 'todo') {
    const p: any[] = [keyword]; if (userId) p.push(userId);
    await search(`SELECT id, title, description AS preview FROM todos WHERE title LIKE ? ${userId ? 'AND user_id = ?' : ''} LIMIT ${limit}`, p, 'todo');
  }
  if (kind === 'all' || kind === 'file') {
    const p: any[] = [keyword]; if (userId) p.push(userId);
    await search(`SELECT id, name AS title, content AS preview FROM files WHERE name LIKE ? ${userId ? 'AND user_id = ?' : ''} LIMIT ${limit}`, p, 'file');
  }

  return results.slice(0, limit);
}
