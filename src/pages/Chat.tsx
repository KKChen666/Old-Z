import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import {
  Send,
  Bot,
  User,
  FileText,
  CheckSquare,
  StickyNote,
  Sparkles,
} from 'lucide-react';

const aiResponses: Record<string, string> = {
  default: '你好！我是 Old Z 的 AI 助手。我可以帮你分析文件、整理待办、回答关于你笔记的问题。请随时提问！',
  文件: '根据你最近上传的文件，我发现了以下关联：\n\n1. **产品需求文档** 与 **API接口文档** 有内容关联\n2. **竞品分析报告** 中提到了类似的知识图谱功能\n\n建议你可以将这些文件关联到同一个项目标签下。',
  待办: '你当前有以下待处理任务：\n\n- **高优先级**：Dashboard 页面开发、AI 聊天接口对接\n- **中优先级**：知识图谱可视化方案、全局搜索优化\n\n建议优先完成 Dashboard 的剩余组件，然后切换到 AI 聊天接口。',
  笔记: '你的笔记覆盖了以下主题：\n\n1. 技术选型（前端/后端/AI）\n2. 拖拽系统设计思路\n3. AI 提醒策略\n\n这些笔记之间有很强的关联性，我已经在知识图谱中建立了连接。',
  进度: '根据你的待办和笔记数据，当前项目整体进度约 **40%**。\n\n**已完成的核心模块：**\n- 项目架构设计\n- 技术选型确定\n- 用户反馈收集\n\n**进行中：**\n- Dashboard 页面开发\n\n**待开始：**\n- AI 聊天接口\n- 知识图谱可视化\n- 全局搜索优化',
};

export default function Chat() {
  const { chatMessages, addChatMessage, files, todos, notes } = useAppStore();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = {
      id: `c-${Date.now()}`,
      role: 'user' as const,
      content: input,
      timestamp: new Date().toISOString(),
    };
    addChatMessage(userMsg);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));

    let response = aiResponses.default;
    const lower = input.toLowerCase();
    if (lower.includes('文件') || lower.includes('上传')) {
      response = aiResponses.文件;
    } else if (lower.includes('待办') || lower.includes('任务')) {
      response = aiResponses.待办;
    } else if (lower.includes('笔记') || lower.includes('记录')) {
      response = aiResponses.笔记;
    } else if (lower.includes('进度') || lower.includes('情况') || lower.includes('总结')) {
      response = aiResponses.进度;
    }

    const aiMsg = {
      id: `c-${Date.now() + 1}`,
      role: 'assistant' as const,
      content: response,
      timestamp: new Date().toISOString(),
      references: [
        { type: 'todo' as const, id: 't1' },
        { type: 'note' as const, id: 'n1' },
      ],
    };
    addChatMessage(aiMsg);
    setIsTyping(false);
  };

  const quickQuestions = [
    '总结一下当前进度',
    '有哪些待办任务？',
    '帮我分析最近的文件',
    '笔记里有什么内容？',
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-ink-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-forest-500 flex items-center justify-center">
            <Bot className="w-5 h-5 text-ink-950" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-bold text-parchment-100">AI 助手</h1>
            <p className="text-xs text-parchment-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-gold-400" />
              访问你的文件、笔记和待办数据
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
              className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-gold-400/15 border border-gold-400/20'
                  : 'bg-forest-800/30 border border-forest-600/20'
              }`}
            >
              <div className="text-sm text-parchment-200 whitespace-pre-wrap leading-relaxed">
                {msg.content.split('\n').map((line, i) => {
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return <p key={i} className="font-semibold text-parchment-100 my-1">{line.replace(/\*\*/g, '')}</p>;
                  }
                  if (line.startsWith('- ')) {
                    return <p key={i} className="ml-2 my-0.5">{line}</p>;
                  }
                  return <p key={i} className="my-0.5">{line}</p>;
                })}
              </div>

              {/* References */}
              {msg.references && msg.references.length > 0 && (
                <div className="mt-3 pt-2 border-t border-ink-700/30 flex gap-2 flex-wrap">
                  {msg.references.map((ref, i) => {
                    const Icon = ref.type === 'file' ? FileText : ref.type === 'todo' ? CheckSquare : StickyNote;
                    const label = ref.type === 'file'
                      ? files.find((f) => f.id === ref.id)?.name
                      : ref.type === 'todo'
                      ? todos.find((t) => t.id === ref.id)?.title
                      : notes.find((n) => n.id === ref.id)?.title;
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-ink-800/40 text-[10px] text-parchment-400"
                      >
                        <Icon className="w-3 h-3" />
                        <span className="truncate max-w-[120px]">{label || ref.id}</span>
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
        <div className="px-6 pb-2">
          <p className="text-xs text-parchment-400 mb-2">快速提问：</p>
          <div className="flex gap-2 flex-wrap">
            {quickQuestions.map((q) => (
              <button
                key={q}
                onClick={() => { setInput(q); }}
                className="px-3 py-1.5 rounded-lg text-xs bg-ink-800/60 text-parchment-300 border border-ink-700/30 hover:border-gold-400/30 hover:text-gold-400 transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-ink-800/50">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="向 AI 助手提问..."
            className="input-field flex-1"
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
  );
}
