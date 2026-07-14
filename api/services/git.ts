/**
 * 真实 Git 版本控制服务（基于 simple-git）。
 *
 * Git 仓库位于 data/ 目录（与 SQLite 数据库同级），
 * 可通过 OLDZ_DATA_DIR 环境变量自定义。
 *
 * 功能：
 *   - 自动初始化仓库 + .gitignore（排除 *.db 二进制文件）
 *   - git status / log / diff / show
 *   - git commit（自动 stage 所有变更）
 *   - git remote add / remove / list
 *   - git push / pull
 *   - git branch
 */

import simpleGit, { type SimpleGit, type LogResult, type StatusResult, type DiffResult } from 'simple-git';
import path from 'path';
import fs from 'fs';

// ---- 解析 data 目录 ----

function getDataDir(): string {
  if (process.env.OLDZ_DATA_DIR) {
    return process.env.OLDZ_DATA_DIR;
  }
  return path.resolve(process.cwd(), 'data');
}

const DATA_DIR = getDataDir();

// ---- 单例 simple-git 实例 ----

let _git: SimpleGit | null = null;
let _repoReady = false;

function git(): SimpleGit {
  if (!_git) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    _git = simpleGit(DATA_DIR);
  }
  return _git;
}

// ---- ensureRepo ----

export async function ensureRepo(): Promise<{ initialized: boolean; path: string }> {
  const g = git();
  const gitDir = path.join(DATA_DIR, '.git');

  if (fs.existsSync(gitDir)) {
    _repoReady = true;
    return { initialized: false, path: DATA_DIR };
  }

  await g.init();
  _repoReady = true;

  // 创建 .gitignore
  const gitignorePath = path.join(DATA_DIR, '.gitignore');
  const gitignoreContent = [
    '# Old Z — Git 版本控制忽略规则',
    '# SQLite 数据库（二进制文件，不适合 git diff）',
    '*.db',
    '*.db-journal',
    '*.db-wal',
    '*.db-shm',
    '*.db.tmp',
    '# 临时文件',
    '*.tmp',
    '.DS_Store',
    'Thumbs.db',
  ].join('\n') + '\n';

  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, gitignoreContent, 'utf-8');
  }

  // 初始 commit（空提交，建立 main 分支）
  await g.add('.gitignore');
  await g.commit('initial commit — Old Z git repository').catch(() => {
    // 如果 .gitignore 没有变更（已存在），跳过
  });

  console.log('[Git] Repository initialized at:', DATA_DIR);
  return { initialized: true, path: DATA_DIR };
}

// ---- getInfo ----

export async function getInfo(): Promise<{
  initialized: boolean;
  path: string;
  branch: string;
  remotes: string[];
}> {
  const gitDir = path.join(DATA_DIR, '.git');
  if (!fs.existsSync(gitDir)) {
    return { initialized: false, path: DATA_DIR, branch: '', remotes: [] };
  }

  const g = git();
  let branch = '';
  try {
    branch = (await g.branch()).current;
  } catch {}

  let remotes: string[] = [];
  try {
    const r = await g.getRemotes(true);
    remotes = r.map((item) => item.name);
  } catch {}

  return { initialized: true, path: DATA_DIR, branch, remotes };
}

// ---- getStatus ----

export interface GitStatusInfo {
  staged: string[];      // 已暂存的文件
  modified: string[];    // 已修改（未暂存）
  created: string[];     // 新文件（未跟踪）
  deleted: string[];     // 已删除
  renamed: Array<{ from: string; to: string }>;
  isClean: boolean;
}

export async function getStatus(): Promise<GitStatusInfo> {
  await ensureRepo();
  const g = git();
  const status: StatusResult = await g.status();

  return {
    staged: status.staged,
    modified: status.modified,
    created: status.not_added.concat(status.created),
    deleted: status.deleted,
    renamed: (status.renamed || []).map((r) => ({ from: r.from, to: r.to })),
    isClean: status.isClean(),
  };
}

// ---- getLog ----

export interface GitCommitEntry {
  hash: string;
  shortHash: string;
  date: string;
  message: string;
  authorName: string;
  authorEmail: string;
  refs: string; // e.g. "HEAD -> main"
}

export async function getLog(options?: {
  maxCount?: number;
  file?: string;
}): Promise<GitCommitEntry[]> {
  await ensureRepo();
  const g = git();

  const logOptions: Record<string, any> = {
    maxCount: options?.maxCount ?? 50,
  };
  if (options?.file) {
    (logOptions as any).file = options.file;
  }

  const log: LogResult = await g.log(logOptions);

  return log.all.map((entry) => ({
    hash: entry.hash,
    shortHash: entry.hash.slice(0, 7),
    date: entry.date,
    message: entry.message,
    authorName: entry.author_name,
    authorEmail: entry.author_email,
    refs: entry.refs,
  }));
}

// ---- getDiff ----

export async function getDiff(hash: string): Promise<{
  hash: string;
  message: string;
  date: string;
  authorName: string;
  diff: string; // 完整的 git show 输出
}> {
  await ensureRepo();
  const g = git();

  // git show --stat --patch <hash>
  const showOutput = await g.show([hash, '--stat', '--patch', '--format=fuller']);

  // 也获取 commit 基本信息
  const log = await g.log({ maxCount: 1, from: hash, to: hash });
  const entry = log.latest;

  return {
    hash,
    message: entry?.message || '',
    date: entry?.date || '',
    authorName: entry?.author_name || '',
    diff: showOutput,
  };
}

// ---- commit ----

export async function commit(message: string): Promise<{
  hash: string;
  summary: { insertions: number; deletions: number; files: number };
}> {
  await ensureRepo();
  const g = git();

  // 检查是否有变更
  const status = await g.status();
  if (status.isClean()) {
    throw new Error('没有需要提交的变更');
  }

  // 添加所有变更
  await g.add('.');

  // 提交
  const result = await g.commit(message);

  return {
    hash: result.commit || '',
    summary: {
      insertions: result.summary?.insertions ?? 0,
      deletions: result.summary?.deletions ?? 0,
      files: result.summary?.changes ?? 0,
    },
  };
}

// ---- remotes ----

export interface GitRemote {
  name: string;
  fetch: string;
  push: string;
}

export async function getRemotes(): Promise<GitRemote[]> {
  await ensureRepo();
  const g = git();
  const remotes = await g.getRemotes(true);
  return remotes.map((r) => ({
    name: r.name,
    fetch: r.refs.fetch || '',
    push: r.refs.push || '',
  }));
}

export async function addRemote(name: string, url: string): Promise<void> {
  await ensureRepo();
  const g = git();

  // 检查是否已存在
  const remotes = await g.getRemotes(true);
  const existing = remotes.find((r) => r.name === name);
  if (existing) {
    // 更新已有 remote
    await g.remote(['set-url', name, url]);
  } else {
    await g.addRemote(name, url);
  }
}

export async function removeRemote(name: string): Promise<void> {
  await ensureRepo();
  const g = git();
  await g.removeRemote(name);
}

// ---- push / pull ----

export async function push(
  remote: string,
  branch: string
): Promise<{ pushed: boolean; result: string }> {
  await ensureRepo();
  const g = git();

  try {
    const result = await g.push(remote, branch);
    const pushed = result.pushed && result.pushed.length > 0;
    return {
      pushed,
      result: pushed
        ? `已推送 ${result.pushed.length} 个引用到 ${remote}/${branch}`
        : '已是最新，无需推送',
    };
  } catch (e: any) {
    throw new Error(`推送失败：${e?.message || e}`);
  }
}

export async function pull(
  remote: string,
  branch: string
): Promise<{ pulled: boolean; result: string; mergeSummary?: any }> {
  await ensureRepo();
  const g = git();

  try {
    const result = await g.pull(remote, branch);
    const pulled = result.files && result.files.length > 0;
    return {
      pulled,
      result: pulled
        ? `已从 ${remote}/${branch} 拉取 ${result.files.length} 个文件变更`
        : '已是最新，无需拉取',
      mergeSummary: result.summary,
    };
  } catch (e: any) {
    throw new Error(`拉取失败：${e?.message || e}`);
  }
}

// ---- branches ----

export interface GitBranchInfo {
  name: string;
  current: boolean;
}

export async function getBranches(): Promise<GitBranchInfo[]> {
  await ensureRepo();
  const g = git();
  const result = await g.branch();
  return Object.entries(result.branches).map(([name, info]) => ({
    name,
    current: info.current,
  }));
}

// ---- 便捷方法：自动提交（用于笔记/待办变更时调用）----

let autoCommitTimer: ReturnType<typeof setTimeout> | null = null;
let pendingCommitMessages: string[] = [];

/**
 * 延迟批量提交。
 * 短时间内多次调用会合并为一次 commit，避免产生过多琐碎提交。
 * 延迟 2 秒，等待同一批操作完成后一起提交。
 */
export function scheduleAutoCommit(message: string): void {
  pendingCommitMessages.push(message);

  if (autoCommitTimer) {
    clearTimeout(autoCommitTimer);
  }

  autoCommitTimer = setTimeout(async () => {
    autoCommitTimer = null;
    const messages = [...pendingCommitMessages];
    pendingCommitMessages = [];

    const commitMessage = messages.length === 1
      ? messages[0]
      : `${messages.length} 项变更:\n${messages.map((m) => `  - ${m}`).join('\n')}`;

    try {
      await ensureRepo();
      await commit(commitMessage);
      console.log('[Git] Auto-commit:', commitMessage.split('\n')[0]);
    } catch (e: any) {
      // 没有变更时忽略
      if (!e.message?.includes('没有需要提交的变更')) {
        console.error('[Git] Auto-commit failed:', e?.message || e);
      }
    }
  }, 2000);
}
