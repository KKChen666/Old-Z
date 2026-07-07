import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import FilePreview from '@/components/FilePreview';
import { useCellValue, usePublisher } from '@mdxeditor/gurx';
import { $createParagraphNode } from 'lexical';
import { useAppStore } from '@/stores/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { api } from '@/utils/api';
import {
  MDXEditor,
  type MDXEditorMethods,
  applyFormat$,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  ButtonWithTooltip,
  CodeToggle,
  CreateLink,
  InsertCodeBlock,
  InsertTable,
  InsertThematicBreak,
  StrikeThroughSupSubToggles,
  ListsToggle,
  Separator,
  UndoRedo,
  codeBlockPlugin,
  codeMirrorPlugin,
  convertSelectionToNode$,
  currentFormat$,
  headingsPlugin,
  IS_BOLD,
  IS_CODE,
  IS_HIGHLIGHT,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_SUBSCRIPT,
  IS_SUPERSCRIPT,
  IS_UNDERLINE,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import {
  ArrowLeft,
  Bot,
  CheckSquare,
  Clock,
  Edit3,
  Eraser,
  AlertTriangle,
  ListTodo,
  Loader2,
  Plus,
  History,
  RotateCcw,
  Save,
  StickyNote,
  Tag,
  Trash2,
  Wand2,
  Paperclip,
  Search,
  File as FileIcon,
} from 'lucide-react';
import type { NoteSnapshot, FileItem } from '@/types';

function isHtmlContent(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content);
}

function htmlToMarkdown(html: string): string {
  if (typeof window === 'undefined') return html.replace(/<[^>]*>/g, '').trim();

  const doc = new DOMParser().parseFromString(html, 'text/html');

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const element = node as HTMLElement;
    const children = Array.from(element.childNodes).map(walk).join('');

    switch (element.tagName.toLowerCase()) {
      case 'h1':
        return `# ${children.trim()}\n\n`;
      case 'h2':
        return `## ${children.trim()}\n\n`;
      case 'h3':
        return `### ${children.trim()}\n\n`;
      case 'h4':
        return `#### ${children.trim()}\n\n`;
      case 'strong':
      case 'b':
        return `**${children}**`;
      case 'em':
      case 'i':
        return `*${children}*`;
      case 's':
      case 'strike':
        return `~~${children}~~`;
      case 'code':
        return element.closest('pre') ? children : `\`${children}\``;
      case 'pre':
        return `\n\`\`\`\n${element.textContent || ''}\n\`\`\`\n\n`;
      case 'blockquote':
        return `${children
          .trim()
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n')}\n\n`;
      case 'li':
        return `- ${children.trim()}\n`;
      case 'ul':
      case 'ol':
        return `${children}\n`;
      case 'a': {
        const href = element.getAttribute('href');
        return href ? `[${children || href}](${href})` : children;
      }
      case 'br':
        return '\n';
      case 'p':
      case 'div':
        return `${children.trim()}\n\n`;
      default:
        return children;
    }
  };

  return Array.from(doc.body.childNodes)
    .map(walk)
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeNoteContent(content: string): string {
  return isHtmlContent(content) ? htmlToMarkdown(content) : content;
}

// 笔记中 @文件 的标记语法：[@文件名](oldzfile://<fileId>)
const FILE_MENTION_SCHEME = 'oldzfile://';
const FILE_MENTION_RE = /oldzfile:\/\/([^\s)"'>]+)/g;

function extractMentionFileIds(content: string): string[] {
  const ids = new Set<string>();
  for (const match of content.matchAll(FILE_MENTION_RE)) {
    if (match[1]) ids.add(match[1]);
  }
  return Array.from(ids);
}

function getPlainText(content: string): string {
  const markdown = normalizeNoteContent(content);
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~\-[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type SnapshotDiffLine = {
  type: 'same' | 'added' | 'removed';
  text: string;
};

type SnapshotDiffViewMode = 'inline' | 'side-by-side';

type SnapshotSideBySideDiffRow = {
  left?: SnapshotDiffLine;
  right?: SnapshotDiffLine;
};

function splitDiffLines(content: string): string[] {
  const normalized = normalizeNoteContent(content || '').replace(/\r\n/g, '\n');
  return normalized.length === 0 ? [] : normalized.split('\n');
}

function buildSnapshotDiff(currentContent: string, snapshotContent: string): SnapshotDiffLine[] {
  const current = splitDiffLines(currentContent);
  const target = splitDiffLines(snapshotContent);
  const rows = current.length;
  const cols = target.length;
  const dp = Array.from({ length: rows + 1 }, () => Array(cols + 1).fill(0));

  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      dp[i][j] = current[i] === target[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const diff: SnapshotDiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (current[i] === target[j]) {
      diff.push({ type: 'same', text: current[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      diff.push({ type: 'removed', text: current[i] });
      i++;
    } else {
      diff.push({ type: 'added', text: target[j] });
      j++;
    }
  }
  while (i < rows) diff.push({ type: 'removed', text: current[i++] });
  while (j < cols) diff.push({ type: 'added', text: target[j++] });

  return diff;
}

function buildSideBySideSnapshotDiff(diff: SnapshotDiffLine[]): SnapshotSideBySideDiffRow[] {
  const rows: SnapshotSideBySideDiffRow[] = [];
  let index = 0;

  while (index < diff.length) {
    const line = diff[index];
    if (line.type === 'same') {
      rows.push({ left: line, right: line });
      index++;
      continue;
    }

    const removed: SnapshotDiffLine[] = [];
    const added: SnapshotDiffLine[] = [];
    while (index < diff.length && diff[index].type !== 'same') {
      if (diff[index].type === 'removed') removed.push(diff[index]);
      if (diff[index].type === 'added') added.push(diff[index]);
      index++;
    }

    const rowCount = Math.max(removed.length, added.length);
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      rows.push({ left: removed[rowIndex], right: added[rowIndex] });
    }
  }

  return rows;
}

function isEditedSnapshotDiffLine(diff: SnapshotDiffLine[], index: number): boolean {
  const line = diff[index];
  return (line.type === 'removed' && diff[index + 1]?.type === 'added')
    || (line.type === 'added' && diff[index - 1]?.type === 'removed');
}

function getInlineSnapshotDiffLineClass(line: SnapshotDiffLine, isEdited: boolean): string {
  if (isEdited) return 'border-l-4 border-[#0969da] bg-[#ddf4ff] text-[#24292f] dark:border-[#2f81f7] dark:bg-[#0d2d4d] dark:text-[#c9d1d9]';
  if (line.type === 'added') return 'border-l-4 border-[#1a7f37] bg-[#dafbe1] text-[#24292f] dark:border-[#3fb950] dark:bg-[#12361f] dark:text-[#c9d1d9]';
  if (line.type === 'removed') return 'border-l-4 border-[#cf222e] bg-[#ffebe9] text-[#24292f] dark:border-[#f85149] dark:bg-[#4b1d20] dark:text-[#c9d1d9]';
  return 'border-l-2 border-transparent text-[#57606a] dark:text-parchment-400';
}

function getSideBySideSnapshotDiffCellClass(line: SnapshotDiffLine | undefined, isEdited: boolean): string {
  if (isEdited) return 'bg-[#ddf4ff] text-[#24292f] dark:bg-[#0d2d4d] dark:text-[#c9d1d9]';
  if (line?.type === 'added') return 'bg-[#dafbe1] text-[#24292f] dark:bg-[#12361f] dark:text-[#c9d1d9]';
  if (line?.type === 'removed') return 'bg-[#ffebe9] text-[#24292f] dark:bg-[#4b1d20] dark:text-[#c9d1d9]';
  if (line?.type === 'same') return 'text-[#57606a] dark:text-parchment-400';
  return 'bg-[#f6f8fa] text-[#8c959f] dark:bg-ink-950/20 dark:text-ink-500';
}

const mdxEditorTranslations: Record<string, string> = {
  'toolbar.toggleGroup': '格式按钮组',
  'toolbar.undo': '撤销 {{shortcut}}',
  'toolbar.redo': '重做 {{shortcut}}',
  'toolbar.bold': '加粗',
  'toolbar.removeBold': '取消加粗',
  'toolbar.italic': '斜体',
  'toolbar.removeItalic': '取消斜体',
  'toolbar.underline': '下划线',
  'toolbar.removeUnderline': '取消下划线',
  'toolbar.strikethrough': '删除线',
  'toolbar.removeStrikethrough': '取消删除线',
  'toolbar.inlineCode': '行内代码',
  'toolbar.removeInlineCode': '取消行内代码',
  'toolbar.link': '创建链接',
  'toolbar.table': '插入表格',
  'toolbar.codeBlock': '插入代码块',
  'toolbar.thematicBreak': '插入分割线',
  'toolbar.bulletedList': '无序列表',
  'toolbar.numberedList': '有序列表',
  'toolbar.checkList': '任务列表',
  'toolbar.blockTypes.paragraph': '正文',
  'toolbar.blockTypes.quote': '引用',
  'toolbar.blockTypes.heading': '标题 {{level}}',
  'toolbar.blockTypeSelect.selectBlockTypeTooltip': '选择段落类型',
  'toolbar.blockTypeSelect.placeholder': '段落类型',
  'toolbar.richText': '富文本',
  'toolbar.diffMode': '差异模式',
  'toolbar.source': '源码模式',
};
function translateMdxEditor(key: string, defaultValue: string, interpolations?: Record<string, unknown>): string {
  let value = mdxEditorTranslations[key] || defaultValue;
  Object.entries(interpolations || {}).forEach(([name, replacement]) => {
    value = value.split(`{{${name}}}`).join(String(replacement));
  });
  return value;
}

function ClearFormattingButton() {
  const currentFormat = useCellValue(currentFormat$);
  const applyFormat = usePublisher(applyFormat$);
  const convertSelectionToNode = usePublisher(convertSelectionToNode$);

  const clearFormat = () => {
    const activeFormats: Array<[number, Parameters<typeof applyFormat>[0]]> = [
      [IS_BOLD, 'bold'],
      [IS_ITALIC, 'italic'],
      [IS_UNDERLINE, 'underline'],
      [IS_STRIKETHROUGH, 'strikethrough'],
      [IS_CODE, 'code'],
      [IS_SUBSCRIPT, 'subscript'],
      [IS_SUPERSCRIPT, 'superscript'],
      [IS_HIGHLIGHT, 'highlight'],
    ];

    activeFormats.forEach(([flag, format]) => {
      if ((currentFormat & flag) !== 0) applyFormat(format);
    });
    convertSelectionToNode(() => $createParagraphNode());
  };

  return (
    <ButtonWithTooltip title="清除格式" aria-label="清除格式" onClick={clearFormat}>
      <Eraser className="w-4 h-4" />
    </ButtonWithTooltip>
  );
}

function createEditorPlugins(onStartAiCommand: () => void, onOpenFilePicker: () => void) {
  return [
  headingsPlugin(),
  listsPlugin(),
  quotePlugin(),
  thematicBreakPlugin(),
  linkPlugin(),
  linkDialogPlugin(),
  tablePlugin(),
  codeBlockPlugin({ defaultCodeBlockLanguage: 'txt' }),
  codeMirrorPlugin({
    codeBlockLanguages: {
      js: 'JavaScript',
      jsx: 'JSX',
      ts: 'TypeScript',
      tsx: 'TSX',
      css: 'CSS',
      html: 'HTML',
      json: 'JSON',
      md: 'Markdown',
      txt: 'Text',
    },
  }),
  markdownShortcutPlugin(),
  toolbarPlugin({
    toolbarContents: () => (
      <>
        <UndoRedo />
        <Separator />
        <BlockTypeSelect />
        <BoldItalicUnderlineToggles />
        <StrikeThroughSupSubToggles options={['Strikethrough']} />
        <CodeToggle />
        <ClearFormattingButton />
        <Separator />
        <ListsToggle />
        <Separator />
        <CreateLink />
        <InsertTable />
        <InsertCodeBlock />
        <InsertThematicBreak />
        <Separator />
        <ButtonWithTooltip
          title="链接文件（或在正文输入 @ 触发）"
          aria-label="链接文件"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onMouseUp={(event) => event.stopPropagation()}
          onClick={onOpenFilePicker}
        >
          <Paperclip className="w-4 h-4" />
        </ButtonWithTooltip>
        <Separator />
        <ButtonWithTooltip
          title="AI 编辑"
          aria-label="AI 编辑"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onMouseUp={(event) => event.stopPropagation()}
          onClick={onStartAiCommand}
        >
          <Bot className="w-4 h-4" />
        </ButtonWithTooltip>
      </>
    ),
  }),
  ];
}

type AiAssistMode = 'polish' | 'continue' | 'summarize' | 'actions' | 'custom' | 'chat';
type AiResultKind = 'edit' | 'chat';
type SlashAiMode = 'auto' | 'command' | 'ask';
type ActiveSlashAiCommand = {
  fullCommand: string;
  instruction: string;
  start: number;
  source: 'inline' | 'selection';
  selectionText?: string;
};
type SlashAiIntent =
  | { type: 'tool'; tool: 'divider' | 'deleteAll' | 'summarizeDocument' }
  | { type: 'smalltalk' }
  | { type: 'chat' }
  | { type: 'edit' };

function classifySlashAiIntent(instruction: string): SlashAiIntent {
  const text = instruction.trim().toLowerCase();

  if (/(删除|清空|删掉|remove|delete|clear).*(全文|全部|整篇|笔记|内容|document|note|all)/i.test(text)) {
    return { type: 'tool', tool: 'deleteAll' };
  }
  if (/(分割线|分隔线|横线|水平线|divider|separator|horizontal rule|hr|---)/i.test(text)) {
    return { type: 'tool', tool: 'divider' };
  }
  if (/(总结|摘要|概括|summarize|summary).*(文档|全文|整篇|笔记|document|note|all)/i.test(text) || /^(总结|摘要|概括|summarize|summary)$/i.test(text)) {
    return { type: 'tool', tool: 'summarizeDocument' };
  }
  if (/^(你好|您好|hello|hi|hey|嗨|哈喽|在吗|早上好|中午好|下午好|晚上好)[！!。.\s]*$/i.test(text)) {
    return { type: 'smalltalk' };
  }
  if (/(什么|为什么|怎么|如何|是否|能不能|可不可以|解释|什么意思|聊聊|\?|？|what|why|how|explain|tell me|discuss)/i.test(text)) {
    return { type: 'chat' };
  }

  return { type: 'edit' };
}

type NoteAiIntent =
  | { type: 'function'; tool: 'divider' | 'boldSelection' | 'insertTable' | 'todo'; risk: 'safe'; rows?: number; cols?: number }
  | { type: 'ask'; smalltalk?: boolean }
  | { type: 'edit'; mode?: 'summarize' | 'continue' | 'translate' | 'polish' | 'custom' }
  | { type: 'document'; operation: 'deleteAll' | 'removeEmptyLines' | 'headingLevel' | 'sort'; risk: 'safe' | 'confirm' }
  | { type: 'workflow'; goal: string }
  | { type: 'mixed'; steps: Array<{ type: 'function' | 'edit' | 'document'; tool?: string; mode?: string; operation?: string; risk?: 'safe' | 'confirm'; rows?: number; cols?: number }> };

const slashAiCommandSuggestions = [
  { label: '问答', command: '表达思乡之情的成语有哪些' },
  { label: '总结', command: '总结上面的内容' },
  { label: '续写', command: '帮我续写上面的内容' },
  { label: '分割线', command: '添加一条分割线' },
  { label: '表格', command: '新建一个 3 行 3 列表格' },
  { label: '追加', command: '总结上面的内容，并插入到文档最后' },
  { label: 'PRD', command: '帮我写一份产品需求文档 PRD' },
  { label: '清空', command: '删除全文' },
] as const;

function parseNoteAiTableSize(text: string): { rows: number; cols: number } {
  const match = text.match(/(\d+)\s*(?:行|rows?|x|×)\s*(\d+)\s*(?:列|cols?|columns?)?/i);
  if (!match) return { rows: 3, cols: 3 };
  return {
    rows: Math.min(Math.max(Number(match[1]) || 3, 1), 12),
    cols: Math.min(Math.max(Number(match[2]) || 3, 1), 8),
  };
}

function classifyNoteAiIntentByRules(instruction: string, hasSelection: boolean): NoteAiIntent | null {
  const text = instruction.trim().toLowerCase();

  if (/(删除|清空|删掉|remove|delete|clear).*(全文|全部|整篇|笔记|内容|document|note|all)/i.test(text)) {
    return { type: 'document', operation: 'deleteAll', risk: 'confirm' };
  }
  if (/(分割线|分隔线|横线|水平线|divider|separator|horizontal rule|hr|---)/i.test(text)) {
    return { type: 'function', tool: 'divider', risk: 'safe' };
  }
  if (/(加粗|粗体|bold)/i.test(text)) {
    return { type: 'function', tool: 'boldSelection', risk: 'safe' };
  }
  if (/(表格|table)/i.test(text)) {
    return { type: 'function', tool: 'insertTable', risk: 'safe', ...parseNoteAiTableSize(text) };
  }
  if (/(并|然后|再|同时|and then|then).*(插入|追加|生成|表格|todo|待办|insert|append|table)/i.test(text)) {
    return { type: 'mixed', steps: [{ type: 'edit', mode: 'custom' }] };
  }
  if (/(prd|产品需求|项目计划|会议纪要|完整方案|研究报告|workflow|agent|多步骤|一步步|帮我完成)/i.test(text)) {
    return { type: 'workflow', goal: instruction.trim() };
  }
  if (/(总结|摘要|概括|summarize|summary).*(文档|全文|整篇|笔记|document|note|all|上面|above)/i.test(text) || /^(总结|摘要|概括|summarize|summary)$/i.test(text)) {
    return { type: 'edit', mode: 'summarize' };
  }
  if (/^(你好|您好|hello|hi|hey|嗨|哈喽|在吗|早上好|中午好|下午好|晚上好)[，。？`\s]*$/i.test(text)) {
    return { type: 'ask', smalltalk: true };
  }
  if (/(写进|写入|插入|放到|添加到|替换|追加|续写|改写|润色|生成|整理成|总结.*写|summary.*insert|continue|rewrite|polish|generate)/i.test(text)) {
    if (/(续写|continue|生成|generate)/i.test(text)) {
      return { type: 'edit', mode: /续写|continue/i.test(text) ? 'continue' : 'custom' };
    }
    if (/(改写|润色|rewrite|polish)/i.test(text)) {
      return { type: 'edit', mode: 'custom' };
    }
    return { type: 'mixed', steps: [{ type: 'edit', mode: 'custom' }] };
  }
  if (/(什么|为什么|怎么|如何|有哪些|是否|能不能|可不可以|解释|含义|意思|区别|例子|建议|聊聊|\?|？|what|why|how|explain|tell me|discuss|examples?)/i.test(text)) {
    return { type: 'ask' };
  }

  return hasSelection ? { type: 'edit', mode: 'custom' } : null;
}

function normalizeNoteAiIntent(intent: any): NoteAiIntent {
  if ((intent?.type === 'document' || intent?.type === 'danger' || intent?.tool === 'deleteAll') && (intent?.tool === 'deleteAll' || intent?.operation === 'deleteAll')) {
    return { type: 'document', operation: 'deleteAll', risk: 'confirm' };
  }
  if ((intent?.type === 'function' || intent?.type === 'tool') && ['divider', 'boldSelection', 'insertTable'].includes(intent.tool)) {
    return {
      type: 'function',
      tool: intent.tool,
      risk: 'safe',
      rows: Number.isFinite(Number(intent.rows)) ? Math.min(Math.max(Number(intent.rows), 1), 12) : undefined,
      cols: Number.isFinite(Number(intent.cols)) ? Math.min(Math.max(Number(intent.cols), 1), 8) : undefined,
    };
  }
  if (['edit', 'transform', 'command'].includes(intent?.type)) {
    const mode = ['summarize', 'continue', 'translate', 'polish', 'custom'].includes(intent.mode) ? intent.mode : 'custom';
    return { type: 'edit', mode };
  }
  if (intent?.type === 'workflow') return { type: 'workflow', goal: String(intent.goal || '') };
  if (intent?.type === 'mixed' && Array.isArray(intent.steps)) return { type: 'mixed', steps: intent.steps.slice(0, 6) };
  return { type: 'ask' };
}

async function classifyNoteAiIntent(instruction: string, context: {
  hasSelection: boolean;
  title?: string;
  content?: string;
}): Promise<NoteAiIntent> {
  const ruleIntent = classifyNoteAiIntentByRules(instruction, context.hasSelection);
  if (ruleIntent) return ruleIntent;

  try {
    const result = await api.classifyNoteIntent({
      instruction,
      hasSelection: context.hasSelection,
      title: context.title,
      contentPreview: context.content?.slice(0, 4000),
    });
    return normalizeNoteAiIntent(result);
  } catch (error) {
    console.warn('Note AI intent classification fallback:', error);
    return { type: 'ask' };
  }
}

function getSmallTalkReply(instruction: string): string {
  const text = instruction.trim();
  if (/(早上好)/i.test(text)) return '早上好，我在。';
  if (/(中午好)/i.test(text)) return '中午好，我在。';
  if (/(下午好)/i.test(text)) return '下午好，我在。';
  if (/(晚上好)/i.test(text)) return '晚上好，我在。';
  if (/(在吗)/i.test(text)) return '在，我可以帮你写、改、总结笔记。';
  return '你好，我在。';
}

export default function Notes() {
  const { notes, files, addNote, updateNote, deleteNote, addTodo, addChatMessage } = useAppStore(useShallow((s) => ({
    notes: s.notes,
    files: s.files,
    addNote: s.addNote,
    updateNote: s.updateNote,
    deleteNote: s.deleteNote,
    addTodo: s.addTodo,
    addChatMessage: s.addChatMessage,
  })));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editingMarkdown, setEditingMarkdown] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [selectionPopup, setSelectionPopup] = useState<{ show: boolean; x: number; y: number; text: string }>({
    show: false,
    x: 0,
    y: 0,
    text: '',
  });
  const [todoForm, setTodoForm] = useState<{
    show: boolean;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    dueDate: string;
  }>({ show: false, priority: 'medium', dueDate: '' });
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiResultKind, setAiResultKind] = useState<AiResultKind>('edit');
  const [aiError, setAiError] = useState('');
  const [aiLoadingMode, setAiLoadingMode] = useState<string | null>(null);
  const [lastAiMode, setLastAiMode] = useState<AiAssistMode | null>(null);
  const [slashAiError, setSlashAiError] = useState('');
  const [slashAiResult, setSlashAiResult] = useState('');
  const [slashAiResultKind, setSlashAiResultKind] = useState<AiResultKind>('edit');
  const [slashAiMode, setSlashAiMode] = useState<SlashAiMode>('auto');
  const [selectionSlashAiCommand, setSelectionSlashAiCommand] = useState<ActiveSlashAiCommand | null>(null);
  const [slashAiConfirm, setSlashAiConfirm] = useState<{ action: 'deleteAll'; message: string } | null>(null);
  const [dismissedSlashAiStart, setDismissedSlashAiStart] = useState<number | null>(null);
  const [toolbarSlashAiStart, setToolbarSlashAiStart] = useState<number | null>(null);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const mentionActiveRef = useRef(false);
  const [snapshots, setSnapshots] = useState<NoteSnapshot[]>([]);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [restoringSnapshotId, setRestoringSnapshotId] = useState<string | null>(null);
  const [previewSnapshot, setPreviewSnapshot] = useState<NoteSnapshot | null>(null);
  const [snapshotDiffViewMode, setSnapshotDiffViewMode] = useState<SnapshotDiffViewMode>('inline');
  const [restoreConfirmingSnapshotId, setRestoreConfirmingSnapshotId] = useState<string | null>(null);
  const [deleteConfirmingNoteId, setDeleteConfirmingNoteId] = useState<string | null>(null);

  const editorRef = useRef<MDXEditorMethods>(null);
  const editorShellRef = useRef<HTMLDivElement>(null);
  const editingMarkdownRef = useRef('');
  const slashAiInputRef = useRef<HTMLInputElement>(null);
  const slashAiEscAtRef = useRef(0);
  const currentNote = notes.find((n) => n.id === selectedNote);
  const currentMarkdown = useMemo(() => normalizeNoteContent(currentNote?.content || ''), [currentNote?.content]);

  const mentionFiles = useMemo(() => {
    const keyword = mentionSearch.trim().toLowerCase();
    const list = keyword ? files.filter((f) => f.name.toLowerCase().includes(keyword)) : files;
    return list.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [files, mentionSearch]);
  const snapshotPreviewDiff = useMemo(() => {
    if (!previewSnapshot) return [];
    const currentContent = editingId === currentNote?.id ? editingMarkdown : currentMarkdown;
    return buildSnapshotDiff(currentContent, previewSnapshot.content);
  }, [currentMarkdown, currentNote?.id, editingId, editingMarkdown, previewSnapshot]);
  const snapshotSideBySideDiff = useMemo(() => buildSideBySideSnapshotDiff(snapshotPreviewDiff), [snapshotPreviewDiff]);
  const snapshotPreviewStats = useMemo(() => {
    return snapshotPreviewDiff.reduce(
      (stats, line) => {
        if (line.type === 'added') stats.added += 1;
        if (line.type === 'removed') stats.removed += 1;
        return stats;
      },
      { added: 0, removed: 0 }
    );
  }, [snapshotPreviewDiff]);
  const slashAiCommand = useMemo<ActiveSlashAiCommand | null>(() => {
    const match = editingMarkdown.match(/(?:^|\n)(\/ai(?:\s+([^\n]*))?)$/i);
    if (!match) return null;

    const fullCommand = match[1];
    const instruction = (match[2] || '').trim();

    return {
      fullCommand,
      instruction,
      start: editingMarkdown.length - fullCommand.length,
      source: 'inline',
    };
  }, [editingMarkdown]);
  const activeSlashAiCommand = selectionSlashAiCommand || (dismissedSlashAiStart === slashAiCommand?.start ? null : slashAiCommand);
  const activeAiSelectionText = activeSlashAiCommand?.selectionText || selectionPopup.text;

  useEffect(() => {
    editingMarkdownRef.current = editingMarkdown;
  }, [editingMarkdown]);

  useEffect(() => {
    setPreviewSnapshot(null);
    setRestoreConfirmingSnapshotId(null);
    setDeleteConfirmingNoteId(null);
  }, [currentNote?.id]);

  useEffect(() => {
    if (!selectedNote && notes.length > 0) setSelectedNote(notes[0].id);
  }, [notes, selectedNote]);

  useEffect(() => {
    if (editingId && currentNote?.id === editingId) {
      const markdown = normalizeNoteContent(currentNote.content);
      setEditingMarkdown(markdown);
      editorRef.current?.setMarkdown(markdown);
    }
  }, [currentNote, editingId]);

  useEffect(() => {
    if (!slashAiCommand) {
      setDismissedSlashAiStart(null);
      setToolbarSlashAiStart(null);
    }
  }, [slashAiCommand]);

  const resetSelectionActions = useCallback(() => {
    setSelectionPopup({ show: false, x: 0, y: 0, text: '' });
    setTodoForm({ show: false, priority: 'medium', dueDate: '' });
    setAiPromptOpen(false);
    setAiInstruction('');
    setAiResult('');
    setAiResultKind('edit');
    setAiError('');
    setLastAiMode(null);
    setSlashAiError('');
    setSlashAiResult('');
    setSlashAiResultKind('edit');
    setSlashAiMode('auto');
    setSelectionSlashAiCommand(null);
    setSlashAiConfirm(null);
    setDismissedSlashAiStart(null);
    setToolbarSlashAiStart(null);
    setPreviewSnapshot(null);
    setRestoreConfirmingSnapshotId(null);
    setDeleteConfirmingNoteId(null);
  }, []);

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    addNote({
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: newTitle.trim(),
      content: newContent.trim(),
      tags: [],
      linkedFileIds: [],
      linkedTodoIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setNewTitle('');
    setNewContent('');
    setShowNew(false);
  };

  const startEdit = (id: string) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    const markdown = normalizeNoteContent(note.content);
    setSelectedNote(id);
    setEditingId(id);
    setEditTitle(note.title);
    setEditingMarkdown(markdown);
    setShowSnapshots(false);
    setPreviewSnapshot(null);
    setRestoreConfirmingSnapshotId(null);
    resetSelectionActions();
  };

  const loadSnapshots = useCallback(async (noteId: string) => {
    setSnapshotsLoading(true);
    try {
      const result = await api.getNoteSnapshots(noteId);
      setSnapshots(result);
      setShowSnapshots(true);
    } catch (error) {
      console.error('Load note snapshots error:', error);
      setSnapshots([]);
      setShowSnapshots(true);
    } finally {
      setSnapshotsLoading(false);
    }
  }, []);

  const restoreSnapshot = useCallback(async (snapshot: NoteSnapshot, confirmed = false) => {
    if (!currentNote || restoringSnapshotId) return;
    if (!confirmed) {
      setPreviewSnapshot(snapshot);
      setRestoreConfirmingSnapshotId(null);
      return;
    }
    setRestoringSnapshotId(snapshot.id);
    try {
      const restored = await api.restoreNoteSnapshot(currentNote.id, snapshot.id);
      updateNote(currentNote.id, {
        title: restored.title,
        content: restored.content,
        updatedAt: restored.updatedAt,
      });
      setEditTitle(restored.title);
      setEditingMarkdown(restored.content);
      editorRef.current?.setMarkdown(restored.content);
      setPreviewSnapshot(null);
      setRestoreConfirmingSnapshotId(null);
      await loadSnapshots(currentNote.id);
    } catch (error) {
      console.error('Restore note snapshot error:', error);
      window.alert('回退失败，请稍后重试');
    } finally {
      setRestoringSnapshotId(null);
    }
  }, [currentNote, loadSnapshots, restoringSnapshotId, updateNote]);

  const saveEdit = () => {
    if (!editingId) return;
    updateNote(editingId, {
      title: editTitle.trim() || '未命名笔记',
      content: editingMarkdown,
      updatedAt: new Date().toISOString(),
    });
    setEditingId(null);
    resetSelectionActions();
  };

  const handleBackToList = () => {
    setSelectedNote(null);
    setEditingId(null);
    resetSelectionActions();
  };

  const handleEditorMouseUp = useCallback(() => {
    const sel = window.getSelection();
    const selectedText = sel?.toString().trim() || '';

    if (!selectedText || !sel?.anchorNode || !editorShellRef.current?.contains(sel.anchorNode)) {
      resetSelectionActions();
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelectionPopup({
      show: false,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      text: selectedText,
    });
  }, [resetSelectionActions]);

  const handleCreateTodoFromSelection = useCallback(() => {
    if (!selectionPopup.text || !currentNote) return;
    addTodo({
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: selectionPopup.text.slice(0, 500),
      description: '',
      priority: todoForm.priority,
      status: 'pending',
      dueDate: todoForm.dueDate || undefined,
      tags: [],
      fileIds: [],
      noteIds: [currentNote.id],
      subtasks: [],
      createdAt: new Date().toISOString(),
    });
    resetSelectionActions();
  }, [addTodo, currentNote, resetSelectionActions, selectionPopup.text, todoForm.dueDate, todoForm.priority]);

  const runNoteAssist = useCallback(async (mode: AiAssistMode, resultKind: AiResultKind = 'edit') => {
    if (!currentNote || aiLoadingMode) return;
    setAiLoadingMode(mode);
    setLastAiMode(mode);
    setAiResultKind(resultKind);
    setAiResult('');
    setAiError('');
    try {
      const result = await api.assistNote({
        mode,
        instruction: aiInstruction.trim(),
        title: editTitle || currentNote.title,
        content: editingMarkdown,
        selection: selectionPopup.text,
      });
      setAiResult(result.content);
    } catch (error: any) {
      setAiError(error.message || 'AI 笔记助手调用失败');
      setAiPromptOpen(true);
    } finally {
      setAiLoadingMode(null);
    }
  }, [aiInstruction, aiLoadingMode, currentNote, editTitle, editingMarkdown, selectionPopup.text]);

  const runNoteChat = useCallback(async (message: string, target: 'selection' | 'slash') => {
    if (!currentNote || aiLoadingMode) return;
    const trimmed = message.trim();
    if (!trimmed) return;

    setAiLoadingMode(target === 'selection' ? 'chat' : 'slash');
    if (target === 'selection') {
      setAiResultKind('chat');
      setAiResult('');
      setAiError('');
    } else {
      setSlashAiResultKind('chat');
      setSlashAiResult('');
      setSlashAiError('');
      setSlashAiConfirm(null);
    }

    try {
      const content = activeAiSelectionText && (target === 'selection' || activeSlashAiCommand?.source === 'selection')
        ? `${trimmed}\n\n选中文本：\n${activeAiSelectionText}`
        : trimmed;
      const result = await api.chat.send(content, { scope: 'note', noteId: currentNote.id });
      addChatMessage(result.userMessage);
      addChatMessage(result.aiMessage);

      if (target === 'selection') {
        setAiResult(result.aiMessage.content);
      } else {
        setSlashAiResult(result.aiMessage.content);
      }
    } catch (error: any) {
      if (target === 'selection') {
        setAiError(error.message || 'AI 笔记对话失败');
        setAiPromptOpen(true);
      } else {
        setSlashAiError(error.message || 'AI 笔记对话失败');
      }
    } finally {
      setAiLoadingMode(null);
    }
  }, [activeAiSelectionText, activeSlashAiCommand?.source, addChatMessage, aiLoadingMode, currentNote]);

  const runSelectionAskAi = useCallback(async () => {
    const intent = await classifyNoteAiIntent(aiInstruction, {
      hasSelection: !!selectionPopup.text,
      title: editTitle || currentNote?.title,
      content: editingMarkdown,
    });
    if (intent.type === 'ask' && intent.smalltalk) {
      setAiResultKind('chat');
      setAiResult(getSmallTalkReply(aiInstruction));
      setAiError('');
      return;
    }
    if (intent.type === 'ask') {
      runNoteChat(aiInstruction, 'selection');
      return;
    }
    runNoteAssist(intent.type === 'edit' && intent.mode === 'summarize'
      ? 'summarize'
      : intent.type === 'edit' && intent.mode === 'continue'
        ? 'continue'
        : 'custom', 'edit');
  }, [aiInstruction, currentNote?.title, editTitle, editingMarkdown, runNoteAssist, runNoteChat, selectionPopup.text]);

  const updateEditorMarkdown = useCallback((nextMarkdown: string) => {
    editingMarkdownRef.current = nextMarkdown;
    setEditingMarkdown(nextMarkdown);
    editorRef.current?.setMarkdown(nextMarkdown);
    window.requestAnimationFrame(() => {
      editorRef.current?.setMarkdown(nextMarkdown);
    });
  }, []);

  const appendAiResult = useCallback(() => {
    if (!aiResult.trim()) return;
    const current = editingMarkdownRef.current;
    const nextMarkdown = `${current.trimEnd()}\n\n${aiResult.trim()}`.trimStart();
    updateEditorMarkdown(nextMarkdown);
    resetSelectionActions();
  }, [aiResult, resetSelectionActions, updateEditorMarkdown]);

  const insertAiResultBelowSelection = useCallback(() => {
    if (!aiResult.trim()) return;
    const current = editingMarkdownRef.current;
    if (!selectionPopup.text || !current.includes(selectionPopup.text)) {
      appendAiResult();
      return;
    }
    const nextMarkdown = current.replace(
      selectionPopup.text,
      `${selectionPopup.text}\n\n${aiResult.trim()}`
    );
    updateEditorMarkdown(nextMarkdown);
    resetSelectionActions();
  }, [aiResult, appendAiResult, resetSelectionActions, selectionPopup.text, updateEditorMarkdown]);

  const replaceSelectionWithAiResult = useCallback(() => {
    if (!aiResult.trim() || !selectionPopup.text) return;
    const current = editingMarkdownRef.current;
    const nextMarkdown = current.includes(selectionPopup.text)
      ? current.replace(selectionPopup.text, aiResult.trim())
      : `${current.trimEnd()}\n\n${aiResult.trim()}`;
    updateEditorMarkdown(nextMarkdown);
    resetSelectionActions();
  }, [aiResult, resetSelectionActions, selectionPopup.text, updateEditorMarkdown]);

  const insertSlashAiResult = useCallback(() => {
    if (!slashAiResult.trim() || !activeSlashAiCommand) return;
    const current = editingMarkdownRef.current;
    if (activeSlashAiCommand.source === 'selection') {
      const selectedText = activeSlashAiCommand.selectionText || '';
      const nextMarkdown = selectedText && current.includes(selectedText)
        ? current.replace(selectedText, `${selectedText}\n\n${slashAiResult.trim()}`)
        : `${current.trimEnd()}\n\n${slashAiResult.trim()}`.trimStart();
      updateEditorMarkdown(nextMarkdown);
      resetSelectionActions();
      return;
    }
    const contentBeforeCommand = current.slice(0, activeSlashAiCommand.start).trimEnd();
    const nextMarkdown = contentBeforeCommand
      ? `${contentBeforeCommand}\n\n${slashAiResult.trim()}`
      : slashAiResult.trim();
    updateEditorMarkdown(nextMarkdown);
    resetSelectionActions();
  }, [activeSlashAiCommand, resetSelectionActions, slashAiResult, updateEditorMarkdown]);

  const replaceSelectionWithSlashAiResult = useCallback(() => {
    if (!slashAiResult.trim() || !activeSlashAiCommand?.selectionText) return;
    const current = editingMarkdownRef.current;
    const selectedText = activeSlashAiCommand.selectionText;
    const nextMarkdown = current.includes(selectedText)
      ? current.replace(selectedText, slashAiResult.trim())
      : `${current.trimEnd()}\n\n${slashAiResult.trim()}`.trimStart();
    updateEditorMarkdown(nextMarkdown);
    resetSelectionActions();
  }, [activeSlashAiCommand, resetSelectionActions, slashAiResult, updateEditorMarkdown]);

  const appendSlashAiResultToEnd = useCallback((resultContent: string, commandStart: number) => {
    const current = editingMarkdownRef.current;
    const contentBeforeCommand = current.slice(0, commandStart).trimEnd();
    const nextMarkdown = contentBeforeCommand
      ? `${contentBeforeCommand}\n\n${resultContent.trim()}`
      : resultContent.trim();
    updateEditorMarkdown(nextMarkdown);
    resetSelectionActions();
  }, [resetSelectionActions, updateEditorMarkdown]);

  const buildMarkdownTable = useCallback((rows = 3, cols = 3) => {
    const safeRows = Math.min(Math.max(rows, 1), 12);
    const safeCols = Math.min(Math.max(cols, 1), 8);
    const header = Array.from({ length: safeCols }, (_, index) => `列 ${index + 1}`);
    const separator = Array.from({ length: safeCols }, () => '---');
    const body = Array.from({ length: safeRows }, () => Array.from({ length: safeCols }, () => '').join(' | '));
    return [
      `| ${header.join(' | ')} |`,
      `| ${separator.join(' | ')} |`,
      ...body.map((row) => `| ${row} |`),
    ].join('\n');
  }, []);

  const confirmSlashAiDangerAction = useCallback(() => {
    if (!slashAiConfirm || slashAiConfirm.action !== 'deleteAll') return;
    updateEditorMarkdown('');
    setSlashAiConfirm(null);
    setSlashAiResult('');
    setSlashAiError('');
    resetSelectionActions();
  }, [resetSelectionActions, slashAiConfirm, updateEditorMarkdown]);

  const runSlashAiCommand = useCallback(async () => {
    if (!currentNote || !activeSlashAiCommand || aiLoadingMode) return;
    if (!activeSlashAiCommand.instruction.trim()) {
      setSlashAiError('先输入要让 AI 做什么');
      return;
    }

    const current = editingMarkdownRef.current;
    const contentBeforeCommand = current.slice(0, activeSlashAiCommand.start).trimEnd();
    const instruction = activeSlashAiCommand.instruction.trim();
    const commandStart = activeSlashAiCommand.start;
    if (slashAiMode === 'ask') {
      setSlashAiError('');
      setSlashAiResult('');
      setSlashAiConfirm(null);
      await runNoteChat(instruction, 'slash');
      return;
    }

    let intent = await classifyNoteAiIntent(instruction, {
      hasSelection: !!activeAiSelectionText,
      title: editTitle || currentNote.title,
      content: contentBeforeCommand,
    });
    if (slashAiMode === 'command' && intent.type === 'ask') {
      intent = { type: 'edit', mode: 'custom' };
    }
    setSlashAiError('');
    setSlashAiResult('');
    setSlashAiConfirm(null);

    if (intent.type === 'function' && intent.tool === 'divider') {
      const nextMarkdown = contentBeforeCommand ? `${contentBeforeCommand}\n\n---` : '---';
      updateEditorMarkdown(nextMarkdown);
      resetSelectionActions();
      return;
    }

    if (intent.type === 'function' && intent.tool === 'insertTable') {
      const table = buildMarkdownTable(intent.rows, intent.cols);
      const nextMarkdown = contentBeforeCommand ? `${contentBeforeCommand}\n\n${table}` : table;
      updateEditorMarkdown(nextMarkdown);
      resetSelectionActions();
      return;
    }

    if (intent.type === 'function' && intent.tool === 'boldSelection') {
      const latest = editingMarkdownRef.current;
      if (activeAiSelectionText && latest.includes(activeAiSelectionText)) {
        updateEditorMarkdown(latest.replace(activeAiSelectionText, `**${activeAiSelectionText}**`));
        resetSelectionActions();
      } else {
        setSlashAiError('请先选中要加粗的内容');
      }
      return;
    }

    if (intent.type === 'document' && intent.operation === 'deleteAll') {
      setSlashAiConfirm({ action: 'deleteAll', message: '确认删除当前笔记的全部内容吗？这个操作会清空正文。' });
      return;
    }

    if (intent.type === 'ask' && intent.smalltalk) {
      setSlashAiResultKind('chat');
      setSlashAiResult(getSmallTalkReply(instruction));
      return;
    }

    if (intent.type === 'ask') {
      await runNoteChat(instruction, 'slash');
      return;
    }

    setAiLoadingMode('slash');
    try {
      const mode: AiAssistMode = intent.type === 'edit' && intent.mode === 'summarize'
        ? 'summarize'
        : intent.type === 'edit' && intent.mode === 'continue'
          ? 'continue'
          : 'custom';
      const resultKind: AiResultKind = 'edit';
      const result = await api.assistNote({
        mode,
        instruction,
        title: editTitle || currentNote.title,
        content: contentBeforeCommand,
        selection: activeAiSelectionText || '',
      });

      setSlashAiResultKind(resultKind);
      const resultContent = result.content.trim();
      const shouldAutoAppend = intent.type === 'mixed' && /(插入|追加|写进|写入|放到|添加到|末尾|最后|append|insert)/i.test(instruction);
      if (shouldAutoAppend) {
        appendSlashAiResultToEnd(resultContent, commandStart);
        return;
      }
      setSlashAiResult(resultContent);
    } catch (error: any) {
      setSlashAiError(error.message || 'AI 命令执行失败');
    } finally {
      setAiLoadingMode(null);
    }
  }, [activeAiSelectionText, activeSlashAiCommand, aiLoadingMode, appendSlashAiResultToEnd, buildMarkdownTable, currentNote, editTitle, resetSelectionActions, runNoteChat, slashAiMode, updateEditorMarkdown]);

  const updateSlashAiInstruction = useCallback((instruction: string) => {
    if (!activeSlashAiCommand) return;
    if (activeSlashAiCommand.source === 'selection') {
      setSelectionSlashAiCommand({ ...activeSlashAiCommand, instruction });
      setSlashAiError('');
      setSlashAiResult('');
      setSlashAiConfirm(null);
      return;
    }
    const commandLine = instruction.trimStart() ? `/ai ${instruction.trimStart()}` : '/ai';
    const nextMarkdown = `${editingMarkdown.slice(0, activeSlashAiCommand.start)}${commandLine}`;
    updateEditorMarkdown(nextMarkdown);
    setSlashAiError('');
    setSlashAiResult('');
    setSlashAiConfirm(null);
  }, [activeSlashAiCommand, editingMarkdown, updateEditorMarkdown]);

  const selectSlashAiSuggestion = useCallback((command: string) => {
    updateSlashAiInstruction(command);
    window.requestAnimationFrame(() => slashAiInputRef.current?.focus());
  }, [updateSlashAiInstruction]);

  const changeSlashAiMode = useCallback((mode: SlashAiMode) => {
    setSlashAiMode(mode);
    setSlashAiError('');
    setSlashAiResult('');
    setSlashAiConfirm(null);
    window.requestAnimationFrame(() => slashAiInputRef.current?.focus());
  }, []);

  const closeSlashAiCommand = useCallback(() => {
    if (!activeSlashAiCommand) return;

    if (activeSlashAiCommand.source === 'selection') {
      setSelectionSlashAiCommand(null);
      setSlashAiError('');
      setSlashAiResult('');
      setSlashAiConfirm(null);
      editorRef.current?.focus();
      return;
    }

    if (toolbarSlashAiStart === activeSlashAiCommand.start) {
      updateEditorMarkdown(editingMarkdown.slice(0, activeSlashAiCommand.start).trimEnd());
      resetSelectionActions();
      return;
    }

    setDismissedSlashAiStart(activeSlashAiCommand.start);
    setSlashAiError('');
    setSlashAiResult('');
    setSlashAiConfirm(null);
    editorRef.current?.focus();
  }, [activeSlashAiCommand, editingMarkdown, resetSelectionActions, toolbarSlashAiStart, updateEditorMarkdown]);

  const handleSlashAiEscape = useCallback(() => {
    const now = Date.now();
    if (now - slashAiEscAtRef.current < 700) {
      closeSlashAiCommand();
      slashAiEscAtRef.current = 0;
      return;
    }

    slashAiEscAtRef.current = now;
    setSlashAiError('再按一次 Esc 将退出 AI 指令，保留 /ai 文本');
  }, [closeSlashAiCommand]);

  const insertSlashAiCommand = useCallback(() => {
    if (activeSlashAiCommand) return;
    const nextMarkdown = editingMarkdown.trimEnd()
      ? `${editingMarkdown.trimEnd()}\n\n/ai`
      : '/ai';
    updateEditorMarkdown(nextMarkdown);
    resetSelectionActions();
    setToolbarSlashAiStart(nextMarkdown.length - 3);
  }, [activeSlashAiCommand, editingMarkdown, resetSelectionActions, updateEditorMarkdown]);

  const openToolbarAi = useCallback(() => {
    if (activeSlashAiCommand) {
      closeSlashAiCommand();
      return;
    }

    const sel = window.getSelection();
    const selectedText = sel?.toString().trim() || '';

    if (selectedText && sel?.anchorNode && editorShellRef.current?.contains(sel.anchorNode)) {
      setSelectionSlashAiCommand({
        fullCommand: '/ai',
        instruction: '',
        start: editingMarkdownRef.current.length,
        source: 'selection',
        selectionText: selectedText,
      });
      setTodoForm({ show: false, priority: 'medium', dueDate: '' });
      setAiInstruction('');
      setAiResult('');
      setAiError('');
      setLastAiMode(null);
      setSlashAiError('');
      setSlashAiResult('');
      setSlashAiConfirm(null);
      return;
    }

    insertSlashAiCommand();
  }, [activeSlashAiCommand, closeSlashAiCommand, insertSlashAiCommand]);

  const openMentionPicker = useCallback(() => {
    mentionActiveRef.current = false;
    setMentionSearch('');
    setMentionPickerOpen(true);
  }, []);

  const closeMentionPicker = useCallback(() => {
    mentionActiveRef.current = false;
    setMentionPickerOpen(false);
  }, []);

  const selectMention = useCallback((file: FileItem) => {
    const token = `[@${file.name}](oldzfile://${file.id})`;
    // @ 已被 preventDefault 拦截，编辑器内不会有游离 @，直接在光标处插入链接
    editorRef.current?.insertMarkdown(` ${token} `);
    setEditingMarkdown((editorRef.current?.getMarkdown() ?? editingMarkdown) + ` ${token} `);
    mentionActiveRef.current = false;
    setMentionPickerOpen(false);
    editorRef.current?.focus();
  }, [editingMarkdown]);

  const handleEditorClick = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const anchor = (e.target as HTMLElement).closest('a');
    const href = anchor?.getAttribute('href') || '';
    if (href.startsWith(FILE_MENTION_SCHEME)) {
      e.preventDefault();
      const id = href.slice(FILE_MENTION_SCHEME.length);
      const file = files.find((f) => f.id === id);
      if (file) setPreviewFile(file);
    }
  }, [files]);

  const handleEditorKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === '@' && !e.nativeEvent.isComposing) {
      const md = editorRef.current?.getMarkdown() ?? editingMarkdown;
      const last = md.slice(-1);
      // 仅在行首或 @ 前为空白时触发，避免劫持邮箱等正常 @
      if (md.length === 0 || last === '' || /\s/.test(last)) {
        // 阻止 @ 实际写入编辑器，避免后续出现游离的 @ 字符
        e.preventDefault();
        setMentionSearch('');
        mentionActiveRef.current = true;
        setMentionPickerOpen(true);
      }
    }
  }, [editingMarkdown]);

  const noteEditorPlugins = useMemo(() => createEditorPlugins(openToolbarAi, openMentionPicker), [openToolbarAi, openMentionPicker]);

  const showEditorOnMobile = !!selectedNote || editingId;

  return (
    <div className="flex h-full">
      <div className={`${showEditorOnMobile ? 'hidden md:flex' : 'flex'} w-full md:w-72 border-r border-ink-800/50 flex-col flex-shrink-0`}>
        <div className="p-4 border-b border-ink-800/50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-lg font-semibold text-parchment-100">笔记</h2>
            <button
              onClick={() => setShowNew(true)}
              className="p-1.5 rounded-lg hover:bg-ink-800 text-parchment-400 hover:text-gold-400 transition-colors"
              title="新建笔记"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-parchment-400">{notes.length} 篇笔记</p>
        </div>

        {showNew && (
          <div className="p-3 border-b border-ink-800/50 animate-slide-in-up">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="笔记标题..."
              className="input-field text-sm mb-2"
              autoFocus
            />
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="用 Markdown 开始写作..."
              className="input-field text-sm h-24 resize-none"
            />
            <div className="flex gap-2 mt-2">
              <button onClick={handleCreate} className="btn-primary text-xs px-3 py-1.5">创建</button>
              <button onClick={() => setShowNew(false)} className="btn-ghost text-xs px-3 py-1.5">取消</button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {notes.map((note) => (
            <div
              key={note.id}
              onClick={() => {
                setSelectedNote(note.id);
                resetSelectionActions();
              }}
              className={`p-3 border-b border-ink-800/30 cursor-pointer transition-colors ${
                selectedNote === note.id ? 'bg-forest-800/20 border-l-2 border-l-gold-400' : 'hover:bg-ink-800/30'
              }`}
            >
              <p className="text-sm font-medium text-parchment-100 truncate">{note.title}</p>
              <p className="text-xs text-parchment-400 mt-1 line-clamp-2">{getPlainText(note.content).slice(0, 80) || '空笔记'}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-ink-500">{new Date(note.updatedAt).toLocaleDateString('zh-CN')}</span>
                {note.tags.slice(0, 2).map((tag) => (<span key={tag} className="tag text-[10px]">{tag}</span>))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`${showEditorOnMobile ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
        {currentNote ? (
          <>
            <div className="p-3 sm:p-4 border-b border-ink-800/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <button onClick={handleBackToList} className="md:hidden p-1.5 rounded-md hover:bg-ink-700/50 text-parchment-400" title="返回">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                {editingId === currentNote.id ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="input-field text-lg font-serif font-bold flex-1"
                  />
                ) : (
                  <h1 className="font-serif text-lg sm:text-xl font-bold text-parchment-100 truncate">{currentNote.title}</h1>
                )}
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                {editingId === currentNote.id ? (
                  <>
                    <button onClick={saveEdit} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                      <Save className="w-3 h-3" /> 保存
                    </button>
                    <button onClick={() => setEditingId(null)} className="btn-ghost text-xs px-3 py-1.5">取消</button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setDeleteConfirmingNoteId(null);
                        showSnapshots ? setShowSnapshots(false) : loadSnapshots(currentNote.id);
                      }}
                      className="p-2 rounded-lg hover:bg-ink-800 text-parchment-400 hover:text-gold-400 transition-colors"
                      title="历史版本"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteConfirmingNoteId(null);
                        startEdit(currentNote.id);
                      }}
                      className="p-2 rounded-lg hover:bg-ink-800 text-parchment-400 hover:text-gold-400 transition-colors"
                      title="编辑"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmingNoteId(currentNote.id)}
                      className="p-2 rounded-lg hover:bg-ink-800 text-parchment-400 hover:text-red-400 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {showSnapshots && (
              <div className="border-b border-ink-800/50 bg-ink-900/45 px-3 sm:px-4 py-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <p className="text-xs font-semibold text-parchment-200">最近 7 天每日快照</p>
                    <p className="text-[10px] text-parchment-500">每天只保留最后一次保存的版本，可恢复到任一天</p>
                  </div>
                  <button onClick={() => loadSnapshots(currentNote.id)} className="btn-ghost !px-2 !py-1 !text-[10px]" disabled={snapshotsLoading}>
                    {snapshotsLoading ? '加载中' : '刷新'}
                  </button>
                </div>
                {snapshots.length === 0 ? (
                  <p className="rounded-lg bg-ink-800/35 px-3 py-2 text-xs text-ink-500">暂无可回退的快照</p>
                ) : (
                  <div className="max-h-44 overflow-y-auto space-y-2">
                    {snapshots.map((snapshot) => (
                      <button
                        key={snapshot.id}
                        type="button"
                        onClick={() => restoreSnapshot(snapshot)}
                        disabled={restoringSnapshotId !== null}
                        className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          previewSnapshot?.id === snapshot.id
                            ? 'border-gold-400/45 bg-gold-400/10'
                            : 'border-transparent bg-ink-800/35 hover:border-ink-700/70 hover:bg-ink-800/55'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-parchment-200 truncate">{snapshot.title}</p>
                          <p className="text-[10px] text-ink-500 mt-0.5">
                            {String(snapshot.snapshotDate).slice(0, 10)} 最终版 · {new Date(snapshot.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-[10px] text-parchment-500 mt-1 line-clamp-2">{getPlainText(snapshot.content).slice(0, 120) || '空笔记'}</p>
                        </div>
                        {previewSnapshot?.id === snapshot.id && (
                          <span className="mt-0.5 rounded-md bg-gold-400/15 px-2 py-1 text-[10px] text-gold-200">
                            已选中
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className={`flex-1 relative ${previewSnapshot ? 'overflow-hidden' : 'overflow-y-auto'}`}>
              {!previewSnapshot && (editingId === currentNote.id ? (
                <div ref={editorShellRef} onMouseUp={handleEditorMouseUp} onClick={handleEditorClick} onKeyDown={handleEditorKeyDown} className="min-h-full mdx-notes-editor">
                  <MDXEditor
                    key={editingId}
                    ref={editorRef}
                    markdown={editingMarkdown}
                    onChange={(value) => setEditingMarkdown(value)}
                    plugins={noteEditorPlugins}
                    placeholder="开始写作..."
                    className="dark-theme"
                    translation={translateMdxEditor}
                    contentEditableClassName="prose-notes mdx-notes-content"
                  />

                  {selectionPopup.show && (
                    <div
                      className="fixed z-50 animate-fade-in"
                      style={{ left: selectionPopup.x, top: selectionPopup.y, transform: 'translate(-50%, -100%)' }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onMouseUp={(e) => e.stopPropagation()}
                    >
                      {aiResult ? (
                        <div className="bg-ink-900 border border-ink-700/50 rounded-xl shadow-xl shadow-black/40 p-3 w-[min(380px,calc(100vw-32px))] animate-fade-in">
                          <div className="max-h-56 overflow-y-auto rounded-lg bg-ink-950/50 border border-ink-700/40 p-3 text-xs text-parchment-200">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {aiResult}
                            </ReactMarkdown>
                          </div>
                          {aiError && (
                            <div className="mt-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                              {aiError}
                            </div>
                          )}
                          {aiResultKind === 'chat' ? (
                            <div className="flex gap-2 mt-3">
                              <button onClick={appendAiResult} className="btn-primary text-xs px-3 py-1.5 flex-1">
                                插入到笔记
                              </button>
                              <button onClick={resetSelectionActions} className="btn-ghost text-xs px-3 py-1.5">
                                关闭
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 mt-3">
                              <button onClick={replaceSelectionWithAiResult} className="btn-primary text-xs px-3 py-1.5">
                                替换选中
                              </button>
                              <button onClick={insertAiResultBelowSelection} className="btn-ghost text-xs px-3 py-1.5">
                                插入下方
                              </button>
                              <button onClick={appendAiResult} className="btn-ghost text-xs px-3 py-1.5">
                                追加末尾
                              </button>
                              <button
                                onClick={() => runNoteAssist(lastAiMode || 'custom', aiResultKind)}
                                disabled={!!aiLoadingMode || ((lastAiMode || 'custom') === 'custom' && !aiInstruction.trim())}
                                className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-50"
                              >
                                {aiLoadingMode ? '生成中...' : '重新生成'}
                              </button>
                            </div>
                          )}
                          <button onClick={resetSelectionActions} className="mt-2 w-full text-[11px] text-parchment-500 hover:text-parchment-300">
                            取消
                          </button>
                        </div>
                      ) : aiPromptOpen ? (
                        <div className="bg-ink-900 border border-ink-700/50 rounded-xl shadow-xl shadow-black/40 p-3 w-[min(340px,calc(100vw-32px))] animate-fade-in">
                          <div className="flex items-center gap-1.5 text-xs text-gold-300 mb-2">
                            <Bot className="w-3.5 h-3.5" />
                            Ask AI
                          </div>
                          <textarea
                            value={aiInstruction}
                            onChange={(e) => setAiInstruction(e.target.value)}
                            placeholder="告诉 AI 你想怎么改这段..."
                            className="input-field w-full h-20 resize-none text-xs"
                            autoFocus
                          />
                          {aiError && (
                            <div className="mt-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                              {aiError}
                            </div>
                          )}
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={runSelectionAskAi}
                              disabled={!!aiLoadingMode || !aiInstruction.trim()}
                              className="btn-primary text-xs px-3 py-1.5 flex-1 flex items-center justify-center gap-1 disabled:opacity-50"
                            >
                              {aiLoadingMode === 'custom' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                              生成
                            </button>
                            <button onClick={resetSelectionActions} className="btn-ghost text-xs px-3 py-1.5">
                              取消
                            </button>
                          </div>
                        </div>
                      ) : todoForm.show ? (
                        <div
                          className="bg-ink-900 border border-ink-700/50 rounded-xl shadow-xl shadow-black/40 p-4 w-64 animate-fade-in"
                        >
                          <p className="text-xs text-parchment-400 mb-3 truncate" title={selectionPopup.text}>
                            "{selectionPopup.text.slice(0, 40)}{selectionPopup.text.length > 40 ? '...' : ''}"
                          </p>

                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs text-parchment-400">优先级</span>
                            <div className="flex gap-1">
                              {(['low', 'medium', 'high', 'urgent'] as const).map((priority) => (
                                <button
                                  key={priority}
                                  onClick={() => setTodoForm({ ...todoForm, priority })}
                                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                                    todoForm.priority === priority
                                      ? priority === 'urgent' || priority === 'high'
                                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                        : priority === 'medium'
                                          ? 'bg-gold-400/20 text-gold-300 border border-gold-400/30'
                                          : 'bg-forest-400/20 text-forest-200 border border-forest-400/30'
                                      : 'bg-ink-800/60 text-parchment-400 border border-ink-700/30 hover:text-parchment-200'
                                  }`}
                                >
                                  {priority === 'urgent' ? '紧急' : priority === 'high' ? '高' : priority === 'medium' ? '中' : '低'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mb-3">
                            <Clock className="w-3.5 h-3.5 text-parchment-400" />
                            <input
                              type="date"
                              value={todoForm.dueDate}
                              onChange={(e) => setTodoForm({ ...todoForm, dueDate: e.target.value })}
                              className="input-field !w-auto !py-1 !text-xs flex-1"
                            />
                          </div>

                          <div className="flex gap-2">
                            <button onClick={handleCreateTodoFromSelection} className="btn-primary text-xs px-3 py-1.5 flex-1">确认</button>
                            <button onClick={resetSelectionActions} className="btn-ghost text-xs px-3 py-1.5">取消</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 rounded-xl bg-ink-900 border border-ink-700/50 shadow-xl shadow-black/40 p-1">
                          <button
                            onClick={() => setAiPromptOpen(true)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gold-300 hover:bg-gold-400/10 transition-colors"
                          >
                            <Bot className="w-3.5 h-3.5" />
                            Ask AI
                          </button>
                          <button
                            onClick={() => runNoteAssist('polish')}
                            disabled={!!aiLoadingMode}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-parchment-300 hover:bg-ink-800 disabled:opacity-60 transition-colors"
                          >
                            {aiLoadingMode === 'polish' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                            润色
                          </button>
                          <button
                            onClick={() => runNoteAssist('summarize')}
                            disabled={!!aiLoadingMode}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-parchment-300 hover:bg-ink-800 disabled:opacity-60 transition-colors"
                          >
                            {aiLoadingMode === 'summarize' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <StickyNote className="w-3.5 h-3.5" />}
                            总结
                          </button>
                          <button
                            onClick={() => runNoteAssist('actions')}
                            disabled={!!aiLoadingMode}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-parchment-300 hover:bg-ink-800 disabled:opacity-60 transition-colors"
                          >
                            {aiLoadingMode === 'actions' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListTodo className="w-3.5 h-3.5" />}
                            行动项
                          </button>
                          <button
                            onClick={() => setTodoForm({ ...todoForm, show: true })}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-parchment-300 hover:bg-ink-800 transition-colors"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            待办
                          </button>
                        </div>
                      )}
                      <div className="w-2 h-2 bg-gold-500 rotate-45 mx-auto -mt-1" />
                    </div>
                  )}

                  {activeSlashAiCommand && !selectionPopup.show && (
                    <div
                      className="mx-4 sm:mx-6 mb-6 -mt-2 animate-slide-in-up"
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >
                      <div className="rounded-xl border border-gold-400/20 bg-ink-900/95 shadow-xl shadow-black/30 p-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gold-400/10 text-gold-300 flex-shrink-0">
                            <Bot className="w-3.5 h-3.5" />
                            <span className="text-xs font-mono">/ai</span>
                          </div>
                          <input
                            ref={slashAiInputRef}
                            value={activeSlashAiCommand.instruction}
                            onChange={(e) => updateSlashAiInstruction(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                runSlashAiCommand();
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                handleSlashAiEscape();
                              }
                            }}
                            placeholder="输入要让 AI 做的事..."
                            className="flex-1 min-w-0 bg-transparent text-sm text-parchment-100 placeholder:text-parchment-500 outline-none"
                            autoFocus
                          />
                          <button
                            onClick={runSlashAiCommand}
                            disabled={!!aiLoadingMode || !activeSlashAiCommand.instruction.trim()}
                            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-60"
                          >
                            {aiLoadingMode === 'slash' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                            执行
                          </button>
                        </div>
                        <div className="mt-2 flex items-center gap-1 rounded-lg border border-ink-700/40 bg-ink-950/30 p-1 w-fit max-w-full">
                          {([
                            ['auto', '自动'],
                            ['command', '编辑笔记'],
                            ['ask', '问答'],
                          ] as const).map(([mode, label]) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => changeSlashAiMode(mode)}
                              className={`rounded-md px-2.5 py-1 text-[11px] transition-colors ${
                                slashAiMode === mode
                                  ? 'bg-gold-400/15 text-gold-200'
                                  : 'text-parchment-400 hover:bg-ink-800/70 hover:text-parchment-200'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {activeSlashAiCommand.selectionText && (
                          <div className="mt-2 rounded-lg border border-gold-400/15 bg-gold-400/5 px-2.5 py-1.5 text-[11px] text-parchment-300">
                            已选中 {activeSlashAiCommand.selectionText.length} 字，当前 AI 会优先针对这段内容。
                          </div>
                        )}
                        {!slashAiResult && !slashAiConfirm && (
                          <div className="mt-3 flex flex-wrap gap-1.5 px-0.5">
                            {slashAiCommandSuggestions.map((suggestion) => (
                              <button
                                key={suggestion.command}
                                type="button"
                                onClick={() => selectSlashAiSuggestion(suggestion.command)}
                                className="group max-w-full rounded-lg border border-ink-700/50 bg-ink-950/40 px-2.5 py-1.5 text-left text-xs text-parchment-300 transition-colors hover:border-gold-400/40 hover:bg-gold-400/10 hover:text-gold-200"
                                title={suggestion.command}
                              >
                                <span className="mr-1.5 text-[10px] text-gold-400/80">{suggestion.label}</span>
                                <span className="align-middle">{suggestion.command}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {slashAiError && (
                          <p className="text-xs text-red-300 mt-2 px-2">{slashAiError}</p>
                        )}
                        {slashAiConfirm && (
                          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                            <p className="text-xs text-red-200">{slashAiConfirm.message}</p>
                            <div className="flex gap-2 mt-3">
                              <button onClick={confirmSlashAiDangerAction} className="bg-red-500 hover:bg-red-400 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                                确认删除
                              </button>
                              <button onClick={() => setSlashAiConfirm(null)} className="btn-ghost text-xs px-3 py-1.5">
                                取消
                              </button>
                            </div>
                          </div>
                        )}
                        {slashAiResult && (
                          <div className="mt-3">
                            <div className="max-h-56 overflow-y-auto rounded-lg bg-ink-950/50 border border-ink-700/40 p-3 text-xs text-parchment-200">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {slashAiResult}
                              </ReactMarkdown>
                            </div>
                            <div className="flex gap-2 mt-2">
                              {activeSlashAiCommand.selectionText && slashAiResultKind !== 'chat' && (
                                <button onClick={replaceSelectionWithSlashAiResult} className="btn-primary text-xs px-3 py-1.5">
                                  替换选中
                                </button>
                              )}
                              <button onClick={insertSlashAiResult} className="btn-primary text-xs px-3 py-1.5">
                                {slashAiResultKind === 'chat' ? '插入到笔记' : '插入到笔记'}
                              </button>
                              <button onClick={closeSlashAiCommand} className="btn-ghost text-xs px-3 py-1.5">
                                关闭
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="prose-notes p-4 sm:p-6">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    urlTransform={(url) =>
                      url.startsWith(FILE_MENTION_SCHEME)
                        ? url
                        : /^(javascript|data|vbscript):/i.test(url)
                          ? '#'
                          : defaultUrlTransform(url)
                    }
                    components={{
                      a: ({ children, href, ...props }) => {
                        if (href && href.startsWith(FILE_MENTION_SCHEME)) {
                          const id = href.slice(FILE_MENTION_SCHEME.length);
                          const file = files.find((f) => f.id === id);
                          return (
                            <button
                              type="button"
                              onClick={() => file && setPreviewFile(file)}
                              title={file ? `预览 ${file.name}` : '文件已删除'}
                              className="mx-0.5 inline-flex items-center gap-1 align-baseline rounded bg-ink-800/70 px-1.5 py-0.5 text-[0.85em] text-parchment-100 no-underline hover:bg-ink-700"
                            >
                              <Paperclip className="w-3 h-3" />
                              <span className="max-w-[12rem] truncate">{file ? file.name : String(children)}</span>
                            </button>
                          );
                        }
                        return (
                          <a {...props} href={href} target="_blank" rel="noreferrer">
                            {children}
                          </a>
                        );
                      },
                    }}
                  >
                    {currentMarkdown}
                  </ReactMarkdown>
                </div>
              ))}

              {previewSnapshot && (
                <div className="flex h-full min-h-0 flex-col bg-ink-950/35">
                  <div className="border-b border-ink-800/70 bg-ink-950/45">
                    <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="font-medium text-parchment-200">快照 diff</span>
                        <span className="text-parchment-500">{String(previewSnapshot.snapshotDate).slice(0, 10)}</span>
                        <span className="min-w-0 truncate text-parchment-500" title={`${currentNote.title} / ${previewSnapshot.title}`}>
                          {currentNote.title !== previewSnapshot.title ? `${currentNote.title} / ${previewSnapshot.title}` : currentNote.title}
                        </span>
                        <span className="rounded bg-green-400/10 px-1.5 py-0.5 text-[10px] text-green-200">+{snapshotPreviewStats.added}</span>
                        <span className="rounded bg-red-400/10 px-1.5 py-0.5 text-[10px] text-red-200">-{snapshotPreviewStats.removed}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex w-fit rounded-md border border-ink-700/50 bg-ink-950/45 p-0.5 text-[11px]">
                          {([
                            ['side-by-side', 'Side by side'],
                            ['inline', 'Inline'],
                          ] as const).map(([mode, label]) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setSnapshotDiffViewMode(mode)}
                              className={`rounded px-2 py-1 transition-colors ${
                                snapshotDiffViewMode === mode
                                  ? 'bg-gold-400/15 text-gold-200'
                                  : 'text-parchment-400 hover:bg-ink-800/70 hover:text-parchment-200'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {(editingId === currentNote.id ? editTitle : currentNote.title) !== previewSnapshot.title && (
                        <div className="grid gap-2 rounded-lg border border-ink-700/50 bg-ink-950/35 p-3 text-xs sm:col-span-2">
                          <div className="min-w-0">
                            <span className="text-red-300">- 当前标题：</span>
                            <span className="text-parchment-300 break-words">{editingId === currentNote.id ? editTitle : currentNote.title}</span>
                          </div>
                          <div className="min-w-0">
                            <span className="text-forest-200">+ 快照标题：</span>
                            <span className="text-parchment-300 break-words">{previewSnapshot.title}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-auto bg-ink-950/35 p-3 font-mono text-[11px] leading-5 sm:text-xs">
                      {snapshotPreviewDiff.length === 0 ? (
                        <p className="rounded-lg bg-ink-900/70 px-3 py-2 font-sans text-xs text-parchment-500">
                          内容没有差异，确认后仍会恢复该快照的标题和更新时间。
                        </p>
                      ) : snapshotDiffViewMode === 'side-by-side' ? (
                        <div className="min-w-[640px] overflow-hidden rounded-lg border border-ink-800/70">
                          <div className="grid grid-cols-2 border-b border-ink-800/70 bg-ink-900/80 font-sans text-[11px] text-parchment-400">
                            <div className="border-r border-ink-800/70 px-3 py-2">当前内容</div>
                            <div className="px-3 py-2">回滚后内容</div>
                          </div>
                          {snapshotSideBySideDiff.map((row, index) => {
                            const isEdited = row.left?.type === 'removed' && row.right?.type === 'added';
                            return (
                              <div key={`side-${index}`} className="grid grid-cols-2 border-b border-ink-900/70 last:border-b-0">
                                <div
                                  className={`min-h-6 border-r border-ink-800/70 px-3 py-1 whitespace-pre-wrap break-words ${getSideBySideSnapshotDiffCellClass(row.left, isEdited)}`}
                                >
                                  {row.left?.text || ' '}
                                </div>
                                <div
                                  className={`min-h-6 px-3 py-1 whitespace-pre-wrap break-words ${getSideBySideSnapshotDiffCellClass(row.right, isEdited)}`}
                                >
                                  {row.right?.text || ' '}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        snapshotPreviewDiff.map((line, index) => {
                          const isEdited = isEditedSnapshotDiffLine(snapshotPreviewDiff, index);
                          return (
                            <div
                              key={`${line.type}-${index}`}
                              className={`grid grid-cols-[1.5rem_1fr] gap-2 rounded px-2 py-0.5 ${getInlineSnapshotDiffLineClass(line, isEdited)}`}
                            >
                              <span className="select-none text-center opacity-80">
                                {isEdited ? '~' : line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                              </span>
                              <span className="whitespace-pre-wrap break-words">{line.text || ' '}</span>
                            </div>
                          );
                        })
                      )}
                  </div>

                  <div className="border-t border-ink-800/70 bg-ink-900/80 p-3 sm:p-4">
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                      <button
                        onClick={() => {
                          setPreviewSnapshot(null);
                          setRestoreConfirmingSnapshotId(null);
                        }}
                        disabled={restoringSnapshotId !== null}
                        className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-50"
                      >
                        取消
                      </button>
                      <button
                        onClick={() => setRestoreConfirmingSnapshotId(previewSnapshot.id)}
                        disabled={restoringSnapshotId !== null}
                        className="btn-primary text-xs px-3 py-1.5 inline-flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <RotateCcw className="w-3 h-3" />
                        回滚
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {!previewSnapshot && (
              <div className="p-3 sm:p-4 border-t border-ink-800/50">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-parchment-400">
                  <span>创建于 {new Date(currentNote.createdAt).toLocaleString('zh-CN')}</span>
                  <span>更新于 {new Date(currentNote.updatedAt).toLocaleString('zh-CN')}</span>
                  <div className="flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {currentNote.tags.map((tag) => (<span key={tag} className="tag text-[10px]">{tag}</span>))}
                  </div>
                </div>
              </div>
            )}

            {previewSnapshot && restoreConfirmingSnapshotId === previewSnapshot.id && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/75 p-4 backdrop-blur-sm">
                <div className="w-full max-w-sm rounded-xl border border-red-500/30 bg-ink-900 p-4 shadow-2xl shadow-black/50">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-red-500/15 p-2 text-red-300">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-parchment-100">确认回滚快照</p>
                      <p className="mt-1 text-xs leading-5 text-parchment-400">
                        要回滚到 {String(previewSnapshot.snapshotDate).slice(0, 10)} 的快照吗？当前内容会被快照内容覆盖。
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      onClick={() => setRestoreConfirmingSnapshotId(null)}
                      disabled={restoringSnapshotId !== null}
                      className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-50"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => restoreSnapshot(previewSnapshot, true)}
                      disabled={restoringSnapshotId !== null}
                      className="bg-red-500 hover:bg-red-400 text-white text-xs px-3 py-1.5 rounded-lg inline-flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                    >
                      {restoringSnapshotId === previewSnapshot.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                      确认回滚
                    </button>
                  </div>
                </div>
              </div>
            )}

            {deleteConfirmingNoteId === currentNote.id && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/75 p-4 backdrop-blur-sm">
                <div className="w-full max-w-sm rounded-xl border border-red-500/30 bg-ink-900 p-4 shadow-2xl shadow-black/50">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-red-500/15 p-2 text-red-300">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-parchment-100">确认删除笔记</p>
                      <p className="mt-1 text-xs leading-5 text-parchment-400">
                        要删除“{currentNote.title}”吗？这篇笔记和它的快照都会被删除。
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      onClick={() => setDeleteConfirmingNoteId(null)}
                      className="btn-ghost text-xs px-3 py-1.5"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => {
                        deleteNote(currentNote.id);
                        setSelectedNote(null);
                        setDeleteConfirmingNoteId(null);
                      }}
                      className="bg-red-500 hover:bg-red-400 text-white text-xs px-3 py-1.5 rounded-lg inline-flex items-center justify-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      确认删除
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-4">
              <StickyNote className="w-12 h-12 sm:w-16 sm:h-16 text-ink-700 mx-auto mb-4" />
              <p className="text-parchment-400">选择一篇笔记开始阅读</p>
              <p className="text-xs text-ink-500 mt-1">或创建新笔记开始写作</p>
            </div>
          </div>
        )}
      </div>

    {mentionPickerOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-0 animate-fade-in">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeMentionPicker} />
        <div className="relative w-full max-w-lg glass-card rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 border-b border-ink-700/50 px-3 py-2.5">
            <Search className="w-4 h-4 text-parchment-400" />
            <input
              autoFocus
              value={mentionSearch}
              onChange={(e) => setMentionSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') closeMentionPicker();
                if (e.key === 'Enter' && mentionFiles[0]) selectMention(mentionFiles[0]);
              }}
              placeholder="搜索文件并插入到笔记…"
              className="flex-1 bg-transparent text-sm text-parchment-100 placeholder:text-parchment-500 outline-none"
            />
            <button
              onClick={closeMentionPicker}
              className="text-parchment-400 hover:text-parchment-200 text-sm"
              title="关闭"
            >
              ✕
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {mentionFiles.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-parchment-500">没有匹配的文件</p>
            ) : (
              mentionFiles.map((file) => (
                <button
                  key={file.id}
                  onClick={() => selectMention(file)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-parchment-200 hover:bg-ink-700/50"
                >
                  <FileIcon className="w-4 h-4 text-parchment-400 flex-shrink-0" />
                  <span className="truncate">{file.name}</span>
                  <span className="ml-auto text-[10px] uppercase text-parchment-500">{file.name.split('.').pop()}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    )}

    {previewFile && previewFile.url && (
      <FilePreview url={previewFile.url} name={previewFile.name} onClose={() => setPreviewFile(null)} />
    )}
    </div>
  );
}
