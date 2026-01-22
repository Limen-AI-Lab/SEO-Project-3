import React, { useState, useEffect, useRef } from 'react';
import { 
  usePromptMonitor, 
  registerPromptCallbacks, 
  unregisterPromptCallbacks,
  PromptRecord 
} from '../contexts/PromptMonitorContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Terminal, 
  X, 
  Minimize2, 
  Maximize2, 
  Trash2, 
  Copy, 
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Zap,
  AlertCircle,
  Loader2
} from 'lucide-react';

const PromptMonitor: React.FC = () => {
  const { isAdminUser } = useAuth();
  const { records, addRecord, updateRecord, clearRecords, isEnabled, setEnabled } = usePromptMonitor();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<PromptRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['userPrompt', 'fullPayload']));
  
  // 拖拽相关状态
  const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 注册全局回调
  useEffect(() => {
    registerPromptCallbacks(addRecord, updateRecord);
    return () => unregisterPromptCallbacks();
  }, [addRecord, updateRecord]);

  // 拖拽处理
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = Math.min(Math.max(0, e.clientX - dragOffset.current.x), window.innerWidth - 60);
      const newY = Math.min(Math.max(0, e.clientY - dragOffset.current.y), window.innerHeight - 60);
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      setIsDragging(true);
    }
  };

  const handleButtonClick = () => {
    if (!isDragging) {
      setIsOpen(true);
      setIsMinimized(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
  };

  const getStatusIcon = (status: PromptRecord['status']) => {
    switch (status) {
      case 'pending':
        return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'sent':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = (status: PromptRecord['status']) => {
    switch (status) {
      case 'pending': return '准备中';
      case 'sent': return '发送中';
      case 'completed': return '已完成';
      case 'error': return '错误';
    }
  };

  // 只对管理员显示
  if (!isAdminUser) {
    return null;
  }

  // 收起状态 - 显示悬浮按钮
  if (!isOpen || isMinimized) {
    return (
      <button
        ref={buttonRef}
        onMouseDown={handleMouseDown}
        onClick={handleButtonClick}
        className="fixed z-[9999] w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group cursor-move"
        style={{ left: position.x, top: position.y }}
        title="Prompt Monitor (Admin)"
      >
        <Terminal className="w-6 h-6 text-white" />
        {records.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
            {records.length}
          </span>
        )}
      </button>
    );
  }

  // 展开状态 - 显示完整面板
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-[90vw] max-w-5xl h-[80vh] bg-slate-900 rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-700">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <h2 className="text-white font-semibold">Prompt Monitor</h2>
            <span className="px-2 py-0.5 bg-indigo-600/30 text-indigo-300 text-xs rounded-full">
              Admin Only
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* 启用/禁用开关 */}
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              监控开启
            </label>
            <button
              onClick={clearRecords}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="清空记录"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsMinimized(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="最小化"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 主体内容 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧列表 */}
          <div className="w-80 border-r border-slate-700 overflow-y-auto">
            {records.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Terminal className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">暂无请求记录</p>
                <p className="text-xs mt-1">点击生成按钮后将显示请求</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {records.map((record) => (
                  <button
                    key={record.id}
                    onClick={() => setSelectedRecord(record)}
                    className={`w-full px-4 py-3 text-left hover:bg-slate-800/50 transition-colors ${
                      selectedRecord?.id === record.id ? 'bg-slate-800' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white truncate">
                        {record.functionName}
                      </span>
                      {getStatusIcon(record.status)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimestamp(record.timestamp)}</span>
                      {record.responseTime && (
                        <>
                          <Zap className="w-3 h-3 ml-2" />
                          <span>{record.responseTime}ms</span>
                        </>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 truncate">
                      {record.model}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 右侧详情 */}
          <div className="flex-1 overflow-y-auto p-4">
            {selectedRecord ? (
              <div className="space-y-4">
                {/* 基本信息 */}
                <div className="bg-slate-800 rounded-lg p-4">
                  <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                    基本信息
                    {getStatusIcon(selectedRecord.status)}
                    <span className="text-sm text-slate-400">
                      {getStatusText(selectedRecord.status)}
                    </span>
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-400">函数名：</span>
                      <span className="text-white ml-2">{selectedRecord.functionName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">模型：</span>
                      <span className="text-indigo-400 ml-2">{selectedRecord.model}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">时间：</span>
                      <span className="text-white ml-2">
                        {selectedRecord.timestamp.toLocaleString('zh-CN')}
                      </span>
                    </div>
                    {selectedRecord.responseTime && (
                      <div>
                        <span className="text-slate-400">响应时间：</span>
                        <span className="text-green-400 ml-2">{selectedRecord.responseTime}ms</span>
                      </div>
                    )}
                    {selectedRecord.responseLength && (
                      <div>
                        <span className="text-slate-400">响应长度：</span>
                        <span className="text-white ml-2">{selectedRecord.responseLength} 字符</span>
                      </div>
                    )}
                    {selectedRecord.error && (
                      <div className="col-span-2">
                        <span className="text-slate-400">错误：</span>
                        <span className="text-red-400 ml-2">{selectedRecord.error}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* System Prompt */}
                {selectedRecord.systemPrompt && (
                  <CollapsibleSection
                    title="System Prompt"
                    isExpanded={expandedSections.has('systemPrompt')}
                    onToggle={() => toggleSection('systemPrompt')}
                    content={selectedRecord.systemPrompt}
                    onCopy={() => copyToClipboard(selectedRecord.systemPrompt!, 'systemPrompt')}
                    isCopied={copiedId === 'systemPrompt'}
                  />
                )}

                {/* User Prompt */}
                <CollapsibleSection
                  title="User Prompt / Contents"
                  isExpanded={expandedSections.has('userPrompt')}
                  onToggle={() => toggleSection('userPrompt')}
                  content={selectedRecord.userPrompt}
                  onCopy={() => copyToClipboard(selectedRecord.userPrompt, 'userPrompt')}
                  isCopied={copiedId === 'userPrompt'}
                />

                {/* Config */}
                {selectedRecord.config && Object.keys(selectedRecord.config).length > 0 && (
                  <CollapsibleSection
                    title="Config 参数"
                    isExpanded={expandedSections.has('config')}
                    onToggle={() => toggleSection('config')}
                    content={JSON.stringify(selectedRecord.config, null, 2)}
                    onCopy={() => copyToClipboard(JSON.stringify(selectedRecord.config, null, 2), 'config')}
                    isCopied={copiedId === 'config'}
                    isJson
                  />
                )}

                {/* Full Payload */}
                <CollapsibleSection
                  title="完整 JSON Payload"
                  isExpanded={expandedSections.has('fullPayload')}
                  onToggle={() => toggleSection('fullPayload')}
                  content={JSON.stringify(selectedRecord.fullPayload, null, 2)}
                  onCopy={() => copyToClipboard(JSON.stringify(selectedRecord.fullPayload, null, 2), 'fullPayload')}
                  isCopied={copiedId === 'fullPayload'}
                  isJson
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Maximize2 className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">选择左侧请求查看详情</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 可折叠区块组件
interface CollapsibleSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  content: string;
  onCopy: () => void;
  isCopied: boolean;
  isJson?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  isExpanded,
  onToggle,
  content,
  onCopy,
  isCopied,
  isJson = false,
}) => {
  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
          <span className="text-white font-medium">{title}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopy();
          }}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
          title="复制"
        >
          {isCopied ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4">
          <pre className={`p-3 bg-slate-900 rounded-lg overflow-x-auto text-sm ${
            isJson ? 'text-green-400' : 'text-slate-300'
          } whitespace-pre-wrap break-words max-h-96`}>
            {content}
          </pre>
        </div>
      )}
    </div>
  );
};

export default PromptMonitor;
