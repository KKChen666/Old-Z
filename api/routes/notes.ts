import { Router, type Response } from 'express';
import pool from '../config/database.js';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { callLLM, safeJsonParse } from '../services/ai.js';
import { getUserLlmConfig } from '../services/settings.js';

const router = Router();
router.use(authMiddleware);

const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'Asia/Shanghai';
const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function appDateString(offsetDays = 0): string {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = DATE_FORMATTER.formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

const NOTE_ASSIST_SYSTEM_PROMPT = `你是 Old Z 的笔记写作助手。你帮助用户在写笔记时整理思路、改写文字、续写内容、提取行动项。

输出规则：
- 只输出可以直接放进笔记里的 Markdown 内容。
- 不要解释你做了什么，不要加“以下是”之类的引导语。
- 保持用户原本的语言和语气，默认使用中文。
- 如果用户提供了选中文本，优先处理选中文本；否则处理整篇笔记。
- 内容要具体、有结构，但不要凭空编造事实。`;

const NOTE_INTENT_SYSTEM_PROMPT = `You classify user input inside a note editor.
Return strict JSON only.

Intent types:
- function: deterministic editor API calls, such as insert divider, bold selected text, insert table, insert todo.
- ask: the user is asking a question or chatting. Default to ask when uncertain. Ask must not modify the document by default.
- edit: AI edits or writes against the current document/selection, such as summarize, continue writing, polish, translate, compress.
- document: structural document operations, such as delete empty lines, change heading levels, sort blocks, delete all.
- workflow: complex multi-step agent tasks, such as write a PRD and generate todos.
- mixed: one request contains multiple intents/actions, such as summarize then append, translate then insert table.

Supported tools: divider, deleteAll, boldSelection, insertTable.
Dangerous operations such as deleteAll must use type "document" and risk "confirm".

Return:
{
  "type": "function" | "ask" | "edit" | "document" | "workflow" | "mixed",
  "tool": "divider" | "deleteAll" | "boldSelection" | "insertTable" | null,
  "operation": "deleteAll" | "removeEmptyLines" | "headingLevel" | "sort" | null,
  "risk": "safe" | "confirm",
  "mode": "summarize" | "continue" | "translate" | "polish" | "custom" | null,
  "rows": number | null,
  "cols": number | null,
  "steps": [] | null,
  "reason": "short reason"
}`;

function buildNoteAssistPrompt(params: {
  mode: string;
  instruction?: string;
  title?: string;
  content?: string;
  selection?: string;
}): string {
  const modeText: Record<string, string> = {
    polish: '润色文字，提升清晰度和表达质量，保留原意。',
    continue: '基于已有内容继续写，补全自然的下一段或下一节。',
    summarize: '总结重点，形成简洁结构化摘要。',
    actions: '从内容中提取可执行行动项，使用 Markdown 任务列表。',
    chat: params.instruction || '回答用户关于这篇笔记的问题；不要改写笔记正文。',
    custom: params.instruction || '按用户要求处理这篇笔记。',
  };

  return [
    `任务：${modeText[params.mode] || modeText.custom}`,
    params.instruction ? `用户补充要求：${params.instruction}` : '',
    `笔记标题：${params.title || '未命名笔记'}`,
    params.selection ? `\n选中文本：\n${params.selection}` : '',
    `\n笔记全文：\n${params.content || '（空）'}`,
  ].filter(Boolean).join('\n\n');
}

function buildNoteIntentPrompt(params: {
  instruction: string;
  hasSelection?: boolean;
  title?: string;
  contentPreview?: string;
}): string {
  return [
    `User input: ${params.instruction}`,
    `Has selection: ${params.hasSelection ? 'yes' : 'no'}`,
    `Note title: ${params.title || 'Untitled'}`,
    params.contentPreview ? `Note preview:\n${params.contentPreview}` : '',
  ].filter(Boolean).join('\n\n');
}

function normalizeNoteIntent(raw: any) {
  const type = ['function', 'ask', 'edit', 'document', 'workflow', 'mixed', 'tool', 'command'].includes(raw?.type) ? raw.type : 'ask';
  const tool = ['divider', 'deleteAll', 'boldSelection', 'insertTable'].includes(raw?.tool) ? raw.tool : null;
  const operation = ['deleteAll', 'removeEmptyLines', 'headingLevel', 'sort'].includes(raw?.operation) ? raw.operation : null;
  const mode = ['summarize', 'continue', 'translate', 'polish', 'custom'].includes(raw?.mode) ? raw.mode : null;
  const rows = Number.isFinite(Number(raw?.rows)) ? Math.min(Math.max(Number(raw.rows), 1), 12) : null;
  const cols = Number.isFinite(Number(raw?.cols)) ? Math.min(Math.max(Number(raw.cols), 1), 8) : null;

  if ((type === 'document' || tool === 'deleteAll' || operation === 'deleteAll') && (tool === 'deleteAll' || operation === 'deleteAll')) {
    return {
      type: 'document',
      tool: null,
      operation: 'deleteAll',
      risk: 'confirm',
      mode: null,
      rows: null,
      cols: null,
      steps: null,
      reason: typeof raw?.reason === 'string' ? raw.reason.slice(0, 200) : '',
    };
  }
  if ((type === 'function' || type === 'tool') && tool && tool !== 'deleteAll') {
    return {
      type: 'function',
      tool,
      operation: null,
      risk: 'safe',
      mode: null,
      rows: tool === 'insertTable' ? rows || 3 : null,
      cols: tool === 'insertTable' ? cols || 3 : null,
      steps: null,
      reason: typeof raw?.reason === 'string' ? raw.reason.slice(0, 200) : '',
    };
  }
  if (type === 'edit' || type === 'command') {
    return {
      type: 'edit',
      tool: null,
      operation: null,
      risk: 'safe',
      mode: mode || 'custom',
      rows: null,
      cols: null,
      steps: null,
      reason: typeof raw?.reason === 'string' ? raw.reason.slice(0, 200) : '',
    };
  }
  if (type === 'workflow') {
    return {
      type: 'workflow',
      tool: null,
      operation: null,
      risk: 'safe',
      mode: null,
      rows: null,
      cols: null,
      steps: null,
      goal: typeof raw?.goal === 'string' ? raw.goal.slice(0, 500) : '',
      reason: typeof raw?.reason === 'string' ? raw.reason.slice(0, 200) : '',
    };
  }
  if (type === 'mixed') {
    return {
      type: 'mixed',
      tool: null,
      operation: null,
      risk: raw?.risk === 'confirm' ? 'confirm' : 'safe',
      mode: null,
      rows: null,
      cols: null,
      steps: Array.isArray(raw?.steps) ? raw.steps.slice(0, 6) : [],
      reason: typeof raw?.reason === 'string' ? raw.reason.slice(0, 200) : '',
    };
  }
  return {
    type: 'ask',
    tool: null,
    operation: null,
    risk: 'safe',
    mode: null,
    rows: null,
    cols: null,
    steps: null,
    reason: typeof raw?.reason === 'string' ? raw.reason.slice(0, 200) : '',
  };
}

function snapshotId(): string {
  return `ns-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function saveNoteSnapshot(userId: string, noteId: string, title: string, content: string) {
  const snapshotDate = appDateString();
  await pool.execute(
    `INSERT INTO note_snapshots (id, note_id, user_id, title, content, snapshot_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       content = VALUES(content),
       created_at = VALUES(created_at)`,
    [snapshotId(), noteId, userId, title, content || '', snapshotDate, new Date()]
  );
  await cleanupOldNoteSnapshots(userId);
}

async function cleanupOldNoteSnapshots(userId: string) {
  await pool.execute(
    'DELETE FROM note_snapshots WHERE user_id = ? AND snapshot_date < ?',
    [userId, appDateString(-6)]
  );
}

function splitBlocks(content: string): string[] {
  return content
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function diffBlocks(previousContent: string, currentContent: string) {
  const previous = splitBlocks(previousContent);
  const current = splitBlocks(currentContent);
  const rows = previous.length;
  const cols = current.length;
  const dp = Array.from({ length: rows + 1 }, () => Array(cols + 1).fill(0));

  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      dp[i][j] = previous[i] === current[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const added: string[] = [];
  const removed: string[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (previous[i] === current[j]) {
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      removed.push(previous[i]);
      i++;
    } else {
      added.push(current[j]);
      j++;
    }
  }
  while (i < rows) removed.push(previous[i++]);
  while (j < cols) added.push(current[j++]);

  return { added, removed };
}

// 获取所有笔记
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const [notes] = await pool.execute('SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC', [req.userId!]);
    const [tags] = await pool.execute('SELECT nt.* FROM note_tags nt JOIN notes n ON nt.note_id = n.id WHERE n.user_id = ?', [req.userId!]);
    const [noteFiles] = await pool.execute('SELECT nf.* FROM note_files nf JOIN notes n ON nf.note_id = n.id WHERE n.user_id = ?', [req.userId!]);
    const [noteTodos] = await pool.execute('SELECT ntd.* FROM note_todos ntd JOIN notes n ON ntd.note_id = n.id WHERE n.user_id = ?', [req.userId!]);

    const tagMap = new Map<string, string[]>();
    (tags as any[]).forEach((t) => {
      if (!tagMap.has(t.note_id)) tagMap.set(t.note_id, []);
      tagMap.get(t.note_id)!.push(t.tag);
    });

    const fileMap = new Map<string, string[]>();
    (noteFiles as any[]).forEach((f) => {
      if (!fileMap.has(f.note_id)) fileMap.set(f.note_id, []);
      fileMap.get(f.note_id)!.push(f.file_id);
    });

    const todoMap = new Map<string, string[]>();
    (noteTodos as any[]).forEach((t) => {
      if (!todoMap.has(t.note_id)) todoMap.set(t.note_id, []);
      todoMap.get(t.note_id)!.push(t.todo_id);
    });

    const result = (notes as any[]).map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      tags: tagMap.get(n.id) || [],
      linkedFileIds: fileMap.get(n.id) || [],
      linkedTodoIds: todoMap.get(n.id) || [],
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('GET /notes error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notes' });
  }
});

// 创建笔记
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { id, title, content, tags } = req.body;

    if (!title || typeof title !== 'string' || title.length > 500) {
      res.status(400).json({ success: false, error: '标题无效或过长' });
      return;
    }

    const now = new Date();

    await pool.execute(
      'INSERT INTO notes (id, title, content, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [id, title, content || '', now, now, req.userId!]
    );
    await saveNoteSnapshot(req.userId!, id, title, content || '');

    if (tags && tags.length > 0) {
      for (const tag of tags) {
        await pool.execute('INSERT IGNORE INTO note_tags (note_id, tag) VALUES (?, ?)', [id, tag]);
      }
    }

    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('POST /notes error:', error);
    res.status(500).json({ success: false, error: 'Failed to create note' });
  }
});

router.post('/intent', async (req: AuthRequest, res: Response) => {
  try {
    const { instruction, hasSelection, title, contentPreview } = req.body;
    if (!instruction || typeof instruction !== 'string') {
      res.status(400).json({ success: false, error: '请输入 AI 指令' });
      return;
    }

    const llmConfig = await getUserLlmConfig(req.userId!);
    if (!llmConfig) {
      res.json({ success: true, data: { type: 'ask', tool: null, risk: 'safe', mode: null, rows: null, cols: null, reason: 'No LLM config; default to safe ask.' } });
      return;
    }

    const result = await callLLM(
      llmConfig,
      NOTE_INTENT_SYSTEM_PROMPT,
      buildNoteIntentPrompt({
        instruction: instruction.slice(0, 1000),
        hasSelection: Boolean(hasSelection),
        title: typeof title === 'string' ? title.slice(0, 500) : '',
        contentPreview: typeof contentPreview === 'string' ? contentPreview.slice(0, 4000) : '',
      }),
      { temperature: 0, maxTokens: 500, jsonMode: true, timeoutMs: 15000 }
    );
    res.json({ success: true, data: normalizeNoteIntent(safeJsonParse(result)) });
  } catch (error: any) {
    console.error('POST /notes/intent error:', error);
    res.json({ success: true, data: { type: 'ask', tool: null, risk: 'safe', mode: null, rows: null, cols: null, reason: 'Classifier failed; default to safe ask.' } });
  }
});

router.post('/assist', async (req: AuthRequest, res: Response) => {
  try {
    const { mode, instruction, title, content, selection } = req.body;
    const allowedModes = ['polish', 'continue', 'summarize', 'actions', 'custom', 'chat'];

    if (!mode || !allowedModes.includes(mode)) {
      res.status(400).json({ success: false, error: '无效的 AI 辅助模式' });
      return;
    }
    if ((mode === 'custom' || mode === 'chat') && (!instruction || typeof instruction !== 'string')) {
      res.status(400).json({ success: false, error: '请输入 AI 指令' });
      return;
    }

    const llmConfig = await getUserLlmConfig(req.userId!);
    if (!llmConfig) {
      res.status(400).json({ success: false, error: '请先在设置中配置 AI 接口' });
      return;
    }

    const userMessage = buildNoteAssistPrompt({
      mode,
      instruction: typeof instruction === 'string' ? instruction.slice(0, 2000) : '',
      title: typeof title === 'string' ? title.slice(0, 500) : '',
      content: typeof content === 'string' ? content.slice(0, 30000) : '',
      selection: typeof selection === 'string' ? selection.slice(0, 10000) : '',
    });

    const result = await callLLM(llmConfig, NOTE_ASSIST_SYSTEM_PROMPT, userMessage, {
      temperature: mode === 'continue' ? 0.7 : 0.3,
      maxTokens: 2500,
      timeoutMs: 30000,
    });

    res.json({ success: true, data: { content: result.trim() } });
  } catch (error: any) {
    console.error('POST /notes/assist error:', error);
    res.status(500).json({ success: false, error: error.message || 'AI 笔记助手调用失败' });
  }
});

router.get('/changes', async (req: AuthRequest, res: Response) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ success: false, error: '日期格式无效' });
      return;
    }

    const [snapshots] = await pool.execute(
      `SELECT *
       FROM note_snapshots
       WHERE user_id = ? AND snapshot_date = ?
       ORDER BY created_at ASC`,
      [req.userId!, date]
    );

    const changes = [];
    for (const snapshot of snapshots as any[]) {
      const [previousRows] = await pool.execute(
        `SELECT *
         FROM note_snapshots
         WHERE user_id = ? AND note_id = ? AND snapshot_date < ?
         ORDER BY snapshot_date DESC, created_at DESC
         LIMIT 1`,
        [req.userId!, snapshot.note_id, snapshot.snapshot_date]
      );
      const previous = (previousRows as any[])[0];
      const diff = diffBlocks(previous?.content || '', snapshot.content || '');
      const titleChanged = previous && previous.title !== snapshot.title;
      if (!previous || titleChanged || diff.added.length > 0 || diff.removed.length > 0) {
        changes.push({
          noteId: snapshot.note_id,
          title: snapshot.title,
          previousTitle: previous?.title || null,
          changedAt: snapshot.created_at,
          isNew: !previous,
          added: diff.added,
          removed: diff.removed,
        });
      }
    }

    res.json({ success: true, data: changes });
  } catch (error) {
    console.error('GET /notes/changes error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch note changes' });
  }
});

router.get('/:id/snapshots', async (req: AuthRequest, res: Response) => {
  try {
    await cleanupOldNoteSnapshots(req.userId!);
    const [snapshots] = await pool.execute(
      `SELECT id, note_id, title, content, snapshot_date, created_at
       FROM note_snapshots
       WHERE user_id = ? AND note_id = ? AND snapshot_date >= ?
       ORDER BY snapshot_date DESC, created_at DESC
       LIMIT 7`,
      [req.userId!, req.params.id, appDateString(-6)]
    );

    res.json({
      success: true,
      data: (snapshots as any[]).map((snapshot) => ({
        id: snapshot.id,
        noteId: snapshot.note_id,
        title: snapshot.title,
        content: snapshot.content,
        snapshotDate: snapshot.snapshot_date,
        createdAt: snapshot.created_at,
      })),
    });
  } catch (error) {
    console.error('GET /notes/:id/snapshots error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch note snapshots' });
  }
});

router.post('/:id/restore', async (req: AuthRequest, res: Response) => {
  try {
    const { snapshotId: restoreSnapshotId } = req.body;
    if (!restoreSnapshotId || typeof restoreSnapshotId !== 'string') {
      res.status(400).json({ success: false, error: '缺少快照 ID' });
      return;
    }

    const [snapshots] = await pool.execute(
      `SELECT id, note_id, title, content
       FROM note_snapshots
       WHERE id = ? AND note_id = ? AND user_id = ? AND snapshot_date >= ?
       LIMIT 1`,
      [restoreSnapshotId, req.params.id, req.userId!, appDateString(-6)]
    );
    const snapshot = (snapshots as any[])[0];
    if (!snapshot) {
      res.status(404).json({ success: false, error: '快照不存在或已超过保留期限' });
      return;
    }

    const now = new Date();
    await pool.execute(
      'UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [snapshot.title, snapshot.content, now, req.params.id, req.userId!]
    );

    res.json({
      success: true,
      data: {
        id: req.params.id,
        title: snapshot.title,
        content: snapshot.content,
        updatedAt: now,
      },
    });
  } catch (error) {
    console.error('POST /notes/:id/restore error:', error);
    res.status(500).json({ success: false, error: 'Failed to restore note snapshot' });
  }
});

// 更新笔记
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { title, content } = req.body;
    const fields: string[] = [];
    const values: any[] = [];

    const [existingRows] = await pool.execute(
      'SELECT id, title, content FROM notes WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId!]
    );
    const existing = (existingRows as any[])[0];
    if (!existing) {
      res.status(404).json({ success: false, error: '笔记不存在' });
      return;
    }

    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (content !== undefined) { fields.push('content = ?'); values.push(content); }

    if (fields.length > 0) {
      values.push(req.params.id, req.userId!);
      await pool.execute(`UPDATE notes SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);
      const nextTitle = title !== undefined ? title : existing.title;
      const nextContent = content !== undefined ? content : existing.content;
      if (nextTitle !== existing.title || nextContent !== existing.content) {
        await saveNoteSnapshot(req.userId!, req.params.id, nextTitle, nextContent);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('PATCH /notes error:', error);
    res.status(500).json({ success: false, error: 'Failed to update note' });
  }
});

// 删除笔记
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM note_snapshots WHERE note_id = ? AND user_id = ?', [req.params.id, req.userId!]);
    const [result] = await conn.execute('DELETE FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.userId!]) as any;
    if (result.affectedRows === 0) {
      await conn.rollback();
      res.status(404).json({ success: false, error: '笔记不存在' });
      return;
    }
    await conn.commit();
    res.json({ success: true });
  } catch (error) {
    await conn.rollback();
    console.error('DELETE /notes error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete note' });
  } finally {
    conn.release();
  }
});

export default router;
