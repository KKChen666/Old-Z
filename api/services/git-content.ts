import fs from 'node:fs';
import path from 'node:path';
import db, { getCurrentStorage } from '../config/db.js';

type Row = Record<string, unknown>;

function getDataDir(): string {
  return process.env.OLDZ_DATA_DIR || path.resolve(process.cwd(), 'data');
}

function entityPath(kind: 'notes' | 'todos', id: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(id)) {
    throw new Error(`无法为非法数据 ID 创建 Git 快照: ${id}`);
  }
  return path.join(getDataDir(), kind, `${id}.json`);
}

function writeIfChanged(filePath: string, value: unknown): void {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === content) return;

  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function removeIfPresent(filePath: string): void {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function sortedStrings(rows: Row[], key: string): string[] {
  return rows.map((row) => String(row[key])).sort((a, b) => a.localeCompare(b));
}

export function isLocalGitContext(): boolean {
  return getCurrentStorage() === 'local';
}

export async function materializeNote(userId: string, noteId: string): Promise<boolean> {
  if (!isLocalGitContext()) return false;

  const [noteRows] = await db.execute('SELECT * FROM notes WHERE id = ? AND user_id = ?', [noteId, userId]);
  const note = (noteRows as Row[])[0];
  const filePath = entityPath('notes', noteId);
  if (!note) {
    removeIfPresent(filePath);
    return true;
  }

  const [[tags], [files], [todos]] = await Promise.all([
    db.execute('SELECT tag FROM note_tags WHERE note_id = ? ORDER BY tag', [noteId]),
    db.execute('SELECT file_id FROM note_files WHERE note_id = ? ORDER BY file_id', [noteId]),
    db.execute('SELECT todo_id FROM note_todos WHERE note_id = ? ORDER BY todo_id', [noteId]),
  ]);

  writeIfChanged(filePath, {
    schemaVersion: 1,
    type: 'note',
    id: String(note.id),
    title: String(note.title || ''),
    content: String(note.content || ''),
    tags: sortedStrings(tags as Row[], 'tag'),
    linkedFileIds: sortedStrings(files as Row[], 'file_id'),
    linkedTodoIds: sortedStrings(todos as Row[], 'todo_id'),
    createdAt: note.created_at == null ? null : String(note.created_at),
    updatedAt: note.updated_at == null ? null : String(note.updated_at),
  });
  return true;
}

export async function materializeTodo(userId: string, todoId: string): Promise<boolean> {
  if (!isLocalGitContext()) return false;

  const [todoRows] = await db.execute('SELECT * FROM todos WHERE id = ? AND user_id = ?', [todoId, userId]);
  const todo = (todoRows as Row[])[0];
  const filePath = entityPath('todos', todoId);
  if (!todo) {
    removeIfPresent(filePath);
    return true;
  }

  const [[tags], [subtasks], [files], [notes]] = await Promise.all([
    db.execute('SELECT tag FROM todo_tags WHERE todo_id = ? ORDER BY tag', [todoId]),
    db.execute('SELECT id, title, done FROM subtasks WHERE todo_id = ? ORDER BY id', [todoId]),
    db.execute('SELECT file_id FROM todo_files WHERE todo_id = ? ORDER BY file_id', [todoId]),
    db.execute('SELECT note_id FROM todo_notes WHERE todo_id = ? ORDER BY note_id', [todoId]),
  ]);

  writeIfChanged(filePath, {
    schemaVersion: 1,
    type: 'todo',
    id: String(todo.id),
    title: String(todo.title || ''),
    description: todo.description == null ? null : String(todo.description),
    priority: String(todo.priority || 'medium'),
    status: String(todo.status || 'pending'),
    dueDate: todo.due_date == null ? null : String(todo.due_date),
    isTodayTodo: Boolean(todo.is_today_todo),
    tags: sortedStrings(tags as Row[], 'tag'),
    subtasks: (subtasks as Row[]).map((row) => ({
      id: String(row.id),
      title: String(row.title || ''),
      done: Boolean(row.done),
    })),
    linkedFileIds: sortedStrings(files as Row[], 'file_id'),
    linkedNoteIds: sortedStrings(notes as Row[], 'note_id'),
    createdAt: todo.created_at == null ? null : String(todo.created_at),
  });
  return true;
}

function removeStaleSnapshots(kind: 'notes' | 'todos', activeIds: Set<string>): void {
  const directory = path.join(getDataDir(), kind);
  if (!fs.existsSync(directory)) return;

  for (const name of fs.readdirSync(directory)) {
    if (!name.endsWith('.json')) continue;
    const id = name.slice(0, -5);
    if (!activeIds.has(id)) removeIfPresent(path.join(directory, name));
  }
}

export async function materializeAllGitContent(userId: string): Promise<boolean> {
  if (!isLocalGitContext()) return false;

  const [[notes], [todos]] = await Promise.all([
    db.execute('SELECT id FROM notes WHERE user_id = ? ORDER BY id', [userId]),
    db.execute('SELECT id FROM todos WHERE user_id = ? ORDER BY id', [userId]),
  ]);
  const noteIds = new Set((notes as Row[]).map((row) => String(row.id)));
  const todoIds = new Set((todos as Row[]).map((row) => String(row.id)));

  for (const id of noteIds) await materializeNote(userId, id);
  for (const id of todoIds) await materializeTodo(userId, id);
  removeStaleSnapshots('notes', noteIds);
  removeStaleSnapshots('todos', todoIds);

  writeIfChanged(path.join(getDataDir(), 'README.json'), {
    schemaVersion: 1,
    description: 'Old Z 自动生成的 Git 快照。notes/ 和 todos/ 中的文件对应本地笔记与待办。',
  });
  return true;
}
