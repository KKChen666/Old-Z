import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import {
  Plus, StickyNote, Tag, Trash2, Edit3, X, Save,
  Bold, Italic, Underline, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Quote, Code, Palette, Type, ChevronDown, Undo2, Redo2, Minus,
} from 'lucide-react';

const FONT_FAMILIES = [
  { label: '默认', value: '' },
  { label: '宋体', value: 'SimSun, serif' },
  { label: '黑体', value: 'SimHei, sans-serif' },
  { label: '楷体', value: 'KaiTi, serif' },
  { label: '微软雅黑', value: '"Microsoft YaHei", sans-serif' },
  { label: '思源宋体', value: '"Noto Serif SC", serif' },
  { label: '思源黑体', value: '"Noto Sans SC", sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
];

const TEXT_COLORS = [
  { label: '默认', value: '' },
  { label: '灰色', value: '#9a8a5a' },
  { label: '棕色', value: '#a87830' },
  { label: '橙色', value: '#e87a3a' },
  { label: '红色', value: '#e85a5a' },
  { label: '粉色', value: '#e85a9a' },
  { label: '紫色', value: '#9a5ae8' },
  { label: '蓝色', value: '#5a8ae8' },
  { label: '青色', value: '#5ac8c8' },
  { label: '绿色', value: '#5aa85a' },
  { label: '金色', value: '#d4a853' },
  { label: '白色', value: '#f5f0e8' },
];

const HIGHLIGHT_COLORS = [
  { label: '无', value: '' },
  { label: '黄色', value: 'rgba(212, 168, 83, 0.3)' },
  { label: '绿色', value: 'rgba(90, 168, 90, 0.3)' },
  { label: '蓝色', value: 'rgba(90, 138, 232, 0.3)' },
  { label: '红色', value: 'rgba(232, 90, 90, 0.3)' },
  { label: '紫色', value: 'rgba(154, 90, 232, 0.3)' },
];

function ToolbarButton({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onMouseDown={(e) => e.preventDefault()} onClick={onClick} title={title}
      className={`p-1.5 rounded-md transition-colors ${active ? 'bg-gold-400/20 text-gold-400' : 'text-parchment-400 hover:text-parchment-100 hover:bg-ink-700/50'}`}>
      {children}
    </button>
  );
}

function DropdownButton({ label, icon: Icon, children }: { label: string; icon?: typeof Type; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-parchment-400 hover:text-parchment-100 hover:bg-ink-700/50 transition-colors">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        <span className="max-w-[60px] truncate">{label}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-ink-900 border border-ink-700/50 rounded-lg shadow-xl shadow-black/40 py-1 min-w-[140px] animate-fade-in"
          onMouseDown={(e) => e.preventDefault()}>
          {children}
        </div>
      )}
    </div>
  );
}

function ColorPicker({ colors, currentColor, onSelect }: { colors: { label: string; value: string }[]; currentColor: string; onSelect: (color: string) => void }) {
  return (
    <div className="p-2 grid grid-cols-4 gap-1.5 min-w-[120px]">
      {colors.map((c) => (
        <button key={c.value} onMouseDown={(e) => e.preventDefault()} onClick={() => onSelect(c.value)} title={c.label}
          className={`w-6 h-6 rounded-md border transition-all hover:scale-110 ${currentColor === c.value ? 'border-gold-400 ring-1 ring-gold-400/50' : 'border-ink-600 hover:border-parchment-400'}`}
          style={{ backgroundColor: c.value || 'transparent', backgroundImage: !c.value ? 'linear-gradient(135deg, transparent 45%, #e85a5a 45%, #e85a5a 55%, transparent 55%)' : undefined }} />
      ))}
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeHtml(html: string): string {
  // Remove script tags and event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=/gi, ' data-removed=')
    .replace(/javascript:/gi, 'void:');
}

function convertMarkdownToHtml(md: string): string {
  const lines = md.split('\n');
  let inList = false;
  const result: string[] = [];

  for (const line of lines) {
    if (line.startsWith('# ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    } else if (line.startsWith('## ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (line.startsWith('### ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
    } else if (line.startsWith('- ')) {
      if (!inList) { result.push('<ul>'); inList = true; }
      result.push(`<li>${escapeHtml(line.slice(2))}</li>`);
    } else if (line.trim() === '') {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push('<br>');
    } else {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  if (inList) result.push('</ul>');
  return result.join('');
}

function isHtmlContent(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content);
}

export default function Notes() {
  const { notes, addNote, updateNote, deleteNote } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [selectedNote, setSelectedNote] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const [currentFont, setCurrentFont] = useState('');
  const [currentColor, setCurrentColor] = useState('');
  const [currentHighlight, setCurrentHighlight] = useState('');
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});

  const exec = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }, []);

  const updateActiveFormats = useCallback(() => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikethrough: document.queryCommandState('strikeThrough'),
      justifyLeft: document.queryCommandState('justifyLeft'),
      justifyCenter: document.queryCommandState('justifyCenter'),
      justifyRight: document.queryCommandState('justifyRight'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
    });
  }, []);

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    addNote({
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: newTitle,
      content: newContent,
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
    setEditingId(id);
    setEditTitle(note.title);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = isHtmlContent(note.content) ? note.content : convertMarkdownToHtml(note.content);
      }
    }, 0);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const content = editorRef.current?.innerHTML || '';
    updateNote(editingId, { title: editTitle, content, updatedAt: new Date().toISOString() });
    setEditingId(null);
  };

  const currentNote = notes.find((n) => n.id === selectedNote);

  const renderToolbar = () => (
    <div className="flex items-center gap-0.5 flex-wrap px-1 py-1.5 border-b border-ink-700/50 bg-ink-900/40">
      <ToolbarButton onClick={() => exec('undo')} title="撤销"><Undo2 className="w-3.5 h-3.5" /></ToolbarButton>
      <ToolbarButton onClick={() => exec('redo')} title="重做"><Redo2 className="w-3.5 h-3.5" /></ToolbarButton>
      <div className="w-px h-5 bg-ink-700/50 mx-1" />
      <DropdownButton label={FONT_FAMILIES.find((f) => f.value === currentFont)?.label || '字体'} icon={Type}>
        {FONT_FAMILIES.map((font) => (
          <button key={font.value} onMouseDown={(e) => e.preventDefault()} onClick={() => { setCurrentFont(font.value); exec('fontName', font.value || 'inherit'); }}
            className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${currentFont === font.value ? 'bg-gold-400/20 text-gold-400' : 'text-parchment-300 hover:bg-ink-800 hover:text-parchment-100'}`}
            style={{ fontFamily: font.value || 'inherit' }}>{font.label}</button>
        ))}
      </DropdownButton>
      <DropdownButton label="字号">
        {[{ label: '小', value: '2' }, { label: '正常', value: '3' }, { label: '大', value: '4' }, { label: '特大', value: '5' }, { label: '超大', value: '6' }].map((size) => (
          <button key={size.value} onMouseDown={(e) => e.preventDefault()} onClick={() => exec('fontSize', size.value)}
            className="w-full text-left px-3 py-1.5 text-xs text-parchment-300 hover:bg-ink-800 hover:text-parchment-100 transition-colors">{size.label}</button>
        ))}
      </DropdownButton>
      <div className="w-px h-5 bg-ink-700/50 mx-1" />
      <DropdownButton label="颜色" icon={Palette}>
        <div className="px-2 py-1">
          <p className="text-[10px] text-parchment-400 mb-1.5">文字颜色</p>
          <ColorPicker colors={TEXT_COLORS} currentColor={currentColor} onSelect={(color) => { setCurrentColor(color); exec('foreColor', color || '#f5f0e8'); }} />
          <div className="border-t border-ink-700/50 my-2" />
          <p className="text-[10px] text-parchment-400 mb-1.5">背景高亮</p>
          <ColorPicker colors={HIGHLIGHT_COLORS} currentColor={currentHighlight} onSelect={(color) => { setCurrentHighlight(color); exec('hiliteColor', color || 'transparent'); }} />
        </div>
      </DropdownButton>
      <div className="w-px h-5 bg-ink-700/50 mx-1" />
      <ToolbarButton active={activeFormats.bold} onClick={() => exec('bold')} title="加粗"><Bold className="w-3.5 h-3.5" /></ToolbarButton>
      <ToolbarButton active={activeFormats.italic} onClick={() => exec('italic')} title="斜体"><Italic className="w-3.5 h-3.5" /></ToolbarButton>
      <ToolbarButton active={activeFormats.underline} onClick={() => exec('underline')} title="下划线"><Underline className="w-3.5 h-3.5" /></ToolbarButton>
      <ToolbarButton active={activeFormats.strikethrough} onClick={() => exec('strikeThrough')} title="删除线"><Strikethrough className="w-3.5 h-3.5" /></ToolbarButton>
      <div className="w-px h-5 bg-ink-700/50 mx-1" />
      <ToolbarButton onClick={() => exec('formatBlock', '<h1>')} title="标题1"><Heading1 className="w-3.5 h-3.5" /></ToolbarButton>
      <ToolbarButton onClick={() => exec('formatBlock', '<h2>')} title="标题2"><Heading2 className="w-3.5 h-3.5" /></ToolbarButton>
      <ToolbarButton onClick={() => exec('formatBlock', '<h3>')} title="标题3"><Heading3 className="w-3.5 h-3.5" /></ToolbarButton>
      <div className="w-px h-5 bg-ink-700/50 mx-1" />
      <ToolbarButton active={activeFormats.insertUnorderedList} onClick={() => exec('insertUnorderedList')} title="无序列表"><List className="w-3.5 h-3.5" /></ToolbarButton>
      <ToolbarButton active={activeFormats.insertOrderedList} onClick={() => exec('insertOrderedList')} title="有序列表"><ListOrdered className="w-3.5 h-3.5" /></ToolbarButton>
      <div className="w-px h-5 bg-ink-700/50 mx-1" />
      <ToolbarButton active={activeFormats.justifyLeft} onClick={() => exec('justifyLeft')} title="左对齐"><AlignLeft className="w-3.5 h-3.5" /></ToolbarButton>
      <ToolbarButton active={activeFormats.justifyCenter} onClick={() => exec('justifyCenter')} title="居中"><AlignCenter className="w-3.5 h-3.5" /></ToolbarButton>
      <ToolbarButton active={activeFormats.justifyRight} onClick={() => exec('justifyRight')} title="右对齐"><AlignRight className="w-3.5 h-3.5" /></ToolbarButton>
      <div className="w-px h-5 bg-ink-700/50 mx-1" />
      <ToolbarButton onClick={() => exec('formatBlock', '<blockquote>')} title="引用"><Quote className="w-3.5 h-3.5" /></ToolbarButton>
      <ToolbarButton onClick={() => exec('formatBlock', '<pre>')} title="代码块"><Code className="w-3.5 h-3.5" /></ToolbarButton>
      <ToolbarButton onClick={() => exec('insertHorizontalRule')} title="分割线"><Minus className="w-3.5 h-3.5" /></ToolbarButton>
    </div>
  );

  return (
    <div className="flex h-full">
      {/* Note List */}
      <div className="w-72 border-r border-ink-800/50 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-ink-800/50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-lg font-semibold text-parchment-100">笔记</h2>
            <button onClick={() => setShowNew(true)} className="p-1.5 rounded-lg hover:bg-ink-800 text-parchment-400 hover:text-gold-400 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-parchment-400">{notes.length} 篇笔记</p>
        </div>

        {showNew && (
          <div className="p-3 border-b border-ink-800/50 animate-slide-in-up">
            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="笔记标题..." className="input-field text-sm mb-2" autoFocus />
            <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="开始写作..." className="input-field text-sm h-20 resize-none" />
            <div className="flex gap-2 mt-2">
              <button onClick={handleCreate} className="btn-primary text-xs px-3 py-1.5">创建</button>
              <button onClick={() => setShowNew(false)} className="btn-ghost text-xs px-3 py-1.5">取消</button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {notes.map((note) => (
            <div key={note.id} onClick={() => setSelectedNote(note.id)}
              className={`p-3 border-b border-ink-800/30 cursor-pointer transition-colors ${selectedNote === note.id ? 'bg-forest-800/20 border-l-2 border-l-gold-400' : 'hover:bg-ink-800/30'}`}>
              <p className="text-sm font-medium text-parchment-100 truncate">{note.title}</p>
              <p className="text-xs text-parchment-400 mt-1 line-clamp-2">{note.content.replace(/<[^>]*>/g, '').replace(/[#*\n]/g, ' ').slice(0, 80)}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-ink-500">{new Date(note.updatedAt).toLocaleDateString('zh-CN')}</span>
                {note.tags.slice(0, 2).map((tag) => (<span key={tag} className="tag text-[10px]">{tag}</span>))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Note Content */}
      <div className="flex-1 flex flex-col">
        {currentNote ? (
          <>
            <div className="p-4 border-b border-ink-800/50 flex items-center justify-between">
              {editingId === currentNote.id ? (
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="input-field text-lg font-serif font-bold flex-1 mr-4" />
              ) : (
                <h1 className="font-serif text-xl font-bold text-parchment-100">{currentNote.title}</h1>
              )}
              <div className="flex items-center gap-2">
                {editingId === currentNote.id ? (
                  <>
                    <button onClick={saveEdit} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"><Save className="w-3 h-3" /> 保存</button>
                    <button onClick={() => setEditingId(null)} className="btn-ghost text-xs px-3 py-1.5">取消</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(currentNote.id)} className="p-2 rounded-lg hover:bg-ink-800 text-parchment-400 hover:text-gold-400 transition-colors"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => { deleteNote(currentNote.id); setSelectedNote(null); }} className="p-2 rounded-lg hover:bg-ink-800 text-parchment-400 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
              </div>
            </div>

            {editingId === currentNote.id && renderToolbar()}

            <div className="flex-1 overflow-y-auto">
              {editingId === currentNote.id ? (
                <div ref={editorRef} contentEditable suppressContentEditableWarning
                  onInput={updateActiveFormats} onMouseUp={updateActiveFormats} onKeyUp={updateActiveFormats}
                  className="min-h-full p-6 focus:outline-none prose-notes" style={{ lineHeight: '1.8' }}
                  data-placeholder="开始写作..." />
              ) : (
                <div className="p-6">
                  <div className="prose-notes"
                    dangerouslySetInnerHTML={{ __html: isHtmlContent(currentNote.content) ? sanitizeHtml(currentNote.content) : convertMarkdownToHtml(currentNote.content) }} />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-ink-800/50">
              <div className="flex items-center gap-4 text-xs text-parchment-400">
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
            <div className="text-center">
              <StickyNote className="w-16 h-16 text-ink-700 mx-auto mb-4" />
              <p className="text-parchment-400">选择一篇笔记开始阅读</p>
              <p className="text-xs text-ink-500 mt-1">或创建新笔记开始写作</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
