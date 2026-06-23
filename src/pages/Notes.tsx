import { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { Plus, StickyNote, Tag, Trash2, Edit3, X, Save } from 'lucide-react';

export default function Notes() {
  const { notes, addNote, updateNote, deleteNote } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [selectedNote, setSelectedNote] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    addNote({
      id: `n-${Date.now()}`,
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
    setEditContent(note.content);
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateNote(editingId, {
      title: editTitle,
      content: editContent,
      updatedAt: new Date().toISOString(),
    });
    setEditingId(null);
  };

  const currentNote = notes.find((n) => n.id === selectedNote);

  return (
    <div className="flex h-full">
      {/* Note List */}
      <div className="w-72 border-r border-ink-800/50 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-ink-800/50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-lg font-semibold text-parchment-100">笔记</h2>
            <button
              onClick={() => setShowNew(true)}
              className="p-1.5 rounded-lg hover:bg-ink-800 text-parchment-400 hover:text-gold-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-parchment-400">{notes.length} 篇笔记</p>
        </div>

        {/* New Note */}
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
              placeholder="开始写作..."
              className="input-field text-sm h-20 resize-none"
            />
            <div className="flex gap-2 mt-2">
              <button onClick={handleCreate} className="btn-primary text-xs px-3 py-1.5">
                创建
              </button>
              <button onClick={() => setShowNew(false)} className="btn-ghost text-xs px-3 py-1.5">
                取消
              </button>
            </div>
          </div>
        )}

        {/* Note Items */}
        <div className="flex-1 overflow-y-auto">
          {notes.map((note) => (
            <div
              key={note.id}
              onClick={() => setSelectedNote(note.id)}
              className={`p-3 border-b border-ink-800/30 cursor-pointer transition-colors ${
                selectedNote === note.id
                  ? 'bg-forest-800/20 border-l-2 border-l-gold-400'
                  : 'hover:bg-ink-800/30'
              }`}
            >
              <p className="text-sm font-medium text-parchment-100 truncate">{note.title}</p>
              <p className="text-xs text-parchment-400 mt-1 line-clamp-2">
                {note.content.replace(/[#*\n]/g, ' ').slice(0, 80)}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-ink-500">
                  {new Date(note.updatedAt).toLocaleDateString('zh-CN')}
                </span>
                {note.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="tag text-[10px]">{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Note Content */}
      <div className="flex-1 flex flex-col">
        {currentNote ? (
          <>
            {/* Note Header */}
            <div className="p-4 border-b border-ink-800/50 flex items-center justify-between">
              {editingId === currentNote.id ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="input-field text-lg font-serif font-bold flex-1 mr-4"
                />
              ) : (
                <h1 className="font-serif text-xl font-bold text-parchment-100">
                  {currentNote.title}
                </h1>
              )}
              <div className="flex items-center gap-2">
                {editingId === currentNote.id ? (
                  <>
                    <button onClick={saveEdit} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                      <Save className="w-3 h-3" /> 保存
                    </button>
                    <button onClick={() => setEditingId(null)} className="btn-ghost text-xs px-3 py-1.5">
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(currentNote.id)}
                      className="p-2 rounded-lg hover:bg-ink-800 text-parchment-400 hover:text-gold-400 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { deleteNote(currentNote.id); setSelectedNote(null); }}
                      className="p-2 rounded-lg hover:bg-ink-800 text-parchment-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Note Body */}
            <div className="flex-1 p-6 overflow-y-auto">
              {editingId === currentNote.id ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-full bg-transparent text-parchment-200 font-sans text-sm leading-relaxed resize-none focus:outline-none"
                />
              ) : (
                <div className="prose prose-invert max-w-none">
                  {currentNote.content.split('\n').map((line, i) => {
                    if (line.startsWith('# ')) {
                      return <h1 key={i} className="font-serif text-2xl font-bold text-parchment-100 mb-4">{line.slice(2)}</h1>;
                    }
                    if (line.startsWith('## ')) {
                      return <h2 key={i} className="font-serif text-lg font-semibold text-parchment-200 mt-6 mb-2">{line.slice(3)}</h2>;
                    }
                    if (line.startsWith('- ')) {
                      return <li key={i} className="text-parchment-300 ml-4 list-disc">{line.slice(2)}</li>;
                    }
                    if (line.trim() === '') {
                      return <br key={i} />;
                    }
                    return <p key={i} className="text-parchment-300 leading-relaxed">{line}</p>;
                  })}
                </div>
              )}
            </div>

            {/* Note Meta */}
            <div className="p-4 border-t border-ink-800/50">
              <div className="flex items-center gap-4 text-xs text-parchment-400">
                <span>创建于 {new Date(currentNote.createdAt).toLocaleString('zh-CN')}</span>
                <span>更新于 {new Date(currentNote.updatedAt).toLocaleString('zh-CN')}</span>
                <div className="flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {currentNote.tags.map((tag) => (
                    <span key={tag} className="tag text-[10px]">{tag}</span>
                  ))}
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
