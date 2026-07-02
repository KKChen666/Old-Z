import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { api } from '@/utils/api';
import {
  Send,
  Bot,
  User,
  FileText,
  CheckSquare,
  StickyNote,
  Sparkles,
  Lightbulb,
  Target,
  Plus,
  Trash2,
  Loader2,
  MessageCircle,
  Pencil,
  Paperclip,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AiActionSuggestion, ChatReference, Note, TimelineEvent, Todo } from '@/types';

type ChatTab = 'chat' | 'plan';

export default function Chat() {
  const { chatMessages, addChatMessage, loadData } = useAppStore();
  const [activeTab, setActiveTab] = useState<ChatTab>('chat');

  return (
    <div className="flex flex-col h-full">
      {/* Header with tabs */}
      <div className="p-4 sm:p-6 pb-0 border-b border-ink-800/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-gold-400 to-forest-500 flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-ink-950" />
          </div>
          <div>
            <h1 className="font-serif text-lg sm:text-xl font-bold text-parchment-100">AI 助手</h1>
            <p className="text-[10px] sm:text-xs text-parchment-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-gold-400" />
              智能对话 · AI 规划
            </p>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-0 -mb-[1px]">
          <button
            onClick={() => setActiveTab('chat')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 transition-all',
              activeTab === 'chat'
                ? 'border-gold-400 text-gold-400'
                : 'border-transparent text-parchment-400 hover:text-parchment-200'
            )}
          >
            <MessageCircle className="w-4 h-4" />
            对话
          </button>
          <button
            onClick={() => setActiveTab('plan')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 transition-all',
              activeTab === 'plan'
                ? 'border-gold-400 text-gold-400'
                : 'border-transparent text-parchment-400 hover:text-parchment-200'
            )}
          >
            <Lightbulb className="w-4 h-4" />
            AI 规划
          </button>
        </div>
      </div>

      {activeTab === 'chat' ? <ChatPanel /> : <PlanPanel />}
    </div>
  );
}

// ==================== Chat Panel ====================
function ChatPanel() {
  const {
    chatMessages,
    chatConversations,
    activeConversationId,
    files,
    todos,
    notes,
    addChatMessage,
    addTodo,
    addNote,
    addTimelineEvent,
    setChatMessages,
    setChatConversations,
    upsertChatConversation,
    removeChatConversation,
    setActiveConversationId,
  } = useAppStore();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeNoteContext, setActiveNoteContext] = useState<{ id: string; title: string } | null>(null);
  const [actionSuggestions, setActionSuggestions] = useState<Record<string, AiActionSuggestion[]>>({});
  const [actionsLoadingFor, setActionsLoadingFor] = useState<string | null>(null);
  const [appliedActions, setAppliedActions] = useState<Set<string>>(new Set());
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingConversationTitle, setEditingConversationTitle] = useState('');
  const [referencePickerOpen, setReferencePickerOpen] = useState(false);
  const [referenceSearch, setReferenceSearch] = useState('');
  const [selectedReferences, setSelectedReferences] = useState<ChatReference[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setConversationsLoading(true);
    api.getChatConversations()
      .then(async (conversations) => {
        if (cancelled) return;
        setChatConversations(conversations);
        const nextActiveId = activeConversationId || conversations[0]?.id || null;
        setActiveConversationId(nextActiveId);
        if (nextActiveId) {
          const messages = await api.getChatMessages({ conversationId: nextActiveId });
          if (!cancelled) setChatMessages(messages);
        } else {
          setChatMessages([]);
        }
      })
      .catch((error) => {
        console.error('Load conversations error:', error);
      })
      .finally(() => {
        if (!cancelled) setConversationsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const refreshConversations = async () => {
    const conversations = await api.getChatConversations();
    setChatConversations(conversations);
    return conversations;
  };

  const selectConversation = async (conversationId: string) => {
    if (conversationId === activeConversationId) return;
    setActiveConversationId(conversationId);
    setActiveNoteContext(null);
    setActionSuggestions({});
    setAppliedActions(new Set());
    setSelectedReferences([]);
    setReferencePickerOpen(false);
    const messages = await api.getChatMessages({ conversationId });
    setChatMessages(messages);
  };

  const createConversation = async () => {
    const conversation = await api.createChatConversation({ title: '新对话', scope: 'global' });
    upsertChatConversation(conversation);
    setActiveConversationId(conversation.id);
    setChatMessages([]);
    setActiveNoteContext(null);
    setSelectedReferences([]);
    setReferencePickerOpen(false);
  };

  const renameConversation = async (conversationId: string) => {
    const title = editingConversationTitle.trim();
    if (!title) return;
    const conversation = chatConversations.find((item) => item.id === conversationId);
    if (!conversation) return;
    await api.renameChatConversation(conversationId, title);
    upsertChatConversation({ ...conversation, title });
    setEditingConversationId(null);
    setEditingConversationTitle('');
  };

  const deleteConversation = async (conversationId: string) => {
    if (!window.confirm('确定删除这个对话吗？其中的消息也会一起删除。')) return;
    await api.deleteChatConversation(conversationId);
    removeChatConversation(conversationId);
    const conversations = (await refreshConversations()).filter((item) => item.id !== conversationId);
    const next = conversations[0] || null;
    setActiveConversationId(next?.id || null);
    setSelectedReferences([]);
    setReferencePickerOpen(false);
    setChatMessages(next ? await api.getChatMessages({ conversationId: next.id }) : []);
  };

  const referenceLabel = (type: ChatReference['type']) => {
    if (type === 'file') return '文件';
    if (type === 'todo') return '待办';
    return '笔记';
  };

  const addReference = (reference: ChatReference) => {
    setSelectedReferences((current) => {
      if (current.some((item) => item.type === reference.type && item.id === reference.id)) return current;
      return [...current, reference].slice(0, 12);
    });
  };

  const removeReference = (reference: ChatReference) => {
    setSelectedReferences((current) => current.filter((item) => !(item.type === reference.type && item.id === reference.id)));
  };

  const referenceQuery = referenceSearch.trim().toLowerCase();
  const matchesReferenceSearch = (text: string) => !referenceQuery || text.toLowerCase().includes(referenceQuery);
  const referenceGroups: { type: ChatReference['type']; label: string; items: ChatReference[] }[] = [
    {
      type: 'note',
      label: '笔记',
      items: notes
        .filter((note) => matchesReferenceSearch(`${note.title} ${note.content}`))
        .slice(0, 20)
        .map((note) => ({ type: 'note' as const, id: note.id, title: note.title })),
    },
    {
      type: 'todo',
      label: '待办',
      items: todos
        .filter((todo) => matchesReferenceSearch(`${todo.title} ${todo.description || ''}`))
        .slice(0, 20)
        .map((todo) => ({ type: 'todo' as const, id: todo.id, title: todo.title })),
    },
    {
      type: 'file',
      label: '文件',
      items: files
        .filter((file) => matchesReferenceSearch(`${file.name} ${file.tags?.join(' ') || ''}`))
        .slice(0, 20)
        .map((file) => ({ type: 'file' as const, id: file.id, title: file.name })),
    },
  ];

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userContent = input;
    setInput('');
    setIsTyping(true);

    try {
      const result = await api.chat.send(
        userContent,
        activeNoteContext
          ? { scope: 'note', noteId: activeNoteContext.id, conversationId: activeConversationId || undefined, references: selectedReferences }
          : { scope: 'global', conversationId: activeConversationId || undefined, references: selectedReferences }
      );
      if (result.conversation) {
        upsertChatConversation(result.conversation);
        if (!activeConversationId) setActiveConversationId(result.conversation.id);
      }
      addChatMessage(result.userMessage);
      addChatMessage(result.aiMessage);
      setSelectedReferences([]);
      setReferencePickerOpen(false);
      refreshConversations().then((conversations) => {
        const current = conversations.find((item) => item.id === result.conversation.id);
        if (current) upsertChatConversation(current);
      }).catch(console.error);

      setActionsLoadingFor(result.aiMessage.id);
      api.chat.actions(userContent, result.aiMessage.content)
        .then((actions) => {
          if (actions.length > 0) {
            setActionSuggestions((prev) => ({ ...prev, [result.aiMessage.id]: actions }));
          }
        })
        .catch((error) => {
          console.warn('AI action suggestion error:', error);
        })
        .finally(() => {
          setActionsLoadingFor((current) => (current === result.aiMessage.id ? null : current));
        });
    } catch (error) {
      console.error('Chat error:', error);
      addChatMessage({
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: '抱歉，AI 调用失败，请稍后重试。',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleApplyAction = (messageId: string, action: AiActionSuggestion, index: number) => {
    const actionKey = `${messageId}-${index}`;
    if (appliedActions.has(actionKey)) return;

    const now = new Date().toISOString();
    if (action.type === 'todo') {
      const todo: Todo = {
        id: `todo-ai-${Date.now()}-${index}`,
        title: action.title,
        description: action.description || '',
        priority: action.priority || 'medium',
        status: 'pending',
        dueDate: undefined,
        tags: action.tags?.length ? action.tags : ['ai'],
        fileIds: [],
        noteIds: [],
        subtasks: [],
        isTodayTodo: true,
        createdAt: now,
      };
      addTodo(todo);
    } else if (action.type === 'note') {
      const note: Note = {
        id: `note-ai-${Date.now()}-${index}`,
        title: action.title,
        content: action.content || action.description || '',
        tags: action.tags?.length ? action.tags : ['ai'],
        linkedFileIds: [],
        linkedTodoIds: [],
        createdAt: now,
        updatedAt: now,
      };
      addNote(note);
    } else {
      const event: TimelineEvent = {
        id: `event-ai-${Date.now()}-${index}`,
        type: 'ai_reminder',
        title: action.title,
        description: action.description,
        timestamp: now,
      };
      addTimelineEvent(event);
    }

    setAppliedActions((prev) => new Set(prev).add(actionKey));
  };

  const getActionLabel = (action: AiActionSuggestion) => {
    if (action.type === 'todo') return '创建待办';
    if (action.type === 'note') return '保存笔记';
    return '加入时间线';
  };

  const quickQuestions = [
    '总结一下当前进度',
    '有哪些待办任务？',
    '帮我分析最近的文件',
    '笔记里有什么内容？',
  ];

  const getNoteTitle = (noteId?: string, fallback?: string) =>
    fallback || notes.find((note) => note.id === noteId)?.title || '未知笔记';

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="hidden w-64 shrink-0 border-r border-ink-800/50 bg-ink-950/40 md:flex md:flex-col">
        <div className="p-3 border-b border-ink-800/50">
          <button onClick={createConversation} className="btn-primary w-full !py-2 text-xs flex items-center justify-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            新建对话
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversationsLoading && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-parchment-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              加载对话...
            </div>
          )}
          {chatConversations.map((conversation) => {
            const active = conversation.id === activeConversationId;
            const editing = editingConversationId === conversation.id;
            return (
              <div
                key={conversation.id}
                className={`rounded-lg border transition-colors ${
                  active ? 'border-gold-400/30 bg-gold-400/10' : 'border-transparent hover:bg-ink-800/45'
                }`}
              >
                <button
                  onClick={() => selectConversation(conversation.id)}
                  className="w-full px-3 py-2 text-left"
                >
                  {editing ? (
                    <input
                      value={editingConversationTitle}
                      onChange={(event) => setEditingConversationTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') renameConversation(conversation.id);
                        if (event.key === 'Escape') setEditingConversationId(null);
                      }}
                      onClick={(event) => event.stopPropagation()}
                      className="input-field !py-1 !px-2 !text-xs"
                      autoFocus
                    />
                  ) : (
                    <>
                      <p className={`text-xs font-medium truncate ${active ? 'text-gold-300' : 'text-parchment-200'}`}>
                        {conversation.title}
                      </p>
                      <p className="text-[10px] text-ink-500 mt-0.5">
                        {conversation.messageCount || 0} 条消息
                      </p>
                    </>
                  )}
                </button>
                {!editing && (
                  <div className="flex justify-end gap-1 px-2 pb-2">
                    <button
                      onClick={() => {
                        setEditingConversationId(conversation.id);
                        setEditingConversationTitle(conversation.title);
                      }}
                      className="p-1 rounded text-parchment-500 hover:text-gold-300 hover:bg-ink-800"
                      title="重命名"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => deleteConversation(conversation.id)}
                      className="p-1 rounded text-parchment-500 hover:text-red-300 hover:bg-ink-800"
                      title="删除"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {!conversationsLoading && chatConversations.length === 0 && (
            <p className="px-3 py-4 text-xs text-ink-500 text-center">暂无对话</p>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
      <div className="md:hidden border-b border-ink-800/50 p-3">
        <div className="flex gap-2">
          <select
            value={activeConversationId || ''}
            onChange={(event) => event.target.value && selectConversation(event.target.value)}
            className="select-field !py-2 !text-xs flex-1"
          >
            <option value="" disabled>选择对话</option>
            {chatConversations.map((conversation) => (
              <option key={conversation.id} value={conversation.id}>{conversation.title}</option>
            ))}
          </select>
          <button onClick={createConversation} className="btn-primary !py-2 text-xs flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            新建
          </button>
        </div>
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {chatMessages.length === 0 && !isTyping && (
          <div className="text-center py-10 sm:py-16">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-gold-400 to-forest-500 flex items-center justify-center mx-auto mb-4">
              <Bot className="w-7 h-7 sm:w-8 sm:h-8 text-ink-950" />
            </div>
            <p className="text-parchment-300 font-medium">你好！我是 Old Z AI 助手</p>
            <p className="text-sm text-parchment-400 mt-1">我可以帮你分析文件、整理待办、回答关于你笔记的问题</p>
          </div>
        )}

        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 animate-fade-in ${
              msg.role === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                msg.role === 'user'
                  ? 'bg-gold-400/20'
                  : 'bg-forest-800/40'
              }`}
            >
              {msg.role === 'user' ? (
                <User className="w-4 h-4 text-gold-400" />
              ) : (
                <Bot className="w-4 h-4 text-forest-300" />
              )}
            </div>
            <div
              className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 ${
                msg.role === 'user'
                  ? 'bg-gold-400/15 border border-gold-400/20'
                  : 'bg-forest-800/30 border border-forest-600/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] border ${
                  msg.scope === 'note'
                    ? 'bg-gold-400/10 text-gold-300 border-gold-400/20'
                    : 'bg-ink-800/50 text-parchment-400 border-ink-700/30'
                }`}>
                  {msg.scope === 'note' ? <StickyNote className="w-3 h-3" /> : <MessageCircle className="w-3 h-3" />}
                  {msg.scope === 'note' ? `笔记：${getNoteTitle(msg.noteId, msg.noteTitle)}` : '全局对话'}
                </span>
                {msg.scope === 'note' && msg.noteId && (
                  <button
                    onClick={() => setActiveNoteContext({ id: msg.noteId!, title: getNoteTitle(msg.noteId, msg.noteTitle) })}
                    className="text-[10px] text-gold-300 hover:text-gold-200 transition-colors"
                  >
                    继续针对这篇笔记
                  </button>
                )}
              </div>
              <div className="text-sm text-parchment-200 whitespace-pre-wrap leading-relaxed">
                {msg.content.split('\n').map((line, i) => {
                  if (line.startsWith('## ')) {
                    return <h3 key={i} className="font-serif text-base font-semibold text-parchment-200 mt-3 mb-1">{line.slice(3)}</h3>;
                  }
                  if (line.startsWith('# ')) {
                    return <h2 key={i} className="font-serif text-lg font-bold text-parchment-100 my-2">{line.slice(2)}</h2>;
                  }
                  if (line.startsWith('```')) {
                    return null;
                  }
                  if (line.startsWith('- ')) {
                    return <p key={i} className="ml-2 my-0.5">{line}</p>;
                  }
                  const parts = line.split(/(\*\*[^*]+\*\*)/g);
                  const hasBold = parts.length > 1;
                  if (hasBold) {
                    return (
                      <p key={i} className="my-0.5">
                        {parts.map((part, j) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={j} className="font-semibold text-parchment-100">{part.slice(2, -2)}</strong>;
                          }
                          return <span key={j}>{part}</span>;
                        })}
                      </p>
                    );
                  }
                  return <p key={i} className="my-0.5">{line}</p>;
                })}
              </div>

              {msg.references && msg.references.length > 0 && (
                <div className="mt-3 pt-2 border-t border-ink-700/30 flex gap-2 flex-wrap">
                  {msg.references.map((ref, i) => {
                    const Icon = ref.type === 'file' ? FileText : ref.type === 'todo' ? CheckSquare : StickyNote;
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-ink-800/40 text-[10px] text-parchment-400"
                      >
                        <Icon className="w-3 h-3" />
                        <span className="truncate max-w-[120px]">{ref.title || ref.id}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {msg.role === 'assistant' && actionsLoadingFor === msg.id && (
                <div className="mt-3 pt-3 border-t border-ink-700/30 flex items-center gap-2 text-[11px] text-parchment-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  正在寻找可联动的下一步...
                </div>
              )}

              {msg.role === 'assistant' && actionSuggestions[msg.id]?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-ink-700/30 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-gold-300">
                    <Sparkles className="w-3 h-3" />
                    可以落地到项目
                  </div>
                  {actionSuggestions[msg.id].map((action, index) => {
                    const actionKey = `${msg.id}-${index}`;
                    const applied = appliedActions.has(actionKey);
                    const Icon = action.type === 'todo' ? CheckSquare : action.type === 'note' ? StickyNote : Target;
                    return (
                      <div key={actionKey} className="rounded-lg border border-ink-700/40 bg-ink-900/30 p-2.5">
                        <div className="flex items-start gap-2">
                          <Icon className="w-3.5 h-3.5 text-gold-400 mt-0.5 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-parchment-100 font-medium leading-snug">{action.title}</p>
                            {action.description && (
                              <p className="text-[11px] text-parchment-400 mt-1 line-clamp-2">{action.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <span className="text-[10px] text-parchment-500">
                            {action.type === 'todo' ? '待办' : action.type === 'note' ? '笔记' : '提醒'}
                            {action.priority ? ` · ${action.priority}` : ''}
                          </span>
                          <button
                            onClick={() => handleApplyAction(msg.id, action, index)}
                            disabled={applied}
                            className="px-2 py-1 rounded-md text-[10px] bg-gold-400/15 text-gold-300 border border-gold-400/20 hover:bg-gold-400/25 disabled:opacity-60 disabled:cursor-default transition-all"
                          >
                            {applied ? '已添加' : getActionLabel(action)}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-lg bg-forest-800/40 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-forest-300" />
            </div>
            <div className="bg-forest-800/30 border border-forest-600/20 rounded-2xl px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-parchment-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-parchment-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-parchment-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions */}
      {chatMessages.length <= 2 && (
        <div className="px-4 sm:px-6 pb-2">
          <p className="text-xs text-parchment-400 mb-2">快速提问：</p>
          <div className="flex gap-1.5 sm:gap-2 flex-wrap">
            {quickQuestions.map((q) => (
              <button
                key={q}
                onClick={() => { setInput(q); }}
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs bg-ink-800/60 text-parchment-300 border border-ink-700/30 hover:border-gold-400/30 hover:text-gold-400 transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 sm:p-4 border-t border-ink-800/50 safe-area-pb">
        {activeNoteContext && (
          <div className="flex items-center justify-between gap-2 mb-2 rounded-lg border border-gold-400/20 bg-gold-400/10 px-3 py-2">
            <div className="flex items-center gap-1.5 min-w-0 text-xs text-gold-300">
              <StickyNote className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">正在针对笔记：{activeNoteContext.title}</span>
            </div>
            <button
              onClick={() => setActiveNoteContext(null)}
              className="text-[11px] text-parchment-400 hover:text-parchment-200 flex-shrink-0"
            >
              切回全局
            </button>
          </div>
        )}
        {selectedReferences.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {selectedReferences.map((reference) => {
              const Icon = reference.type === 'file' ? FileText : reference.type === 'todo' ? CheckSquare : StickyNote;
              return (
                <span key={`${reference.type}-${reference.id}`} className="inline-flex max-w-[180px] items-center gap-1.5 rounded-md border border-gold-400/20 bg-gold-400/10 px-2 py-1 text-[11px] text-gold-200">
                  <Icon className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{reference.title || reference.id}</span>
                  <button
                    onClick={() => removeReference(reference)}
                    className="rounded p-0.5 text-gold-300 hover:bg-gold-400/15 hover:text-gold-100"
                    title="移除引用"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        {referencePickerOpen && (
          <div className="mb-2 rounded-lg border border-ink-700/50 bg-ink-950/95 p-3 shadow-xl">
            <input
              value={referenceSearch}
              onChange={(event) => setReferenceSearch(event.target.value)}
              placeholder="搜索要引用的笔记、待办或文件..."
              className="input-field !py-2 !text-xs mb-3"
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {referenceGroups.map((group) => (
                <div key={group.type} className="min-w-0">
                  <p className="mb-1.5 text-[11px] font-semibold text-parchment-300">{group.label}</p>
                  <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                    {group.items.length === 0 ? (
                      <p className="rounded-md bg-ink-900/50 px-2 py-1.5 text-[11px] text-ink-500">没有匹配项</p>
                    ) : (
                      group.items.map((item) => {
                        const selected = selectedReferences.some((reference) => reference.type === item.type && reference.id === item.id);
                        const Icon = item.type === 'file' ? FileText : item.type === 'todo' ? CheckSquare : StickyNote;
                        return (
                          <button
                            key={`${item.type}-${item.id}`}
                            onClick={() => selected ? removeReference(item) : addReference(item)}
                            className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors ${
                              selected
                                ? 'border-gold-400/30 bg-gold-400/10 text-gold-200'
                                : 'border-ink-700/30 bg-ink-900/40 text-parchment-300 hover:border-gold-400/20 hover:text-gold-300'
                            }`}
                          >
                            <Icon className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{item.title || item.id}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={() => setReferencePickerOpen((open) => !open)}
            className={`btn-ghost px-3 ${selectedReferences.length > 0 ? '!text-gold-300 !border-gold-400/25' : ''}`}
            title="引用笔记、待办或文件"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={activeNoteContext ? '继续询问这篇笔记...' : '向 AI 助手提问...'}
            className="input-field flex-1"
            disabled={isTyping}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="btn-primary px-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

// ==================== Plan Panel ====================
function PlanPanel() {
  const [goal, setGoal] = useState('');
  const [context, setContext] = useState('');
  const [newStageTitle, setNewStageTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ main_line: string; today_actions: string[] } | null>(null);
  const [stages, setStages] = useState<{ title: string; status: 'active' | 'done' }[]>([]);

  const handleGenerate = async () => {
    if (!goal.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.chat.plan(goal.trim(), context.trim(), stages);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'AI 规划生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStage = () => {
    if (!newStageTitle.trim()) return;
    setStages([...stages, { title: newStageTitle.trim(), status: 'active' as const }]);
    setNewStageTitle('');
  };

  const handleToggleStage = (idx: number) => {
    setStages(stages.map((s, i) =>
      i === idx ? { ...s, status: s.status === 'done' ? 'active' as const : 'done' as const } : s
    ));
  };

  const handleDeleteStage = (idx: number) => {
    setStages(stages.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="space-y-5 max-w-4xl mx-auto">
        {/* 目标输入 */}
        <div className="glass-card p-5 space-y-4">
          <div>
            <label className="text-sm text-parchment-300 mb-1.5 block">你的目标</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="你想达成什么目标？例如：成为一名全栈工程师"
              rows={2}
              className="input-field w-full text-sm resize-none"
            />
          </div>
          <div>
            <label className="text-sm text-parchment-300 mb-1.5 block">背景补充（可选）</label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="当前的技能水平、可用时间、资源等..."
              rows={2}
              className="input-field w-full text-sm resize-none"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading || !goal.trim()}
            className="btn-primary text-sm px-6 py-2.5 flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
            {loading ? 'AI 思考中...' : (result ? '重新生成' : '生成策略')}
          </button>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3">{error}</div>
        )}

        {/* 主线策略 */}
        {result?.main_line && (
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-parchment-100 mb-3">🎯 主线策略</h3>
            <div className="text-sm text-parchment-200 leading-relaxed whitespace-pre-wrap">
              {result.main_line}
            </div>
          </div>
        )}

        {/* 今日行动 */}
        {result?.today_actions && result.today_actions.length > 0 && (
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-parchment-100 mb-3">⚡ 今日行动建议</h3>
            <div className="space-y-2">
              {result.today_actions.map((action: string, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-ink-800/40">
                  <div className="w-5 h-5 rounded-full bg-gold-400/20 text-gold-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <span className="text-sm text-parchment-200">{action}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 阶段管理 */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-parchment-100 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-gold-400" />
            阶段规划
          </h3>

          <div className="space-y-2 mb-4">
            {stages.map((stage, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg transition-all',
                  stage.status === 'done' ? 'bg-forest-800/20' : 'bg-ink-800/40'
                )}
              >
                <button
                  onClick={() => handleToggleStage(i)}
                  className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                    stage.status === 'done'
                      ? 'bg-forest-500 border-forest-500'
                      : 'border-ink-600 hover:border-gold-400'
                  )}
                >
                  {stage.status === 'done' && <CheckSquare className="w-3 h-3 text-ink-950" />}
                </button>
                <span className={cn(
                  'text-sm flex-1',
                  stage.status === 'done' ? 'text-parchment-500 line-through' : 'text-parchment-200'
                )}>
                  {stage.title}
                </span>
                <button
                  onClick={() => handleDeleteStage(i)}
                  className="text-parchment-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {stages.length === 0 && (
              <div className="text-center py-4 text-parchment-500 text-sm">
                还没有阶段，把大目标拆分成小阶段吧
              </div>
            )}
          </div>

          {/* 添加阶段 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newStageTitle}
              onChange={(e) => setNewStageTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddStage(); }}
              placeholder="新阶段名称..."
              className="input-field flex-1 text-sm py-2"
            />
            <button
              onClick={handleAddStage}
              disabled={!newStageTitle.trim()}
              className="btn-primary text-sm px-4 py-2 flex items-center gap-1 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              添加
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
