/**
 * Outline Parser Service
 * 
 * Converts markdown-style outlines to structured OutlineSection arrays
 * for compatibility with Client Portal's OutlineReview component.
 */

export interface OutlineSection {
  id: string;
  level: 'H1' | 'H2' | 'H3';
  title: string;
  description?: string;
  wordCountEstimate?: number;
}

/**
 * Generate a unique ID (using browser's crypto API)
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Parse Markdown-style outline to structured OutlineSection array
 * 
 * Supported formats:
 * # H1 Title
 * Description text (optional, on next line)
 * 
 * ## H2 Title
 * Description text
 * 
 * ### H3 Title
 * 
 * Also supports:
 * - Bullet points as description
 * * Bullet points as description
 */
export function parseMarkdownOutline(markdown: string): OutlineSection[] {
  if (!markdown || !markdown.trim()) {
    return [];
  }

  const sections: OutlineSection[] = [];
  const lines = markdown.split('\n');
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) {
      i++;
      continue;
    }
    
    // Match H1/H2/H3 headers (must check H3 first due to regex specificity)
    const h3Match = line.match(/^###\s+(.+)$/);
    const h2Match = line.match(/^##\s+(.+)$/);
    const h1Match = line.match(/^#\s+(.+)$/);
    
    let level: 'H1' | 'H2' | 'H3' | null = null;
    let title: string | null = null;
    
    if (h3Match) {
      level = 'H3';
      title = h3Match[1].trim();
    } else if (h2Match) {
      level = 'H2';
      title = h2Match[1].trim();
    } else if (h1Match) {
      level = 'H1';
      title = h1Match[1].trim();
    }
    
    if (level && title) {
      // Collect description lines (non-header lines following this header)
      const descriptionLines: string[] = [];
      let j = i + 1;
      
      while (j < lines.length) {
        const nextLine = lines[j].trim();
        
        // Stop if we hit another header or empty line followed by header
        if (nextLine.startsWith('#')) {
          break;
        }
        
        // Skip empty lines
        if (!nextLine) {
          j++;
          continue;
        }
        
        // Collect bullet points or plain text as description
        if (nextLine.startsWith('-') || nextLine.startsWith('*')) {
          descriptionLines.push(nextLine.substring(1).trim());
        } else {
          descriptionLines.push(nextLine);
        }
        
        j++;
        
        // Only take first few lines as description
        if (descriptionLines.length >= 3) {
          break;
        }
      }
      
      const description = descriptionLines.length > 0 
        ? descriptionLines.join('; ') 
        : undefined;
      
      sections.push({
        id: generateId(),
        level,
        title,
        description,
        wordCountEstimate: estimateWordCount(level, description)
      });
      
      // Move past the description lines we consumed
      i = j;
    } else {
      i++;
    }
  }
  
  return sections;
}

/**
 * Estimate word count based on section level
 * H1 sections typically need more content than H3
 */
function estimateWordCount(level: string, description?: string): number {
  const baseWordCounts: Record<string, number> = {
    'H1': 500,
    'H2': 300,
    'H3': 150
  };
  
  const base = baseWordCounts[level] || 200;
  const descBonus = description ? Math.min(description.length / 10, 100) : 0;
  
  return Math.round(base + descBonus);
}

/**
 * Validate markdown outline format
 * Returns validation status and any errors found
 */
export function validateMarkdownOutline(markdown: string): { 
  valid: boolean; 
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!markdown || !markdown.trim()) {
    errors.push('大纲内容不能为空');
    return { valid: false, errors, warnings };
  }
  
  const lines = markdown.split('\n').map(l => l.trim()).filter(l => l);
  
  let hasH1 = false;
  let hasAnyHeader = false;
  
  for (const line of lines) {
    if (line.startsWith('#')) {
      hasAnyHeader = true;
      
      // Check for valid header format
      if (!line.match(/^#{1,3}\s+.+$/)) {
        errors.push(`无效的标题格式: "${line.substring(0, 30)}..."`);
      }
      
      // Check for H1
      if (line.match(/^#\s+.+$/)) {
        hasH1 = true;
      }
      
      // Warn about H4+ (not supported)
      if (line.match(/^#{4,}\s+/)) {
        warnings.push(`仅支持 H1-H3 层级，发现更深层级: "${line.substring(0, 30)}..."`);
      }
    }
  }
  
  if (!hasAnyHeader) {
    errors.push('大纲必须包含至少一个标题（使用 # 开头）');
  }
  
  if (hasAnyHeader && !hasH1) {
    warnings.push('建议添加一个 H1 主标题（# 标题）');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Generate a template markdown outline
 */
export function generateOutlineTemplate(): string {
  return `# 主标题
简短描述主要内容方向和目标受众

## 第一节：引言
- 吸引读者注意力的开头
- 介绍主题背景
- 本文要解决的问题

### 1.1 背景介绍
具体背景信息和上下文

### 1.2 核心问题
读者面临的主要挑战

## 第二节：核心内容
深入探讨主要观点

### 2.1 关键要点一
详细说明和案例

### 2.2 关键要点二
数据支持和分析

## 第三节：实践指南
可操作的建议和步骤

### 3.1 步骤一
具体操作方法

### 3.2 步骤二
注意事项和技巧

## 结论
- 总结要点
- 行动号召
- 后续资源`;
}

/**
 * Convert structured OutlineSection array back to Markdown
 * Useful for editing or display
 */
export function sectionsToMarkdown(sections: OutlineSection[]): string {
  return sections.map(section => {
    const prefix = '#'.repeat(
      section.level === 'H1' ? 1 : 
      section.level === 'H2' ? 2 : 3
    );
    
    let md = `${prefix} ${section.title}`;
    
    if (section.description) {
      md += `\n${section.description}`;
    }
    
    return md;
  }).join('\n\n');
}

/**
 * Get statistics about the outline
 */
export function getOutlineStats(sections: OutlineSection[]): {
  totalSections: number;
  h1Count: number;
  h2Count: number;
  h3Count: number;
  estimatedTotalWords: number;
} {
  const stats = {
    totalSections: sections.length,
    h1Count: 0,
    h2Count: 0,
    h3Count: 0,
    estimatedTotalWords: 0
  };
  
  for (const section of sections) {
    if (section.level === 'H1') stats.h1Count++;
    if (section.level === 'H2') stats.h2Count++;
    if (section.level === 'H3') stats.h3Count++;
    stats.estimatedTotalWords += section.wordCountEstimate || 0;
  }
  
  return stats;
}




