import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCellValue, usePublisher } from '@mdxeditor/gurx';
import { $createParagraphNode } from 'lexical';
import { useAppStore } from '@/stores/useAppStore';
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
  CheckSquare,
  Clock,
  Edit3,
  Eraser,
  Plus,
  Save,
  StickyNote,
  Tag,
  Trash2,
} from 'lucide-react';

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

const editorPlugins = [
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
      </>
    ),
  }),
];

export default function Notes() {
  const { notes, addNote, updateNote, deleteNote, addTodo } = useAppStore();
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

  const editorRef = useRef<MDXEditorMethods>(null);
  const editorShellRef = useRef<HTMLDivElement>(null);
  const currentNote = notes.find((n) => n.id === selectedNote);
  const currentMarkdown = useMemo(() => normalizeNoteContent(currentNote?.content || ''), [currentNote?.content]);

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

  const resetSelectionActions = useCallback(() => {
    setSelectionPopup({ show: false, x: 0, y: 0, text: '' });
    setTodoForm({ show: false, priority: 'medium', dueDate: '' });
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
    resetSelectionActions();
  };

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

            <div className="flex-1 overflow-y-auto relative">
              {editingId === currentNote.id ? (
                <div ref={editorShellRef} onMouseUp={handleEditorMouseUp} className="min-h-full mdx-notes-editor">
                  <MDXEditor
                    key={editingId}
                    ref={editorRef}
                    markdown={editingMarkdown}
                    onChange={(value) => setEditingMarkdown(value)}
                    plugins={editorPlugins}
                    placeholder="开始写作..."
                    className="dark-theme"
                    translation={translateMdxEditor}
                    contentEditableClassName="prose-notes mdx-notes-content"
                  />

                  {selectionPopup.show && (
                    <div
                      className="fixed z-50 animate-fade-in"
                      style={{ left: selectionPopup.x, top: selectionPopup.y, transform: 'translate(-50%, -100%)' }}
                    >
                      {!todoForm.show ? (
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setTodoForm({ ...todoForm, show: true })}
                          className="flex items-center gap-1.5 px-3 py-2 bg-gold-500 hover:bg-gold-400 text-ink-950 text-xs font-medium rounded-lg shadow-lg shadow-black/30 transition-colors"
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          创建待办
                        </button>
                      ) : (
                        <div
                          className="bg-ink-900 border border-ink-700/50 rounded-xl shadow-xl shadow-black/40 p-4 w-64 animate-fade-in"
                          onMouseDown={(e) => e.preventDefault()}
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
                      )}
                      <div className="w-2 h-2 bg-gold-500 rotate-45 mx-auto -mt-1" />
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
