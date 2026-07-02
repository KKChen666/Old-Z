import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { api } from '@/utils/api';
import {
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Circle,
  FileText,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import type { NoteChange, TimelineEvent, Todo } from '@/types';

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayStr(): string {
  return toDateKey(new Date());
}

function getMonthDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingDays = firstDay.getDay();
  const days: { date: Date; dateKey: string; inMonth: boolean }[] = [];

  for (let i = leadingDays - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    days.push({ date, dateKey: toDateKey(date), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    days.push({ date, dateKey: toDateKey(date), inMonth: true });
  }
  while (days.length % 7 !== 0) {
    const date = new Date(year, month + 1, days.length - leadingDays - daysInMonth + 1);
    days.push({ date, dateKey: toDateKey(date), inMonth: false });
  }
  return days;
}

function eventDateKey(event: TimelineEvent): string {
  return toDateKey(new Date(event.timestamp));
}

function itemDateKey(timestamp?: string): string {
  return timestamp ? toDateKey(new Date(timestamp)) : '';
}

function truncateText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength)}...`;
}

const eventTypeLabels: Record<TimelineEvent['type'], string> = {
  file_upload: '上传文件',
  todo_created: '新建待办',
  todo_completed: '完成待办',
  note_created: '新建笔记',
  note_edited: '编辑笔记',
  chat: 'AI 对话',
  ai_reminder: 'AI 提醒',
};

function describeTodo(todo: Todo): string {
  const status = todo.status === 'completed' ? '已完成' : todo.status === 'in_progress' ? '进行中' : '待处理';
  return `- ${todo.title}（${status}，优先级：${todo.priority}${todo.dueDate ? `，截止：${todo.dueDate}` : ''}）`;
}

function describeNote(note: { title: string; content: string; createdAt: string; updatedAt: string }): string {
  const action = itemDateKey(note.createdAt) === itemDateKey(note.updatedAt) ? '新建' : '更新';
  return `- ${action}《${note.title}》：${truncateText(note.content || '无正文', 500)}`;
}

function describeNoteChange(change: NoteChange): string {
  const titleChange = change.previousTitle && change.previousTitle !== change.title
    ? `（标题从《${change.previousTitle}》改为《${change.title}》）`
    : '';
  const added = change.added.length > 0
    ? `\n  新增：${change.added.map((item) => truncateText(item, 260)).join('；')}`
    : '';
  const removed = change.removed.length > 0
    ? `\n  删除/替换：${change.removed.map((item) => truncateText(item, 180)).join('；')}`
    : '';
  return `- ${change.isNew ? '新建' : '修改'}《${change.title}》${titleChange}${added || '\n  新增：无'}${removed}`;
}

function describeFile(file: { name: string; type: string; size: number; tags: string[] }): string {
  const sizeKb = Math.max(1, Math.round(file.size / 1024));
  const tags = file.tags.length > 0 ? `，标签：${file.tags.join('、')}` : '';
  return `- ${file.name}（${file.type}，${sizeKb} KB${tags}）`;
}

function describeEvent(event: TimelineEvent): string {
  const time = new Date(event.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return `- ${time} ${eventTypeLabels[event.type]}：${event.title}${event.description ? `。${event.description}` : ''}`;
}

function isOverdue(todo: Todo): boolean {
  return !!todo.dueDate && todo.status !== 'completed' && todo.dueDate < todayStr();
}

export default function TimelineCalendar() {
  const { todos, files, notes, timeline, updateTodo } = useAppStore();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dailyReport, setDailyReport] = useState('');
  const [monthlyReport, setMonthlyReport] = useState('');
  const [monthlyReportLabel, setMonthlyReportLabel] = useState('');
  const [reportLoading, setReportLoading] = useState<'daily' | 'monthly' | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [dailyReportSaving, setDailyReportSaving] = useState(false);
  const [noteChanges, setNoteChanges] = useState<NoteChange[]>([]);
  const [noteChangesLoading, setNoteChangesLoading] = useState(false);

  const today = todayStr();
  const calendarDays = getMonthDays(calendarMonth);
  const selectedDateObj = new Date(selectedDate + 'T00:00:00');
  const selectedDateLabel = selectedDateObj.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
  const monthLabel = calendarMonth.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
  const currentMonthKey = today.slice(0, 7);
  const calendarMonthKey = toDateKey(calendarMonth).slice(0, 7);
  const isFutureDate = selectedDate > today;
  const isFutureMonth = calendarMonthKey > currentMonthKey;

  const eventsByDate = timeline.reduce((acc, event) => {
    const dateKey = eventDateKey(event);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, TimelineEvent[]>);
  const todosByDate = todos.reduce((acc, todo) => {
    if (!todo.dueDate) return acc;
    if (!acc[todo.dueDate]) acc[todo.dueDate] = [];
    acc[todo.dueDate].push(todo);
    return acc;
  }, {} as Record<string, Todo[]>);

  const selectedEvents = (eventsByDate[selectedDate] || []).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const selectedTodos = [
    ...(todosByDate[selectedDate] || []),
    ...(selectedDate === today ? todos.filter((todo) => todo.isTodayTodo && todo.dueDate !== today) : []),
  ];
  const selectedNotes = notes
    .filter((note) => itemDateKey(note.createdAt) === selectedDate || itemDateKey(note.updatedAt) === selectedDate)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  const selectedFiles = files
    .filter((file) => itemDateKey(file.createdAt) === selectedDate)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const selectedCreatedTodos = todos
    .filter((todo) => itemDateKey(todo.createdAt) === selectedDate)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const selectedCompletedTodos = selectedTodos.filter((todo) => todo.status === 'completed');
  const selectedActiveTodos = selectedTodos.filter((todo) => todo.status !== 'completed');
  const selectedTodoCompletedEvents = selectedEvents.filter((event) => event.type === 'todo_completed');

  useEffect(() => {
    let cancelled = false;
    setDailyReport('');
    api.getDailyReport(selectedDate)
      .then((report) => {
        if (!cancelled && report?.content) setDailyReport(report.content);
      })
      .catch((error) => {
        console.warn('Daily report fetch error:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  useEffect(() => {
    if (!reportModalOpen) return;
    let cancelled = false;
    setNoteChangesLoading(true);
    api.getNoteChanges(selectedDate)
      .then((changes) => {
        if (!cancelled) setNoteChanges(changes);
      })
      .catch((error) => {
        console.warn('Note changes fetch error:', error);
        if (!cancelled) setNoteChanges([]);
      })
      .finally(() => {
        if (!cancelled) setNoteChangesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportModalOpen, selectedDate]);

  useEffect(() => {
    if (!reportModalOpen) return;
    let blurredWhileOpen = false;

    const handleBlur = () => {
      blurredWhileOpen = true;
    };
    const handleFocus = () => {
      if (blurredWhileOpen) setReportModalOpen(false);
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [reportModalOpen]);

  const cycleTodoStatus = (todo: Todo) => {
    const next: Record<string, Todo['status']> = { pending: 'completed', in_progress: 'completed', completed: 'pending' };
    updateTodo(todo.id, { status: next[todo.status] });
  };

  const generateDailyReport = async () => {
    if (reportLoading || isFutureDate) return;
    setReportLoading('daily');
    setDailyReport('');
    let currentNoteChanges = noteChanges;
    try {
      currentNoteChanges = await api.getNoteChanges(selectedDate);
      setNoteChanges(currentNoteChanges);
    } catch (error) {
      console.warn('Note changes fetch error:', error);
    }
    const prompt = [
      `请根据下面数据生成 ${selectedDateLabel} 的工作日报。`,
      '目标：总结今天真正做了什么，而不是简单复述时间轴。',
      '要求：用中文；优先综合笔记快照变更、待办新增与完成情况、上传文件；时间轴只作为补充证据；不要编造未提供的信息。',
      '结构请包含「今日产出」「笔记沉淀」「待办推进」「文件上传」「风险与明日建议」五部分；没有数据的部分请简短说明暂无。',
      '',
      '今天的笔记快照变更（优先使用，代表同一篇笔记里今天具体新增/删除/替换的内容）：',
      currentNoteChanges.length > 0 ? currentNoteChanges.map(describeNoteChange).join('\n') : '（无快照变更记录）',
      '',
      '快照缺失时的兜底笔记内容（仅代表这些笔记今天被新建或更新过，不代表具体改动段落）：',
      currentNoteChanges.length === 0 && selectedNotes.length > 0 ? selectedNotes.map(describeNote).join('\n') : '（无需使用兜底）',
      '',
      '今天新增的待办：',
      selectedCreatedTodos.length > 0 ? selectedCreatedTodos.map(describeTodo).join('\n') : '（无新增待办）',
      '',
      '今天日期下的待办及当前状态：',
      selectedTodos.length > 0 ? selectedTodos.map(describeTodo).join('\n') : '（无待办）',
      '',
      '今天已完成的待办（根据当前状态和完成事件综合判断）：',
      selectedCompletedTodos.length > 0
        ? selectedCompletedTodos.map(describeTodo).join('\n')
        : selectedTodoCompletedEvents.length > 0
        ? selectedTodoCompletedEvents.map(describeEvent).join('\n')
        : '（无已完成记录）',
      '',
      '今天未完成/仍需推进的待办：',
      selectedActiveTodos.length > 0 ? selectedActiveTodos.map(describeTodo).join('\n') : '（无未完成待办）',
      '',
      '今天上传的文件：',
      selectedFiles.length > 0 ? selectedFiles.map(describeFile).join('\n') : '（无上传文件）',
      '',
      '补充时间轴：',
      selectedEvents.length > 0 ? selectedEvents.map(describeEvent).join('\n') : '（无时间轴记录）',
    ].join('\n');

    try {
      const result = await api.chat.generate(prompt);
      setDailyReport(result.content);
      api.saveDailyReport(selectedDate, result.content).catch((error) => {
        console.warn('Daily report save error:', error);
      });
    } catch (error) {
      console.error('Daily report error:', error);
      setDailyReport('日报生成失败，请确认 AI 接口配置后重试。');
    } finally {
      setReportLoading(null);
    }
  };

  const saveDailyReport = async () => {
    if (!dailyReport.trim() || dailyReportSaving) return;
    setDailyReportSaving(true);
    try {
      await api.saveDailyReport(selectedDate, dailyReport);
    } catch (error) {
      console.error('Daily report save error:', error);
      window.alert('日报保存失败，请稍后重试');
    } finally {
      setDailyReportSaving(false);
    }
  };

  const generateMonthlyReport = async () => {
    if (reportLoading || isFutureMonth) return;
    setReportLoading('monthly');
    setMonthlyReport('');
    setMonthlyReportLabel(monthLabel);
    const monthPrefix = calendarMonthKey;

    try {
      const dailyReports = await api.getMonthlyDailyReports(monthPrefix);
      if (dailyReports.length === 0) {
        setMonthlyReport('这个月还没有已保存的日报。请先生成几天的日报后再生成月报。');
        return;
      }
      const prompt = [
        `请根据下面 ${dailyReports.length} 篇日报生成 ${monthLabel} 的工作月报。`,
        '要求：月报只能基于这些日报总结，不要直接补充日报之外的信息；用中文；包含「本月概览」「关键产出」「节奏与风险」「下月建议」四部分。',
        '',
        '当月全部日报：',
        dailyReports.map((report) => `## ${String(report.date).slice(0, 10)}\n${report.content}`).join('\n\n'),
      ].join('\n');
      const result = await api.chat.generate(prompt);
      setMonthlyReport(result.content);
    } catch (error) {
      console.error('Monthly report error:', error);
      setMonthlyReport('月报生成失败，请确认 AI 接口配置后重试。');
    } finally {
      setReportLoading(null);
    }
  };

  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-gold-400" />
          <div>
            <h2 className="font-serif text-sm sm:text-base font-semibold text-parchment-100">日历</h2>
            <p className="text-xs text-parchment-400">按日期查看做了什么事，以及当天待办事项</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => { setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)); setMonthlyReport(''); }} className="p-2 rounded-lg text-parchment-400 hover:text-parchment-100 hover:bg-ink-800/60 transition-colors" title="上个月">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="min-w-[112px] text-center text-sm font-medium text-parchment-100">{monthLabel}</span>
          <button onClick={() => { setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)); setMonthlyReport(''); }} className="p-2 rounded-lg text-parchment-400 hover:text-parchment-100 hover:bg-ink-800/60 transition-colors" title="下个月">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => { const now = new Date(); setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(today); setDailyReport(''); setMonthlyReport(''); }} className="btn-ghost !px-3 !py-2 !text-xs">
            今天
          </button>
          <button
            onClick={generateMonthlyReport}
            disabled={reportLoading !== null || isFutureMonth}
            className="btn-primary !px-3 !py-2 !text-xs inline-flex items-center gap-1.5 disabled:opacity-60"
            title={isFutureMonth ? '未来月份还不能生成月报' : 'AI 月报'}
          >
            {reportLoading === 'monthly' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            AI 月报
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-4">
        <div>
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
              <div key={day} className="h-7 flex items-center justify-center text-[11px] font-medium text-parchment-400">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((day) => {
              const dayEvents = eventsByDate[day.dateKey] || [];
              const dayTodos = todosByDate[day.dateKey] || [];
              const activeTodos = dayTodos.filter((todo) => todo.status !== 'completed');
              const doneTodos = dayTodos.filter((todo) => todo.status === 'completed');
              const isSelected = day.dateKey === selectedDate;
              const isToday = day.dateKey === today;

              return (
                <button
                  key={day.dateKey}
                  onClick={() => {
                    setSelectedDate(day.dateKey);
                    setReportModalOpen(true);
                  }}
                  className={`min-h-[86px] sm:min-h-[96px] rounded-lg border p-2 text-left transition-all ${
                    isSelected ? 'border-gold-400/60 bg-gold-400/10 shadow-sm shadow-gold-400/10' : 'border-ink-700/30 bg-ink-900/35 hover:border-ink-600 hover:bg-ink-800/40'
                  } ${day.inMonth ? '' : 'opacity-45'}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-xs font-semibold ${isToday ? 'text-gold-300' : 'text-parchment-200'}`}>{day.date.getDate()}</span>
                    {isToday && <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />}
                  </div>
                  <div className="mt-2 space-y-1">
                    {dayEvents.length > 0 && <div className="flex items-center gap-1 text-[10px] text-forest-200"><Sparkles className="w-3 h-3 flex-shrink-0" /><span className="truncate">{dayEvents.length} 条动态</span></div>}
                    {activeTodos.length > 0 && <div className="flex items-center gap-1 text-[10px] text-gold-300"><CheckSquare className="w-3 h-3 flex-shrink-0" /><span className="truncate">{activeTodos.length} 项待办</span></div>}
                    {doneTodos.length > 0 && <div className="flex items-center gap-1 text-[10px] text-forest-300"><CheckCircle2 className="w-3 h-3 flex-shrink-0" /><span className="truncate">{doneTodos.length} 项完成</span></div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-ink-700/40 bg-ink-900/35 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-parchment-100">{selectedDateLabel}</h3>
              <p className="text-[11px] text-parchment-400 mt-1">{selectedNotes.length} 篇笔记 · {selectedFiles.length} 个文件 · {selectedActiveTodos.length} 项待办</p>
            </div>
            {selectedDate === today && <span className="tag !bg-gold-400/15 !text-gold-300 !border-gold-400/25 text-[10px]">今天</span>}
          </div>

          <button onClick={() => setReportModalOpen(true)} className="w-full btn-primary !py-2 !text-xs inline-flex items-center justify-center gap-1.5 mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            打开日报
          </button>

          {monthlyReport && (
            <div className="mb-4 space-y-3">
              {monthlyReport && <div className="rounded-lg border border-forest-500/25 bg-forest-800/20 p-3"><p className="text-[11px] font-semibold text-forest-200 mb-2">AI 月报 · {monthlyReportLabel || monthLabel}</p><p className="text-xs text-parchment-200 whitespace-pre-wrap leading-relaxed">{monthlyReport}</p></div>}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2"><Sparkles className="w-3.5 h-3.5 text-forest-300" /><h4 className="text-xs font-semibold text-parchment-200">做了什么</h4></div>
              {selectedEvents.length === 0 ? (
                <p className="rounded-lg bg-ink-800/35 px-3 py-2 text-xs text-ink-500">这一天暂无动态记录</p>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map((event) => (
                    <div key={event.id} className="rounded-lg bg-ink-800/35 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-parchment-100 truncate">{event.title}</p>
                        <span className="text-[10px] text-ink-500 flex-shrink-0">{new Date(event.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-[10px] text-parchment-500 mt-1">{eventTypeLabels[event.type]}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2"><CheckSquare className="w-3.5 h-3.5 text-gold-400" /><h4 className="text-xs font-semibold text-parchment-200">待办事项</h4></div>
              {selectedTodos.length === 0 ? (
                <p className="rounded-lg bg-ink-800/35 px-3 py-2 text-xs text-ink-500">这一天暂无待办</p>
              ) : (
                <div className="space-y-2">
                  {selectedTodos.map((todo) => (
                    <TodoItem key={`${selectedDate}-${todo.id}`} todo={todo} onToggle={cycleTodoStatus} overdue={isOverdue(todo)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {reportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/75 p-4 backdrop-blur-sm"
          onMouseDown={() => setReportModalOpen(false)}
        >
          <div
            className="w-full max-w-3xl max-h-[88vh] overflow-hidden rounded-xl border border-ink-700/60 bg-ink-950 shadow-2xl shadow-black/50"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-ink-800/60 p-4">
              <div>
                <h3 className="font-serif text-lg font-semibold text-parchment-100">{selectedDateLabel} 日报</h3>
                <p className="mt-1 text-xs text-parchment-400">
                  {selectedNotes.length} 篇笔记 · {selectedFiles.length} 个文件 · {selectedActiveTodos.length} 项待办
                </p>
              </div>
              <button
                onClick={() => setReportModalOpen(false)}
                className="rounded-lg p-2 text-parchment-400 transition-colors hover:bg-ink-800 hover:text-parchment-100"
                title="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(88vh-132px)] overflow-y-auto p-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                {!isFutureDate && (
                  <button
                    onClick={generateDailyReport}
                    disabled={reportLoading !== null}
                    className="btn-primary !py-2 !text-xs inline-flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {reportLoading === 'daily' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    AI 生成日报
                  </button>
                )}
                <button
                  onClick={saveDailyReport}
                  disabled={!dailyReport.trim() || dailyReportSaving}
                  className="btn-ghost !py-2 !text-xs disabled:opacity-50"
                >
                  {dailyReportSaving ? '保存中...' : '保存日报'}
                </button>
              </div>

              <textarea
                value={dailyReport}
                onChange={(event) => setDailyReport(event.target.value)}
                placeholder={isFutureDate ? '未来日期不能 AI 生成日报，可以先手写计划或备注...' : '点击 AI 生成日报，或直接在这里手写/编辑这一天的日报...'}
                className="input-field min-h-[300px] resize-y text-sm leading-relaxed"
              />

              <div className="rounded-lg border border-ink-700/40 bg-ink-900/35 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-parchment-200">笔记改动 Diff</p>
                    <p className="mt-0.5 text-[10px] text-parchment-500">当天最终快照相对上一个快照的变化</p>
                  </div>
                  {noteChangesLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-parchment-400" />}
                </div>
                {!noteChangesLoading && noteChanges.length === 0 ? (
                  <p className="rounded-lg bg-ink-800/35 px-3 py-2 text-xs text-ink-500">这一天暂无笔记快照改动</p>
                ) : (
                  <div className="space-y-3">
                    {noteChanges.map((change) => (
                      <div key={`${change.noteId}-${change.changedAt}`} className="rounded-lg border border-ink-700/30 bg-ink-950/35 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-xs font-semibold text-parchment-100">
                            {change.isNew ? '新建' : '修改'}《{change.title}》
                          </p>
                          <span className="text-[10px] text-ink-500">{new Date(change.changedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {change.previousTitle && change.previousTitle !== change.title && (
                          <p className="mb-2 rounded-md bg-gold-400/10 px-2 py-1 text-[10px] text-gold-300">
                            标题：{change.previousTitle} → {change.title}
                          </p>
                        )}
                        <div className="space-y-2">
                          {change.added.length > 0 && (
                            <div>
                              <p className="mb-1 text-[10px] font-semibold text-forest-200">新增</p>
                              <div className="space-y-1">
                                {change.added.map((item, index) => (
                                  <p key={`${change.noteId}-add-${index}`} className="rounded-md border border-forest-500/20 bg-forest-800/20 px-2 py-1.5 text-xs leading-relaxed text-forest-100">
                                    + {item}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                          {change.removed.length > 0 && (
                            <div>
                              <p className="mb-1 text-[10px] font-semibold text-red-300">删除/替换</p>
                              <div className="space-y-1">
                                {change.removed.map((item, index) => (
                                  <p key={`${change.noteId}-remove-${index}`} className="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1.5 text-xs leading-relaxed text-red-200 line-through">
                                    - {item}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                          {change.added.length === 0 && change.removed.length === 0 && (
                            <p className="text-xs text-ink-500">只有标题或元数据发生变化</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-ink-700/40 bg-ink-900/35 p-3">
                  <p className="mb-2 text-xs font-semibold text-parchment-200">当天动态</p>
                  {selectedEvents.length === 0 ? (
                    <p className="text-xs text-ink-500">暂无动态记录</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedEvents.slice(0, 5).map((event) => (
                        <p key={event.id} className="text-xs text-parchment-400 truncate">{event.title}</p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-lg border border-ink-700/40 bg-ink-900/35 p-3">
                  <p className="mb-2 text-xs font-semibold text-parchment-200">当天待办</p>
                  {selectedTodos.length === 0 ? (
                    <p className="text-xs text-ink-500">暂无待办</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedTodos.slice(0, 5).map((todo) => (
                        <p key={todo.id} className="text-xs text-parchment-400 truncate">{todo.title}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TodoItem({ todo, onToggle, overdue }: { todo: Todo; onToggle: (todo: Todo) => void; overdue?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg hover:bg-ink-800/40 transition-colors group cursor-pointer ${
        overdue ? 'bg-red-500/5 border border-red-500/15' : 'bg-ink-800/20'
      } p-2`}
      onClick={() => onToggle(todo)}
    >
      {todo.status === 'completed' ? (
        <CheckCircle2 className="w-4 h-4 text-forest-400" />
      ) : (
        <Circle className="w-4 h-4 text-ink-500 group-hover:text-gold-400 transition-colors" />
      )}
      <p className={`flex-1 min-w-0 text-xs font-medium truncate ${todo.status === 'completed' ? 'line-through text-parchment-500' : 'text-parchment-100'}`}>
        {todo.title}
      </p>
    </div>
  );
}
