import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type FileType = 'document' | 'image' | 'pdf' | 'link' | 'email' | 'other';

export function getFileType(name: string): FileType {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx', 'txt', 'md', 'xlsx', 'xls', 'ppt', 'pptx'].includes(ext)) return 'document';
  return 'other';
}

/** 强制将 HTTP URL 升级为 HTTPS，避免 Mixed Content 拦截 */
export function ensureHttps(url: string): string {
  return url.replace(/^http:\/\//, 'https://');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/** 日期标签：今天 / 明天 / 昨天 / 已过期 X 天 / X 天后 / 月日 */
export function getDateLabel(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr + 'T00:00:00');
  date.setHours(0, 0, 0, 0);
  const diff = Math.floor((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === -1) return '昨天';
  if (diff < -1) return `已过期 ${Math.abs(diff)} 天`;
  if (diff <= 7) return `${diff} 天后`;
  return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

/** 待办是否已过期 */
export function isOverdue(todo: { dueDate?: string; status: string }): boolean {
  if (!todo.dueDate || todo.status === 'completed') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(todo.dueDate + 'T00:00:00');
  due.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}
