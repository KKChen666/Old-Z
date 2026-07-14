/**
 * 自动报告生成服务。
 *
 * 从 SpringNote startup_report_generation_service.dart 移植，
 * 使用 SpringNote ai.rs 中的系统提示词。
 *
 * 逻辑链：
 *   每日笔记/日报 → AI 汇总 → 周报 → AI 汇总 → 月报
 *
 * 在应用启动时被触发（延迟 5 秒，避免阻塞启动）。
 * 也支持手动触发（POST /api/reports/generate）。
 */

import db from '../config/db.js';
import { getUserLlmConfig } from './settings.js';
import { callLLM } from './ai.js';

// ---- 从 SpringNote ai.rs 移植的系统提示词 ----

const WEEKLY_REPORT_SYSTEM_PROMPT = `你是 Old Z 的周报整理助手。请基于一周日报 Markdown 生成一篇自然、有重点、可直接编辑的周报。
写作原则：
1. 保留来源中的事实，不编造没有依据的成果、风险或计划。
2. 不需要固定套用"主要工作 / 关键进展 / 问题 / 下周计划"等模板，可以根据材料自由组织结构。
3. Markdown 要层次清楚、阅读舒服；可以使用标题、段落、列表、重点小结，但避免机械堆栏目。
4. 优先呈现这一周真正发生了什么、推进到了哪里、遇到什么卡点、接下来怎么走。
5. 语气自然，像一个认真复盘工作的人的周报，不要像 AI 模板。
6. 只输出最终 Markdown，不要解释。`;

const MONTHLY_REPORT_SYSTEM_PROMPT = `你是 Old Z 的月报整理助手。请基于月度周报 Markdown 生成一篇自然、有复盘感、可继续编辑的月报。
写作原则：
1. 保留来源中的事实，不编造成果、数据、评价或计划。
2. 不需要固定套用"核心成果 / 项目进展 / 问题复盘 / 个人成长 / 下月计划"等模板，可以根据材料自由组织结构。
3. Markdown 要美观、有呼吸感；可以使用标题、短段落、列表、总结和展望，但不要写成僵硬表格。
4. 重点体现这个月的主线、阶段性变化、值得保留的经验、还没解决的问题和自然的下一步。
5. 语气克制、真诚、有人的表达，不要过度包装，也不要像 AI 汇报模板。
6. 只输出最终 Markdown，不要解释。`;

// ---- 类型 ----

export interface GeneratedReport {
  kind: 'weekly' | 'monthly';
  reportDate: string; // YYYY-MM-DD 或 YYYY-Www 或 YYYY-MM
  content: string;
}

// ---- 主入口 ----

/**
 * 检查并生成缺失的报告。
 * 在应用启动时被调用。
 */
export async function generateMissingReports(userId: string): Promise<GeneratedReport[]> {
  const generated: GeneratedReport[] = [];

  // 1. 生成缺失的周报
  const weeklyReports = await generateMissingWeeklyReports(userId);
  generated.push(...weeklyReports);

  // 2. 基于新生成的周报，生成缺失的月报
  const monthlyReports = await generateMissingMonthlyReports(userId);
  generated.push(...monthlyReports);

  if (generated.length > 0) {
    console.log(`[ReportGen] Generated ${generated.length} reports for user ${userId}`);
  }

  return generated;
}

// ---- 周报生成 ----

async function generateMissingWeeklyReports(userId: string): Promise<GeneratedReport[]> {
  const generated: GeneratedReport[] = [];

  // 查找有日报但无周报的过去周
  const weeks = await findCompletedWeeksWithNotes(userId);
  if (weeks.length === 0) return generated;

  for (const week of weeks) {
    const existingReport = await getExistingWeeklyReport(userId, week.year, week.weekNum);
    if (existingReport) continue;

    const noteContent = await aggregateDailyNotesForWeek(userId, week);
    if (!noteContent.trim()) continue;

    const llmConfig = await getUserLlmConfig(userId);
    if (!llmConfig) {
      console.warn('[ReportGen] No LLM config, skipping weekly report generation');
      break;
    }

    const periodLabel = `${week.year}-W${String(week.weekNum).padStart(2, '0')}（${week.startDate} 至 ${week.endDate}）`;
    const userPrompt = `周期：${periodLabel}\n\n原始日报内容：\n${noteContent}`;

    try {
      const markdown = await callLLM(llmConfig, WEEKLY_REPORT_SYSTEM_PROMPT, userPrompt, {
        temperature: 0.4,
        maxTokens: 4096,
        timeoutMs: 60000,
      });

      if (markdown) {
        // 保存到 daily_reports 表
        const reportDate = `${week.year}-W${String(week.weekNum).padStart(2, '0')}`;
        const id = `wr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await db.execute(
          `INSERT OR REPLACE INTO daily_reports (id, user_id, report_date, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [id, userId, reportDate, markdown]
        );

        generated.push({ kind: 'weekly', reportDate, content: markdown });
        console.log(`[ReportGen] Generated weekly report: ${reportDate}`);
      }
    } catch (e: any) {
      console.error(`[ReportGen] Failed to generate weekly report for ${periodLabel}:`, e?.message || e);
    }
  }

  return generated;
}

// ---- 月报生成 ----

async function generateMissingMonthlyReports(userId: string): Promise<GeneratedReport[]> {
  const generated: GeneratedReport[] = [];

  const months = await findCompletedMonthsWithWeeklyReports(userId);
  if (months.length === 0) return generated;

  for (const month of months) {
    const reportDate = `${month.year}-${String(month.month).padStart(2, '0')}`;
    const existingReport = await getExistingMonthlyReport(userId, reportDate);
    if (existingReport) continue;

    const reportContent = await aggregateWeeklyReportsForMonth(userId, month);
    if (!reportContent.trim()) continue;

    const llmConfig = await getUserLlmConfig(userId);
    if (!llmConfig) {
      console.warn('[ReportGen] No LLM config, skipping monthly report generation');
      break;
    }

    const periodLabel = `${reportDate} 月报`;
    const userPrompt = `周期：${periodLabel}\n\n原始周报内容：\n${reportContent}`;

    try {
      const markdown = await callLLM(llmConfig, MONTHLY_REPORT_SYSTEM_PROMPT, userPrompt, {
        temperature: 0.4,
        maxTokens: 4096,
        timeoutMs: 60000,
      });

      if (markdown) {
        const id = `mr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await db.execute(
          `INSERT OR REPLACE INTO daily_reports (id, user_id, report_date, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [id, userId, reportDate, markdown]
        );

        generated.push({ kind: 'monthly', reportDate, content: markdown });
        console.log(`[ReportGen] Generated monthly report: ${reportDate}`);
      }
    } catch (e: any) {
      console.error(`[ReportGen] Failed to generate monthly report for ${reportDate}:`, e?.message || e);
    }
  }

  return generated;
}

// ---- 辅助函数 ----

interface WeekInfo {
  year: number;
  weekNum: number;
  startDate: string;
  endDate: string;
}

interface MonthInfo {
  year: number;
  month: number;
}

/**
 * 查找已有每日报告但缺少周报的过去周。
 * 按 ISO 周划分，不包括当前周。
 */
async function findCompletedWeeksWithNotes(userId: string): Promise<WeekInfo[]> {
  const [rows] = await db.execute(
    `SELECT DISTINCT report_date FROM daily_reports
     WHERE user_id = ? AND report_date LIKE '____-__-__'
     ORDER BY report_date ASC`,
    [userId]
  );
  const dates = (rows as any[]).map((r) => r.report_date as string);
  if (dates.length === 0) return [];

  // 同时从 note_snapshots 中查找每日快照
  const [snapshots] = await db.execute(
    `SELECT DISTINCT snapshot_date FROM note_snapshots
     WHERE user_id = ? AND snapshot_date LIKE '____-__-__'
     ORDER BY snapshot_date ASC`,
    [userId]
  );

  const allDates = new Set([
    ...dates,
    ...(snapshots as any[]).map((s) => s.snapshot_date as string),
  ]);

  // 按周分组
  const weekMap = new Map<string, WeekInfo>();
  for (const dateStr of allDates) {
    const d = new Date(dateStr + 'T00:00:00');
    const weekInfo = getISOWeekInfo(d);

    // 排除当前周
    const now = new Date();
    const currentWeek = getISOWeekInfo(now);
    if (weekInfo.year === currentWeek.year && weekInfo.weekNum === currentWeek.weekNum) {
      continue;
    }

    const key = `${weekInfo.year}-W${weekInfo.weekNum}`;
    if (!weekMap.has(key)) {
      weekMap.set(key, weekInfo);
    }
  }

  return Array.from(weekMap.values()).sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.weekNum - b.weekNum
  );
}

/**
 * 查找已有周报但缺少月报的过去月份。
 */
async function findCompletedMonthsWithWeeklyReports(userId: string): Promise<MonthInfo[]> {
  const [rows] = await db.execute(
    `SELECT DISTINCT report_date FROM daily_reports
     WHERE user_id = ? AND report_date LIKE '____-W__'
     ORDER BY report_date ASC`,
    [userId]
  );
  const weeks = (rows as any[]).map((r) => r.report_date as string);
  if (weeks.length === 0) return [];

  // 按月份分组
  const monthSet = new Map<string, MonthInfo>();
  for (const weekLabel of weeks) {
    const parts = weekLabel.split('-W');
    if (parts.length !== 2) continue;
    const year = parseInt(parts[0], 10);
    const weekNum = parseInt(parts[1], 10);

    // 获取该周的第一天来确定月份
    const jan1 = new Date(year, 0, 1);
    const daysOffset = (weekNum - 1) * 7;
    const firstDayOfWeek = new Date(jan1.getTime() + daysOffset * 86400000);
    const month = firstDayOfWeek.getMonth() + 1;

    // 排除当前月
    const now = new Date();
    if (year === now.getFullYear() && month === now.getMonth() + 1) {
      continue;
    }

    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (!monthSet.has(key)) {
      monthSet.set(key, { year, month });
    }
  }

  return Array.from(monthSet.values()).sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month
  );
}

/**
 * 检查周报是否已存在。
 */
async function getExistingWeeklyReport(
  userId: string,
  year: number,
  weekNum: number
): Promise<string | null> {
  const reportDate = `${year}-W${String(weekNum).padStart(2, '0')}`;
  const [rows] = await db.execute(
    'SELECT content FROM daily_reports WHERE user_id = ? AND report_date = ? LIMIT 1',
    [userId, reportDate]
  );
  const row = (rows as any[])[0];
  return row?.content || null;
}

/**
 * 检查月报是否已存在。
 */
async function getExistingMonthlyReport(
  userId: string,
  reportDate: string
): Promise<string | null> {
  const [rows] = await db.execute(
    'SELECT content FROM daily_reports WHERE user_id = ? AND report_date = ? LIMIT 1',
    [userId, reportDate]
  );
  const row = (rows as any[])[0];
  return row?.content || null;
}

/**
 * 聚合一周内的每日报告和快照内容。
 */
async function aggregateDailyNotesForWeek(
  userId: string,
  week: WeekInfo
): Promise<string> {
  const [rows] = await db.execute(
    `SELECT report_date, content FROM daily_reports
     WHERE user_id = ? AND report_date >= ? AND report_date <= ? AND report_date LIKE '____-__-__'
     ORDER BY report_date ASC`,
    [userId, week.startDate, week.endDate]
  );

  return (rows as any[])
    .map((r) => `## ${r.report_date}\n\n${r.content}`)
    .join('\n\n');
}

/**
 * 聚合一个月内的周报内容。
 */
async function aggregateWeeklyReportsForMonth(
  userId: string,
  month: MonthInfo
): Promise<string> {
  // 获取该月第一天和最后一天
  const startDate = `${month.year}-${String(month.month).padStart(2, '0')}-01`;
  const lastDay = new Date(month.year, month.month, 0).getDate();
  const endDate = `${month.year}-${String(month.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // 查找该月内的周报
  const [rows] = await db.execute(
    `SELECT report_date, content FROM daily_reports
     WHERE user_id = ? AND report_date LIKE '____-W__'`,
    [userId]
  );

  // 过滤属于该月的周报
  const monthReports = (rows as any[]).filter((r) => {
    const parts = (r.report_date as string).split('-W');
    if (parts.length !== 2) return false;
    const year = parseInt(parts[0], 10);
    const weekNum = parseInt(parts[1], 10);
    const jan1 = new Date(year, 0, 1);
    const daysOffset = (weekNum - 1) * 7;
    const firstDayOfWeek = new Date(jan1.getTime() + daysOffset * 86400000);
    return (
      firstDayOfWeek.getFullYear() === month.year &&
      firstDayOfWeek.getMonth() + 1 === month.month
    );
  });

  return monthReports
    .map((r) => `## ${r.report_date}\n\n${r.content}`)
    .join('\n\n');
}

/**
 * 获取 ISO 周信息。
 */
function getISOWeekInfo(date: Date): WeekInfo {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = Math.round(((d.getTime() - week1.getTime()) / 86400000 + 1) / 7);

  // 计算该周的起始日期（周一）
  const dayOfWeek = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - dayOfWeek);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    year: d.getFullYear(),
    weekNum,
    startDate: monday.toISOString().slice(0, 10),
    endDate: sunday.toISOString().slice(0, 10),
  };
}
