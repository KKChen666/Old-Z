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
} from 'lucide-react';

export default function Chat() {
  const { chatMessages, addChatMessage, loadData } = useAppStore();
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
      const result = await api.chat(userContent);
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
              由 MiMo v2.5 Pro 驱动 · 访问你的文件、笔记和待办数据
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {chatMessages.length === 0 && !isTyping && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-400 to-forest-500 flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-ink-950" />
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
              className={`max-w-[70%] rounded-2xl px-4 py-3 ${
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
                  // Parse inline bold: **text** -> <strong>text</strong>
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

              {/* References */}
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
  );
}
