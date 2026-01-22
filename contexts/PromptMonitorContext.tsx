import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Prompt 请求记录接口
export interface PromptRecord {
  id: string;
  timestamp: Date;
  functionName: string;        // 调用的函数名
  status: 'pending' | 'sent' | 'completed' | 'error';
  
  // 请求详情
  model: string;
  systemPrompt?: string;       // System prompt (如果有)
  userPrompt: string;          // User prompt / contents
  config?: Record<string, any>; // 其他配置参数
  fullPayload: Record<string, any>; // 完整的 JSON payload
  
  // 响应详情 (发送后填充)
  responseTime?: number;       // 响应时间 (ms)
  responseLength?: number;     // 响应长度
  error?: string;              // 错误信息
}

interface PromptMonitorContextType {
  // 状态
  records: PromptRecord[];
  isEnabled: boolean;
  
  // 操作
  addRecord: (record: Omit<PromptRecord, 'id' | 'timestamp'>) => string;
  updateRecord: (id: string, updates: Partial<PromptRecord>) => void;
  clearRecords: () => void;
  setEnabled: (enabled: boolean) => void;
}

const PromptMonitorContext = createContext<PromptMonitorContextType | undefined>(undefined);

// 最大保留记录数
const MAX_RECORDS = 20;

// 生成唯一 ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const usePromptMonitor = () => {
  const context = useContext(PromptMonitorContext);
  if (context === undefined) {
    throw new Error('usePromptMonitor must be used within a PromptMonitorProvider');
  }
  return context;
};

interface PromptMonitorProviderProps {
  children: ReactNode;
}

export const PromptMonitorProvider: React.FC<PromptMonitorProviderProps> = ({ children }) => {
  const [records, setRecords] = useState<PromptRecord[]>([]);
  const [isEnabled, setEnabled] = useState(true);

  // 添加新记录
  const addRecord = useCallback((record: Omit<PromptRecord, 'id' | 'timestamp'>): string => {
    const id = generateId();
    const newRecord: PromptRecord = {
      ...record,
      id,
      timestamp: new Date(),
    };

    setRecords(prev => {
      const updated = [newRecord, ...prev];
      // 保留最近 MAX_RECORDS 条记录
      return updated.slice(0, MAX_RECORDS);
    });

    return id;
  }, []);

  // 更新记录
  const updateRecord = useCallback((id: string, updates: Partial<PromptRecord>) => {
    setRecords(prev => 
      prev.map(record => 
        record.id === id ? { ...record, ...updates } : record
      )
    );
  }, []);

  // 清空记录
  const clearRecords = useCallback(() => {
    setRecords([]);
  }, []);

  const value = {
    records,
    isEnabled,
    addRecord,
    updateRecord,
    clearRecords,
    setEnabled,
  };

  return (
    <PromptMonitorContext.Provider value={value}>
      {children}
    </PromptMonitorContext.Provider>
  );
};

export default PromptMonitorContext;

// ============================================
// 全局事件系统 (用于 geminiService 广播)
// ============================================

type PromptEventCallback = (record: Omit<PromptRecord, 'id' | 'timestamp'>) => string;
type PromptUpdateCallback = (id: string, updates: Partial<PromptRecord>) => void;

let globalAddRecord: PromptEventCallback | null = null;
let globalUpdateRecord: PromptUpdateCallback | null = null;

// 注册全局回调 (由 PromptMonitor 组件调用)
export const registerPromptCallbacks = (
  addFn: PromptEventCallback,
  updateFn: PromptUpdateCallback
) => {
  globalAddRecord = addFn;
  globalUpdateRecord = updateFn;
};

// 取消注册
export const unregisterPromptCallbacks = () => {
  globalAddRecord = null;
  globalUpdateRecord = null;
};

// 广播新请求 (由 geminiService 调用)
export const broadcastPromptRequest = (
  record: Omit<PromptRecord, 'id' | 'timestamp'>
): string | null => {
  if (globalAddRecord) {
    return globalAddRecord(record);
  }
  return null;
};

// 广播请求更新 (由 geminiService 调用)
export const broadcastPromptUpdate = (
  id: string,
  updates: Partial<PromptRecord>
) => {
  if (globalUpdateRecord) {
    globalUpdateRecord(id, updates);
  }
};
