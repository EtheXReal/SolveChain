/**
 * AI 智能分析面板
 * 基于 LLM_Integration_Development_Guide.md 实现
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  Search,
  Footprints,
  CheckCircle2,
  Lightbulb,
  Send,
  Loader2,
  AlertCircle,
  MessageSquare,
  Trash2,
  Bot,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { llmApi } from '../api';

// 分析类型枚举
type AnalysisType = 'risk' | 'next_step' | 'logic_check' | 'completion';

// 对话记录
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: AnalysisType | 'free';
}

interface AIAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  sceneId: string | null;
  sceneName?: string;
}

// 分析按钮配置
const ANALYSIS_BUTTONS = [
  {
    type: 'risk' as AnalysisType,
    icon: Search,
    label: '风险分析',
    description: '分析计划的主要风险和应对策略',
  },
  {
    type: 'next_step' as AnalysisType,
    icon: Footprints,
    label: '下一步',
    description: '建议下一步应该做什么',
  },
  {
    type: 'logic_check' as AnalysisType,
    icon: CheckCircle2,
    label: '逻辑检查',
    description: '检查规划图的逻辑完整性',
  },
  {
    type: 'completion' as AnalysisType,
    icon: Lightbulb,
    label: '补全建议',
    description: '建议可能遗漏的内容',
  },
];

export default function AIAssistantPanel({
  isOpen,
  onClose,
  projectId,
  sceneId,
  sceneName = '概览',
}: AIAssistantPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [freeQuestion, setFreeQuestion] = useState('');
  const [llmStatus, setLlmStatus] = useState<{
    configured: boolean;
    provider: string;
    model: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 检查 LLM 状态
  useEffect(() => {
    if (isOpen) {
      llmApi.getStatus().then(setLlmStatus).catch(() => {
        setLlmStatus({ configured: false, provider: '', model: '' });
      });
    }
  }, [isOpen]);

  // 执行分析
  const handleAnalysis = useCallback(async (type: AnalysisType) => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    // 添加用户消息
    const buttonConfig = ANALYSIS_BUTTONS.find(b => b.type === type);
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: `请进行${buttonConfig?.label || type}分析`,
      timestamp: new Date(),
      type,
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await llmApi.analyzeScene(projectId, sceneId, type);

      // 添加 AI 回复
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.result,
        timestamp: new Date(),
        type,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage = (err as Error).message || '分析失败，请稍后重试';
      setError(errorMessage);

      // 添加错误消息
      const errorAssistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `抱歉，分析失败：${errorMessage}`,
        timestamp: new Date(),
        type,
      };
      setMessages(prev => [...prev, errorAssistantMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, projectId, sceneId]);

  // 发送自由提问
  const handleFreeQuestion = useCallback(async () => {
    if (isLoading || !freeQuestion.trim()) return;

    const question = freeQuestion.trim();
    setFreeQuestion('');
    setIsLoading(true);
    setError(null);

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date(),
      type: 'free',
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // 构建历史消息（最近 10 条对话）
      const history = messages
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      const response = await llmApi.chatWithScene(projectId, sceneId, question, history);

      // 添加 AI 回复
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date(),
        type: 'free',
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage = (err as Error).message || '对话失败，请稍后重试';
      setError(errorMessage);

      // 添加错误消息
      const errorAssistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `抱歉，对话失败：${errorMessage}`,
        timestamp: new Date(),
        type: 'free',
      };
      setMessages(prev => [...prev, errorAssistantMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [isLoading, freeQuestion, projectId, sceneId, messages]);

  // 清空对话
  const handleClearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  // 键盘事件处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFreeQuestion();
    }
  }, [handleFreeQuestion]);

  if (!isOpen) return null;

  return (
    <div className="bg-white border-l border-gray-200 w-96 flex flex-col h-full shadow-lg">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="flex items-center gap-2">
          <Bot className="text-purple-600" size={20} />
          <h3 className="font-semibold text-gray-800">AI 智能分析</h3>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            {sceneName}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={handleClearMessages}
              className="p-1.5 hover:bg-gray-200 rounded transition-colors"
              title="清空对话"
            >
              <Trash2 size={16} className="text-gray-500" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* LLM 状态检查 */}
      {llmStatus && !llmStatus.configured && (
        <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-100">
          <div className="flex items-center gap-2 text-yellow-700 text-sm">
            <AlertCircle size={16} />
            <span>DASHSCOPE_API_KEY 未配置，无法使用 AI 分析</span>
          </div>
        </div>
      )}

      {/* 分析按钮 */}
      <div className="p-4 border-b border-gray-100">
        <div className="grid grid-cols-2 gap-2">
          {ANALYSIS_BUTTONS.map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.type}
                onClick={() => handleAnalysis(btn.type)}
                disabled={isLoading || (llmStatus && !llmStatus.configured)}
                className="flex flex-col items-center gap-1 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={btn.description}
              >
                <Icon size={18} className="text-purple-600" />
                <span className="text-xs font-medium text-gray-700">{btn.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 对话区域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageSquare size={48} className="mb-2 opacity-30" />
            <p className="text-sm">选择上方功能或输入问题开始对话</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 ${
                  msg.role === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm prose-gray max-w-none">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        h1: ({ children }) => <h3 className="font-bold text-base mb-2">{children}</h3>,
                        h2: ({ children }) => <h4 className="font-bold text-sm mb-2">{children}</h4>,
                        h3: ({ children }) => <h5 className="font-semibold text-sm mb-1">{children}</h5>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        code: ({ children }) => (
                          <code className="bg-gray-200 px-1 rounded text-xs">{children}</code>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
            </div>
          ))
        )}

        {/* 加载指示器 */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-3 py-2 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-purple-600" />
              <span className="text-sm text-gray-600">AI 正在思考...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 自由提问输入框 */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        {error && (
          <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
            {error}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={freeQuestion}
            onChange={(e) => setFreeQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题，按 Enter 发送..."
            disabled={isLoading || (llmStatus && !llmStatus.configured)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleFreeQuestion}
            disabled={isLoading || !freeQuestion.trim() || (llmStatus && !llmStatus.configured)}
            className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400 text-center">
          AI 分析基于当前场景数据，仅供参考
        </p>
      </div>
    </div>
  );
}
