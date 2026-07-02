import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCellValue, usePublisher } from '@mdxeditor/gurx';
import { $createParagraphNode } from 'lexical';
import { useAppStore } from '@/stores/useAppStore';
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
} from 'lucide-react';
import type { NoteSnapshot } from '@/types';

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

function createEditorPlugins(onStartAiCommand: () => void) {
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
        <ButtonWithTooltip title="AI 编辑" aria-label="AI 编辑" onClick={onStartAiCommand}>
          <Bot className="w-4 h-4" />
        </ButtonWithTooltip>
      </>
    ),
  }),
  ];
}

type AiAssistMode = 'polish' | 'continue' | 'summarize' | 'actions' | 'custom' | 'chat';
type AiResultKind = 'edit' | 'chat';
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
  const { notes, addNote, updateNote, deleteNote, addTodo, addChatMessage } = useAppStore();
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
  const [slashAiConfirm, setSlashAiConfirm] = useState<{ action: 'deleteAll'; message: string } | null>(null);
  const [dismissedSlashAiStart, setDismissedSlashAiStart] = useState<number | null>(null);
  const [toolbarSlashAiStart, setToolbarSlashAiStart] = useState<number | null>(null);
  const [snapshots, setSnapshots] = useState<NoteSnapshot[]>([]);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [restoringSnapshotId, setRestoringSnapshotId] = useState<string | null>(null);

  const editorRef = useRef<MDXEditorMethods>(null);
  const editorShellRef = useRef<HTMLDivElement>(null);
  const slashAiEscAtRef = useRef(0);
  const currentNote = notes.find((n) => n.id === selectedNote);
  const currentMarkdown = useMemo(() => normalizeNoteContent(currentNote?.content || ''), [currentNote?.content]);
  const slashAiCommand = useMemo(() => {
    const match = editingMarkdown.match(/(?:^|\n)(\/ai(?:\s+([^\n]*))?)$/i);
    if (!match) return null;

    const fullCommand = match[1];
    const instruction = (match[2] || '').trim();

    return {
      fullCommand,
      instruction,
      start: editingMarkdown.length - fullCommand.length,
    };
  }, [editingMarkdown]);
  const activeSlashAiCommand = dismissedSlashAiStart === slashAiCommand?.start ? null : slashAiCommand;

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
    setSlashAiConfirm(null);
    setDismissedSlashAiStart(null);
    setToolbarSlashAiStart(null);
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

  const restoreSnapshot = useCallback(async (snapshot: NoteSnapshot) => {
    if (!currentNote || restoringSnapshotId) return;
    const confirmed = window.confirm(`确定回退到 ${String(snapshot.snapshotDate).slice(0, 10)} 的最终版本吗？回退后，今天的快照会更新为恢复后的内容。`);
    if (!confirmed) return;
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
      show: true,
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
      const content = selectionPopup.text && target === 'selection'
        ? `${trimmed}\n\n选中文本：\n${selectionPopup.text}`
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
  }, [addChatMessage, aiLoadingMode, currentNote, selectionPopup.text]);

  const runSelectionAskAi = useCallback(() => {
    const intent = classifySlashAiIntent(aiInstruction);
    if (intent.type === 'smalltalk') {
      setAiResultKind('chat');
      setAiResult(getSmallTalkReply(aiInstruction));
      setAiError('');
      return;
    }
    if (intent.type === 'chat') {
      runNoteChat(aiInstruction, 'selection');
      return;
    }
    runNoteAssist('custom', 'edit');
  }, [aiInstruction, runNoteAssist, runNoteChat]);

  const updateEditorMarkdown = useCallback((nextMarkdown: string) => {
    setEditingMarkdown(nextMarkdown);
    editorRef.current?.setMarkdown(nextMarkdown);
  }, []);

  const appendAiResult = useCallback(() => {
    if (!aiResult.trim()) return;
    const nextMarkdown = `${editingMarkdown.trimEnd()}\n\n${aiResult.trim()}`.trimStart();
    updateEditorMarkdown(nextMarkdown);
    resetSelectionActions();
  }, [aiResult, editingMarkdown, resetSelectionActions, updateEditorMarkdown]);

  const insertAiResultBelowSelection = useCallback(() => {
    if (!aiResult.trim()) return;
    if (!selectionPopup.text || !editingMarkdown.includes(selectionPopup.text)) {
      appendAiResult();
      return;
    }
    const nextMarkdown = editingMarkdown.replace(
      selectionPopup.text,
      `${selectionPopup.text}\n\n${aiResult.trim()}`
    );
    updateEditorMarkdown(nextMarkdown);
    resetSelectionActions();
  }, [aiResult, appendAiResult, editingMarkdown, resetSelectionActions, selectionPopup.text, updateEditorMarkdown]);

  const replaceSelectionWithAiResult = useCallback(() => {
    if (!aiResult.trim() || !selectionPopup.text) return;
    const nextMarkdown = editingMarkdown.includes(selectionPopup.text)
      ? editingMarkdown.replace(selectionPopup.text, aiResult.trim())
      : `${editingMarkdown.trimEnd()}\n\n${aiResult.trim()}`;
    updateEditorMarkdown(nextMarkdown);
    resetSelectionActions();
  }, [aiResult, editingMarkdown, resetSelectionActions, selectionPopup.text, updateEditorMarkdown]);

  const insertSlashAiResult = useCallback(() => {
    if (!slashAiResult.trim() || !activeSlashAiCommand) return;
    const contentBeforeCommand = editingMarkdown.slice(0, activeSlashAiCommand.start).trimEnd();
    const nextMarkdown = contentBeforeCommand
      ? `${contentBeforeCommand}\n\n${slashAiResult.trim()}`
      : slashAiResult.trim();
    updateEditorMarkdown(nextMarkdown);
    resetSelectionActions();
  }, [activeSlashAiCommand, editingMarkdown, resetSelectionActions, slashAiResult, updateEditorMarkdown]);

  const confirmSlashAiDangerAction = useCallback(() => {
    if (!slashAiConfirm || slashAiConfirm.action !== 'deleteAll') return;
    updateEditorMarkdown('');
    resetSelectionActions();
  }, [resetSelectionActions, slashAiConfirm, updateEditorMarkdown]);

  const runSlashAiCommand = useCallback(async () => {
    if (!currentNote || !activeSlashAiCommand || aiLoadingMode) return;
    if (!activeSlashAiCommand.instruction.trim()) {
      setSlashAiError('先输入要让 AI 做什么');
      return;
    }

    const instruction = activeSlashAiCommand.instruction.trim();
    const intent = classifySlashAiIntent(instruction);
    const contentBeforeCommand = editingMarkdown.slice(0, activeSlashAiCommand.start).trimEnd();
    setSlashAiError('');
    setSlashAiResult('');
    setSlashAiConfirm(null);

    if (intent.type === 'tool' && intent.tool === 'divider') {
      const nextMarkdown = contentBeforeCommand ? `${contentBeforeCommand}\n\n---` : '---';
      updateEditorMarkdown(nextMarkdown);
      resetSelectionActions();
      return;
    }

    if (intent.type === 'tool' && intent.tool === 'deleteAll') {
      setSlashAiConfirm({ action: 'deleteAll', message: '确认删除当前笔记的全部内容吗？这个操作会清空正文。' });
      return;
    }

    if (intent.type === 'smalltalk') {
      setSlashAiResultKind('chat');
      setSlashAiResult(getSmallTalkReply(instruction));
      return;
    }

    if (intent.type === 'chat') {
      await runNoteChat(instruction, 'slash');
      return;
    }

    setAiLoadingMode('slash');
    try {
      const mode: AiAssistMode = intent.type === 'tool' && intent.tool === 'summarizeDocument'
        ? 'summarize'
        : 'custom';
      const resultKind: AiResultKind = 'edit';
      const result = await api.assistNote({
        mode,
        instruction,
        title: editTitle || currentNote.title,
        content: contentBeforeCommand,
        selection: '',
      });

      setSlashAiResultKind(resultKind);
      setSlashAiResult(result.content.trim());
    } catch (error: any) {
      setSlashAiError(error.message || 'AI 命令执行失败');
    } finally {
      setAiLoadingMode(null);
    }
  }, [activeSlashAiCommand, aiLoadingMode, currentNote, editTitle, editingMarkdown, resetSelectionActions, runNoteChat, updateEditorMarkdown]);

  const updateSlashAiInstruction = useCallback((instruction: string) => {
    if (!activeSlashAiCommand) return;
    const commandLine = instruction.trimStart() ? `/ai ${instruction.trimStart()}` : '/ai';
    const nextMarkdown = `${editingMarkdown.slice(0, activeSlashAiCommand.start)}${commandLine}`;
    updateEditorMarkdown(nextMarkdown);
    setSlashAiError('');
    setSlashAiResult('');
    setSlashAiConfirm(null);
  }, [activeSlashAiCommand, editingMarkdown, updateEditorMarkdown]);

  const closeSlashAiCommand = useCallback(() => {
    if (!activeSlashAiCommand) return;

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
    if (selectionPopup.show || activeSlashAiCommand) {
      if (activeSlashAiCommand) {
        closeSlashAiCommand();
      } else {
        resetSelectionActions();
      }
      return;
    }

    const sel = window.getSelection();
    const selectedText = sel?.toString().trim() || '';

    if (selectedText && sel?.anchorNode && editorShellRef.current?.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectionPopup({
        show: true,
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
        text: selectedText,
      });
      setTodoForm({ show: false, priority: 'medium', dueDate: '' });
      setAiInstruction('');
      setAiResult('');
      setAiError('');
      setLastAiMode(null);
      setSlashAiError('');
      setAiPromptOpen(true);
      return;
    }

    if (selectionPopup.show && selectionPopup.text) {
      setTodoForm({ show: false, priority: 'medium', dueDate: '' });
      setAiInstruction('');
      setAiResult('');
      setAiError('');
      setLastAiMode(null);
      setSlashAiError('');
      setAiPromptOpen(true);
      return;
    }

    insertSlashAiCommand();
  }, [activeSlashAiCommand, closeSlashAiCommand, insertSlashAiCommand, resetSelectionActions, selectionPopup.show, selectionPopup.text]);

  const noteEditorPlugins = useMemo(() => createEditorPlugins(openToolbarAi), [openToolbarAi]);

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
                      onClick={() => showSnapshots ? setShowSnapshots(false) : loadSnapshots(currentNote.id)}
                      className="p-2 rounded-lg hover:bg-ink-800 text-parchment-400 hover:text-gold-400 transition-colors"
                      title="历史版本"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <button onClick={() => startEdit(currentNote.id)} className="p-2 rounded-lg hover:bg-ink-800 text-parchment-400 hover:text-gold-400 transition-colors" title="编辑">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        deleteNote(currentNote.id);
                        setSelectedNote(null);
                      }}
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
                      <div key={snapshot.id} className="flex items-start gap-3 rounded-lg bg-ink-800/35 px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-parchment-200 truncate">{snapshot.title}</p>
                          <p className="text-[10px] text-ink-500 mt-0.5">
                            {String(snapshot.snapshotDate).slice(0, 10)} 最终版 · {new Date(snapshot.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-[10px] text-parchment-500 mt-1 line-clamp-2">{getPlainText(snapshot.content).slice(0, 120) || '空笔记'}</p>
                        </div>
                        <button
                          onClick={() => restoreSnapshot(snapshot)}
                          disabled={restoringSnapshotId !== null}
                          className="btn-ghost !px-2 !py-1 !text-[10px] inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <RotateCcw className="w-3 h-3" />
                          {restoringSnapshotId === snapshot.id ? '恢复中' : '回退'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto relative">
              {editingId === currentNote.id ? (
                <div ref={editorShellRef} onMouseUp={handleEditorMouseUp} className="min-h-full mdx-notes-editor">
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
                      onMouseDown={(e) => e.preventDefault()}
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
                    <div className="mx-4 sm:mx-6 mb-6 -mt-2 animate-slide-in-up">
                      <div className="rounded-xl border border-gold-400/20 bg-ink-900/95 shadow-xl shadow-black/30 p-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gold-400/10 text-gold-300 flex-shrink-0">
                            <Bot className="w-3.5 h-3.5" />
                            <span className="text-xs font-mono">/ai</span>
                          </div>
                          <input
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
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a> }}>
                    {currentMarkdown}
                  </ReactMarkdown>
                </div>
              )}
            </div>

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
    </div>
  );
}
