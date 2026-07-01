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
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const { chatMessages, addChatMessage } = useAppStore();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userContent = input;
    setInput('');
    setIsTyping(true);

    try {
      const result = await api.chat.send(userContent);
      addChatMessage(result.userMessage);
      addChatMessage(result.aiMessage);
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

  const quickQuestions = [
    '总结一下当前进度',
    '有哪些待办任务？',
    '帮我分析最近的文件',
    '笔记里有什么内容？',
  ];

  return (
    <>
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
                        <span className="truncate max-w-[120px]">{ref.id}</span>
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
        <div className="flex gap-2 sm:gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="向 AI 助手提问..."
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
    </>
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
