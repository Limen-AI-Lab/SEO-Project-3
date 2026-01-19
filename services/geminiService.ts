import { GoogleGenAI, Type } from "@google/genai";
import {
  Comment,
  WordCountRange,
  ArticlePerspective,
  WORD_COUNT_CONFIG,
  PERSPECTIVE_CONFIG,
} from "../types";

// ============================================
// Generation Result Types
// ============================================

export interface GenerationResult {
  content: string;
  warnings?: string[];
}

// ============================================
// Validation Utility Functions
// ============================================

// Perspective keywords for detection
const PERSPECTIVE_KEYWORDS = {
  first: {
    en: ['we', 'our', 'us', 'ourselves', 'i', 'my', 'me', 'myself'],
    zh: ['我们', '我', '本公司', '我司', '我方', '本文', '笔者']
  },
  second: {
    en: ['you', 'your', 'yours', 'yourself', 'yourselves'],
    zh: ['你', '您', '你的', '您的', '你们', '您们']
  },
  third: {
    en: ['the company', 'the firm', 'they', 'their', 'them', 'it', 'its', 'one', 'people', 'users', 'customers', 'clients'],
    zh: ['该公司', '该企业', '他们', '其', '人们', '用户', '客户', '企业', '公司']
  }
};

/**
 * Count words for English or characters for Chinese
 */
export const countWords = (text: string, language: string): number => {
  const isEnglish = language.toLowerCase() === 'english';
  
  if (isEnglish) {
    // English: count words (split by whitespace)
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    return words.length;
  } else {
    // Chinese: count characters (excluding spaces and punctuation)
    const chineseChars = text.replace(/[\s\p{P}]/gu, '');
    return chineseChars.length;
  }
};

/**
 * Count H2 sections in markdown outline
 */
export const countH2Sections = (outline: string): number => {
  const h2Regex = /^##\s+[^#]/gm;
  const matches = outline.match(h2Regex);
  return matches ? matches.length : 0;
};

/**
 * Count H3 sections in markdown outline
 */
export const countH3Sections = (outline: string): number => {
  const h3Regex = /^###\s+[^#]/gm;
  const matches = outline.match(h3Regex);
  return matches ? matches.length : 0;
};

/**
 * Parse outline and calculate suggested word count per section
 * Returns a breakdown of how words should be distributed
 */
export const calculateSectionWordCounts = (
  outline: string,
  targetMin: number,
  targetMax: number
): { h2Count: number; h3Count: number; wordsPerH2: number; totalSections: number; targetAvg: number } => {
  const h2Count = countH2Sections(outline);
  const h3Count = countH3Sections(outline);
  
  // Total content sections (H2 + H3)
  const totalSections = h2Count + h3Count;
  
  // Calculate target average (middle of range)
  const targetAvg = Math.floor((targetMin + targetMax) / 2);
  
  // H2 sections typically have more content than H3
  // Allocate ~60% of words to H2s and ~40% to H3s (if H3s exist)
  let wordsPerH2: number;
  if (h3Count > 0 && h2Count > 0) {
    // Weighted distribution: H2 gets more words
    const h2Share = 0.6;
    const wordsForH2s = targetAvg * h2Share;
    wordsPerH2 = Math.floor(wordsForH2s / h2Count);
  } else if (h2Count > 0) {
    // Only H2s, distribute evenly
    wordsPerH2 = Math.floor(targetAvg / h2Count);
  } else {
    wordsPerH2 = targetAvg;
  }
  
  return {
    h2Count,
    h3Count,
    wordsPerH2,
    totalSections,
    targetAvg
  };
};

/**
 * Detect perspective usage in text and return ratio of target perspective
 * Returns a number between 0 and 1
 */
export const detectPerspectiveRatio = (
  text: string, 
  targetPerspective: ArticlePerspective, 
  language: string
): number => {
  const isEnglish = language.toLowerCase() === 'english';
  const lang = isEnglish ? 'en' : 'zh';
  const lowerText = text.toLowerCase();
  
  let targetCount = 0;
  let totalCount = 0;
  
  // Count occurrences of each perspective's keywords
  for (const [perspective, keywords] of Object.entries(PERSPECTIVE_KEYWORDS)) {
    const keywordList = keywords[lang as 'en' | 'zh'];
    for (const keyword of keywordList) {
      const regex = new RegExp(isEnglish ? `\\b${keyword}\\b` : keyword, 'gi');
      const matches = lowerText.match(regex);
      const count = matches ? matches.length : 0;
      
      if (perspective === targetPerspective) {
        targetCount += count;
      }
      totalCount += count;
    }
  }
  
  if (totalCount === 0) return 1; // No pronouns found, assume OK
  return targetCount / totalCount;
};

/**
 * Use AI to fix perspective in content
 */
const fixPerspectiveWithAI = async (
  content: string,
  targetPerspective: ArticlePerspective,
  language: string
): Promise<string> => {
  try {
    const ai = getAiClient();
    const isEnglish = language.toLowerCase() === 'english';
    
    const perspectiveLabels = {
      first: isEnglish ? 'first person ("we", "our", "us")' : '第一人称（"我们"、"我"、"本公司"）',
      second: isEnglish ? 'second person ("you", "your")' : '第二人称（"你"、"您"）',
      third: isEnglish ? 'third person (objective tone)' : '第三人称（客观叙述）'
    };
    
    let prompt: string;
    if (isEnglish) {
      prompt = `You are a professional editor. The following article needs to be rewritten to consistently use ${perspectiveLabels[targetPerspective]} throughout.

IMPORTANT:
- Change ALL pronouns and references to match the target perspective
- Keep the content, structure, and meaning exactly the same
- Only change the perspective/voice
- Return ONLY the corrected article, no explanations

Article to fix:
${content}`;
    } else {
      prompt = `你是一位专业编辑。以下文章需要改写为全文统一使用${perspectiveLabels[targetPerspective]}。

重要要求：
- 将所有人称代词和表述改为目标人称
- 保持内容、结构和含义完全不变
- 只修改人称视角
- 只返回修正后的文章，不要解释

需要修正的文章：
${content}`;
    }
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    return response.text || content;
  } catch (error) {
    console.error("Failed to fix perspective:", error);
    return content;
  }
};

// ============================================
// Constants
// ============================================

const MAX_RETRY_COUNT = 3;
const PERSPECTIVE_THRESHOLD = 0.7; // 70%

// Initialize the client
// NOTE: In Vite, use import.meta.env instead of process.env
// API Key should be in .env file as VITE_GEMINI_API_KEY
const getAiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

  if (!apiKey) {
    console.warn("VITE_GEMINI_API_KEY is not set. AI features will not work.");
  }

  return new GoogleGenAI({ apiKey });
};

export interface TitleGenerationParams {
  topic: string;
  clientName: string;
  targetAudience: string;
  keywords: string;
  language: string;
  tone: string;
  rules?: string;
}

export const generateBlogTitles = async (
  params: TitleGenerationParams
): Promise<string[]> => {
  try {
    const ai = getAiClient();

    const prompt = `Generate 5 professional, SEO-friendly blog post titles for a firm named "${
      params.clientName
    }".
    
    Parameters:
    - Topic/Subject: "${params.topic}"
    - Target Audience: "${params.targetAudience}"
    - Keywords to include: "${params.keywords}"
    - Language: "${params.language}"
    - Tone of Voice: "${params.tone}"
    ${params.rules ? `- Strict Content Rules: "${params.rules}"` : ""}
    
    The titles should be catchy, relevant, and optimized for search engines.
    Return ONLY a JSON array of strings.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    });

    const jsonStr = response.text;
    if (!jsonStr) return [];
    return JSON.parse(jsonStr) as string[];
  } catch (error) {
    console.error("Failed to generate titles:", error);
    return [];
  }
};

export interface KeywordSuggestion {
  keyword: string;
  volume: "High" | "Medium" | "Low";
}

export const suggestBlogKeywords = async (
  topic: string,
  audience: string,
  clientName: string
): Promise<KeywordSuggestion[]> => {
  try {
    const ai = getAiClient();
    const prompt = `Act as an SEO Expert with access to search trend data.
    Generate 10 high-potential, relevant keywords/phrases for a blog post.
    
    Context:
    - Topic: "${topic}"
    - Target Audience: "${audience}"
    - Client: "${clientName}"
    
    For each keyword, estimate the search volume relevance (High, Medium, Low).
    Prioritize "High" volume, low difficulty keywords if possible.
    
    Return ONLY a JSON array of objects with keys: "keyword" and "volume".`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              keyword: { type: Type.STRING },
              volume: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
            },
          },
        },
      },
    });

    const jsonStr = response.text;
    if (!jsonStr) return [];
    return JSON.parse(jsonStr) as KeywordSuggestion[];
  } catch (error) {
    console.error("Failed to suggest keywords:", error);
    return [];
  }
};

interface OutlineGenerationParams {
  selectedTitle: string;
  campaignGoals?: string;
  keywords?: string[];
  targetAudience?: string;
  clientComments?: Array<{ author: string; text: string; timestamp: Date }>;
  language?: string; // Target language for outline content (e.g., "English", "Chinese")
  wordCountRange?: WordCountRange; // Target word count range (affects H2 count)
  perspective?: ArticlePerspective; // Writing perspective (first/second/third person)
}

/**
 * Build the outline generation prompt
 */
const buildOutlinePrompt = (
  params: OutlineGenerationParams,
  retryFeedback?: string
): { prompt: string; wordCountConfig: typeof WORD_COUNT_CONFIG['1000-2000']; isEnglish: boolean } => {
  // Determine target language (default to English)
  const targetLanguage = params.language || "English";
  const isEnglish = targetLanguage.toLowerCase() === "english";

  // Get word count and H2 count configuration
  const wordCountConfig = params.wordCountRange
    ? WORD_COUNT_CONFIG[params.wordCountRange]
    : WORD_COUNT_CONFIG["1000-2000"];
  const perspectiveConfig = params.perspective
    ? PERSPECTIVE_CONFIG[params.perspective]
    : PERSPECTIVE_CONFIG["third"];

  // Calculate H3 count based on H2 count (1-2 H3 per H2, total around 7-8)
  const h3Min = wordCountConfig.h2Min;
  const h3Max = wordCountConfig.h2Max * 2;

  // Build comprehensive context from all available information
  let contextParts: string[] = [];

  // 1. Primary directive and title (most important)
  if (isEnglish) {
    contextParts.push(
      `You are creating a concise blog post outline for the following title:\n"${params.selectedTitle}"`
    );
  } else {
    contextParts.push(
      `您正在为以下标题创建简洁的博客文章大纲：\n"${params.selectedTitle}"`
    );
  }

  // 2. Word count and structure requirements (CRITICAL - emphasized)
  if (isEnglish) {
    contextParts.push(`
⚠️ CRITICAL STRUCTURE REQUIREMENTS (MUST FOLLOW EXACTLY):
- Number of H2 sections: EXACTLY ${wordCountConfig.h2Min}-${wordCountConfig.h2Max} sections (THIS IS MANDATORY)
- Number of H3 subsections: ${h3Min}-${h3Max} total (1-2 per H2 section)
- Target article word count: ${wordCountConfig.min}-${wordCountConfig.max} words
- Writing perspective: ${perspectiveConfig.label} (${perspectiveConfig.description})`);
  } else {
    contextParts.push(`
⚠️ 关键结构要求（必须严格遵守）：
- H2章节数量：必须正好 ${wordCountConfig.h2Min}-${wordCountConfig.h2Max} 个（这是强制要求）
- H3子章节数量：总共 ${h3Min}-${h3Max} 个（每个H2下1-2个H3）
- 目标文章字数：${wordCountConfig.min}-${wordCountConfig.max} 字
- 写作视角：${perspectiveConfig.label}（${perspectiveConfig.description}）`);
  }

  // 3. Campaign strategy and goals
  if (params.campaignGoals && params.campaignGoals.trim()) {
    if (isEnglish) {
      contextParts.push(
        `\nMarketing Strategy Goals:\n${params.campaignGoals}`
      );
    } else {
      contextParts.push(`\n营销策略目标：\n${params.campaignGoals}`);
    }
  }

  // 4. Keywords for SEO
  if (params.keywords && params.keywords.length > 0) {
    if (isEnglish) {
      contextParts.push(
        `\nKeywords (integrate naturally into headings):\n${params.keywords.join(
          ", "
        )}`
      );
    } else {
      contextParts.push(
        `\n关键词（请自然融入标题）：\n${params.keywords.join(", ")}`
      );
    }
  }

  // 5. Target audience
  if (params.targetAudience && params.targetAudience.trim()) {
    if (isEnglish) {
      contextParts.push(`\nTarget Audience:\n${params.targetAudience}`);
    } else {
      contextParts.push(`\n目标受众：\n${params.targetAudience}`);
    }
  }

  // 6. Client feedback and requirements
  if (params.clientComments && params.clientComments.length > 0) {
    const commentsText = params.clientComments
      .map((c) => `- ${c.text}`)
      .join("\n");
    if (isEnglish) {
      contextParts.push(
        `\nClient Feedback and Requirements (must be fully considered):\n${commentsText}`
      );
    } else {
      contextParts.push(
        `\n客户反馈和要求（必须充分考虑）：\n${commentsText}`
      );
    }
  }

  // 7. Retry feedback (if this is a retry attempt)
  if (retryFeedback) {
    if (isEnglish) {
      contextParts.push(`\n🚨 CORRECTION NEEDED: ${retryFeedback}`);
    } else {
      contextParts.push(`\n🚨 需要修正：${retryFeedback}`);
    }
  }

  const context = contextParts.join("\n");

  // Generate prompt based on target language
  let prompt: string;

  if (isEnglish) {
    prompt = `${context}

Create a CONCISE blog post outline with ONLY headings (H1, H2, H3). NO descriptions or explanations under headings.

**CRITICAL RULES - MUST FOLLOW**:
1. Output ONLY heading lines starting with #, ##, or ###
2. DO NOT add any text below headings - just headings only
3. DO NOT add bullet points, descriptions, or explanations
4. Exactly 1 H1 (main title)
5. ⚠️ EXACTLY ${wordCountConfig.h2Min}-${wordCountConfig.h2Max} H2 sections - COUNT CAREFULLY BEFORE SUBMITTING
6. Only ${h3Min}-${h3Max} H3 subsections total (1-2 per H2, some H2s may have no H3)
7. Keep outline compact to fit ${wordCountConfig.min}-${wordCountConfig.max} word article
8. Use ${perspectiveConfig.label} perspective

**CORRECT FORMAT EXAMPLE**:
# Main Title

## Section One

### Subtopic 1.1

## Section Two

### Subtopic 2.1

### Subtopic 2.2

## Section Three

## Conclusion

**WRONG FORMAT (DO NOT DO THIS)**:
# Main Title
This is a description - DO NOT ADD THIS

## Section One
Explaining what this section covers - DO NOT ADD THIS

⚠️ FINAL CHECK: Before returning, COUNT your H2 sections. You MUST have exactly ${wordCountConfig.h2Min}-${wordCountConfig.h2Max} H2 sections.

Return ONLY the Markdown headings, nothing else.`;
  } else {
    prompt = `${context}

创建一个简洁的博客文章大纲，只包含标题（H1、H2、H3）。标题下不要有任何描述或说明文字。

**必须严格遵守的规则**：
1. 只输出以 #、## 或 ### 开头的标题行
2. 标题下方不要添加任何文字 - 只有标题
3. 不要添加列表项、描述或解释
4. 只有 1 个 H1（主标题）
5. ⚠️ 必须正好 ${wordCountConfig.h2Min}-${wordCountConfig.h2Max} 个 H2 章节 - 提交前请仔细数一数
6. 总共只有 ${h3Min}-${h3Max} 个 H3 子章节（每个H2下1-2个，有些H2可以没有H3）
7. 保持大纲紧凑，以适应 ${wordCountConfig.min}-${wordCountConfig.max} 字的文章
8. 使用${perspectiveConfig.label}视角

**正确格式示例**：
# 主标题

## 第一章节

### 子主题 1.1

## 第二章节

### 子主题 2.1

### 子主题 2.2

## 第三章节

## 总结

**错误格式（不要这样做）**：
# 主标题
这是描述文字 - 不要添加这个

## 第一章节
说明本章节内容 - 不要添加这个

⚠️ 最终检查：返回前请数一数你的 H2 章节数量，必须正好是 ${wordCountConfig.h2Min}-${wordCountConfig.h2Max} 个。

只返回 Markdown 标题，不要有其他内容。`;
  }

  return { prompt, wordCountConfig, isEnglish };
};

export const generateBlogOutline = async (
  params: OutlineGenerationParams
): Promise<GenerationResult> => {
  const warnings: string[] = [];
  let bestResult = "";
  let bestH2Diff = Infinity;
  
  try {
    const ai = getAiClient();
    const { wordCountConfig, isEnglish } = buildOutlinePrompt(params);
    
    for (let attempt = 0; attempt <= MAX_RETRY_COUNT; attempt++) {
      // Build prompt with retry feedback if needed
      let retryFeedback: string | undefined;
      if (attempt > 0 && bestResult) {
        const currentH2Count = countH2Sections(bestResult);
        if (isEnglish) {
          retryFeedback = `Your previous outline had ${currentH2Count} H2 sections, but the requirement is ${wordCountConfig.h2Min}-${wordCountConfig.h2Max}. Please regenerate with the correct number of H2 sections.`;
        } else {
          retryFeedback = `你上次生成的大纲有 ${currentH2Count} 个 H2 章节，但要求是 ${wordCountConfig.h2Min}-${wordCountConfig.h2Max} 个。请重新生成正确数量的 H2 章节。`;
        }
      }
      
      const { prompt } = buildOutlinePrompt(params, retryFeedback);
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      
      const content = response.text || "";
      if (!content) continue;
      
      // Validate H2 count
      const h2Count = countH2Sections(content);
      const h2Diff = h2Count < wordCountConfig.h2Min 
        ? wordCountConfig.h2Min - h2Count 
        : h2Count > wordCountConfig.h2Max 
          ? h2Count - wordCountConfig.h2Max 
          : 0;
      
      // Track best result (closest to target)
      if (h2Diff < bestH2Diff) {
        bestH2Diff = h2Diff;
        bestResult = content;
      }
      
      // If valid, return immediately
      if (h2Count >= wordCountConfig.h2Min && h2Count <= wordCountConfig.h2Max) {
        return { content, warnings: [] };
      }
      
      // If this was the last attempt, break
      if (attempt === MAX_RETRY_COUNT) break;
    }
    
    // If we get here, validation failed after all retries
    const finalH2Count = countH2Sections(bestResult);
    if (isEnglish) {
      warnings.push(`H2 section count (${finalH2Count}) is outside the target range (${wordCountConfig.h2Min}-${wordCountConfig.h2Max}). Please adjust manually if needed.`);
    } else {
      warnings.push(`H2 章节数量（${finalH2Count}）不在目标范围（${wordCountConfig.h2Min}-${wordCountConfig.h2Max}）内，请根据需要手动调整。`);
    }
    
    return { content: bestResult, warnings };
  } catch (error) {
    console.error("Failed to generate outline:", error);
    return { content: "", warnings: ["Failed to generate outline"] };
  }
};

export const refineBlogOutline = async (
  currentOutline: string,
  instruction: string
): Promise<string> => {
  try {
    const ai = getAiClient();
    const prompt = `Act as a professional editor. Modify the following blog post outline based strictly on this instruction: "${instruction}".
    
    Current Outline:
    ${currentOutline}
    
    Return the updated outline in Markdown format. Do not add conversational filler.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text || currentOutline;
  } catch (error) {
    console.error("Failed to refine outline:", error);
    return currentOutline;
  }
};

interface DraftGenerationParams {
  title: string;
  outline: string;
  comments: Comment[];
  clientName: string;
  wordCountRange?: WordCountRange;
  perspective?: ArticlePerspective;
  language?: string;
  // New config options
  articleRequirements?: string;    // Custom requirements (brand name, forbidden words, etc.)
  includeFaq?: boolean;            // Whether to generate FAQ section
  includeKeyPoints?: boolean;      // Whether to generate Key Points section
}

/**
 * Build the draft generation prompt
 */
const buildDraftPrompt = (
  params: DraftGenerationParams,
  retryFeedback?: { wordCount?: string; perspective?: string }
): { prompt: string; wordCountConfig: typeof WORD_COUNT_CONFIG['1000-2000']; perspectiveConfig: typeof PERSPECTIVE_CONFIG['third']; isEnglish: boolean } => {
  // Get word count and perspective configuration
  const wordCountConfig = params.wordCountRange
    ? WORD_COUNT_CONFIG[params.wordCountRange]
    : WORD_COUNT_CONFIG["1000-2000"];
  const perspectiveConfig = params.perspective
    ? PERSPECTIVE_CONFIG[params.perspective]
    : PERSPECTIVE_CONFIG["third"];

  // Determine target language
  const targetLanguage = params.language || "English";
  const isEnglish = targetLanguage.toLowerCase() === "english";

  // Calculate section word counts based on outline structure
  const sectionCounts = calculateSectionWordCounts(
    params.outline,
    wordCountConfig.min,
    wordCountConfig.max
  );

  let commentsContext = "";
  if (params.comments.length > 0) {
    if (isEnglish) {
      commentsContext = `
IMPORTANT: You must incorporate the following feedback from the client into the draft:
${params.comments.map((c) => `- "${c.text}" (from ${c.author})`).join("\n")}
`;
    } else {
      commentsContext = `
重要：请在正文中融入以下客户反馈：
${params.comments.map((c) => `- "${c.text}" (来自 ${c.author})`).join("\n")}
`;
    }
  }

  // Build perspective instruction with examples
  let perspectiveInstruction: string;
  if (isEnglish) {
    switch (params.perspective) {
      case "first":
        perspectiveInstruction =
          '⚠️ CRITICAL: Use FIRST PERSON perspective throughout the ENTIRE article. Use "we", "our", "us", "our team", "our company". NEVER use "the company", "they", "it", or "you".';
        break;
      case "second":
        perspectiveInstruction =
          '⚠️ CRITICAL: Use SECOND PERSON perspective throughout the ENTIRE article. Use "you", "your", "yours". Directly address the reader. NEVER use "we", "the company", or "they".';
        break;
      case "third":
      default:
        perspectiveInstruction =
          '⚠️ CRITICAL: Use THIRD PERSON perspective with objective, professional tone throughout the ENTIRE article. Use "the company", "they", "it", "one", "people". NEVER use "we", "our", or "you".';
    }
  } else {
    switch (params.perspective) {
      case "first":
        perspectiveInstruction =
          '⚠️ 关键要求：全文必须使用第一人称视角。使用"我们"、"本公司"、"我司"、"我方"。绝不使用"该公司"、"他们"、"您"、"你"。';
        break;
      case "second":
        perspectiveInstruction =
          '⚠️ 关键要求：全文必须使用第二人称视角。使用"您"、"你"、"你的"、"您的"。直接与读者对话。绝不使用"我们"、"该公司"、"他们"。';
        break;
      case "third":
      default:
        perspectiveInstruction =
          '⚠️ 关键要求：全文必须使用第三人称视角，保持客观、专业的叙述方式。使用"该公司"、"企业"、"用户"、"人们"。绝不使用"我们"、"您"、"你"。';
    }
  }

  // Build word count distribution instruction based on outline analysis
  let wordCountDistribution: string;
  if (isEnglish) {
    wordCountDistribution = `
📊 WORD COUNT DISTRIBUTION (based on your outline with ${sectionCounts.h2Count} H2 sections${sectionCounts.h3Count > 0 ? ` and ${sectionCounts.h3Count} H3 subsections` : ''}):
- Target total: ${sectionCounts.targetAvg} words (range: ${wordCountConfig.min}-${wordCountConfig.max})
- Suggested per H2 section: ~${sectionCounts.wordsPerH2} words (including any H3 subsections)
- IMPORTANT: Keep each section CONCISE and FOCUSED. Cover the key points briefly.
- If the outline has many sections, you MUST write shorter content for each section to stay within the total word limit.
- Prioritize QUALITY over QUANTITY - it's better to be concise than to exceed the word limit.`;
  } else {
    wordCountDistribution = `
📊 字数分配方案（基于您的大纲，共 ${sectionCounts.h2Count} 个 H2 章节${sectionCounts.h3Count > 0 ? `和 ${sectionCounts.h3Count} 个 H3 子章节` : ''}）：
- 目标总字数：${sectionCounts.targetAvg} 字（范围：${wordCountConfig.min}-${wordCountConfig.max}）
- 每个 H2 章节建议字数：约 ${sectionCounts.wordsPerH2} 字（包含其下的 H3 子章节）
- 重要：每个章节必须简洁精炼，只讲核心要点
- 如果大纲章节较多，每个章节的内容必须更加精简，以确保总字数不超标
- 质量优先于数量 - 宁可精简也不要超出字数限制`;
  }

  // Build retry feedback section
  let retrySection = "";
  if (retryFeedback) {
    if (isEnglish) {
      if (retryFeedback.wordCount) {
        retrySection += `\n🚨 WORD COUNT CORRECTION: ${retryFeedback.wordCount}`;
      }
      if (retryFeedback.perspective) {
        retrySection += `\n🚨 PERSPECTIVE CORRECTION: ${retryFeedback.perspective}`;
      }
    } else {
      if (retryFeedback.wordCount) {
        retrySection += `\n🚨 字数修正：${retryFeedback.wordCount}`;
      }
      if (retryFeedback.perspective) {
        retrySection += `\n🚨 人称修正：${retryFeedback.perspective}`;
      }
    }
  }

  // Build custom requirements section
  let customRequirementsSection = "";
  if (params.articleRequirements && params.articleRequirements.trim()) {
    if (isEnglish) {
      customRequirementsSection = `
4. CUSTOM REQUIREMENTS (MUST FOLLOW):
${params.articleRequirements}
`;
    } else {
      customRequirementsSection = `
4. 自定义要求（必须遵守）：
${params.articleRequirements}
`;
    }
  }

  let prompt: string;

  if (isEnglish) {
    prompt = `Write a full blog post draft for a firm named "${params.clientName}".
${retrySection}

Title: "${params.title}"

Follow this structure strictly:
${params.outline}

${commentsContext}

**⚠️ CRITICAL WRITING REQUIREMENTS (MUST FOLLOW EXACTLY)**:

1. PERSPECTIVE (MANDATORY):
${perspectiveInstruction}

2. WORD COUNT (MANDATORY - THIS IS THE MOST IMPORTANT REQUIREMENT):
- The article MUST be between ${wordCountConfig.min}-${wordCountConfig.max} words. NO EXCEPTIONS.
- This is a HARD LIMIT. You MUST stay within this range.
- Count your words carefully before finishing.
${wordCountDistribution}

⚠️ WORD COUNT STRATEGY:
- Write SHORT, CONCISE paragraphs (2-3 sentences max per paragraph)
- Use bullet points to convey information efficiently
- Focus on KEY POINTS only, skip unnecessary details
- Each H2 section should be brief but complete
- If you find yourself writing too much, STOP and condense

3. FORMAT:
- Tone: Professional, Authoritative, yet Accessible.
- Format: Markdown. Use bold (**text**) for emphasis.
- Do NOT use single asterisks (*) for italics. Use asterisks ONLY for bullet points.

${customRequirementsSection}
⚠️ FINAL CHECK BEFORE SUBMITTING:
1. COUNT YOUR WORDS - You MUST be within ${wordCountConfig.min}-${wordCountConfig.max} words. If over, DELETE content until you're within range.
2. Check perspective - MUST consistently use ${perspectiveConfig.label}

Do not include preambles like "Here is the draft". Do not include word count statistics like "Word Count: XXX words". Just start with the content.`;
  } else {
    prompt = `为"${params.clientName}"撰写一篇完整的博客文章。
${retrySection}

标题："${params.title}"

请严格按照以下大纲结构撰写：
${params.outline}

${commentsContext}

**⚠️ 关键写作要求（必须严格遵守）**：

1. 人称视角（强制要求）：
${perspectiveInstruction}

2. 字数要求（强制要求 - 这是最重要的要求）：
- 文章字数必须在 ${wordCountConfig.min}-${wordCountConfig.max} 字之间，没有例外
- 这是硬性限制，必须严格遵守
- 完成前请仔细数一数字数
${wordCountDistribution}

⚠️ 字数控制策略：
- 每个段落要简短精炼（每段最多2-3句话）
- 善用列表来高效传达信息
- 只讲核心要点，省略不必要的细节
- 每个 H2 章节要简洁但完整
- 如果发现写得太多，立即停下来精简内容

3. 格式要求：
- 语气：专业、权威，同时保持亲和力
- 格式：Markdown。可以使用粗体（**文字**）进行强调
- 不要使用单星号 (*) 进行斜体强调。星号仅用于列表项

${customRequirementsSection}
⚠️ 提交前最终检查：
1. 数一数字数 - 必须在 ${wordCountConfig.min}-${wordCountConfig.max} 字之间。如果超出，请删减内容直到符合要求。
2. 检查人称 - 必须全文统一使用${perspectiveConfig.label}

不要包含"以下是草稿"之类的开场白，不要包含"字数统计"或"Word Count"等信息，直接开始正文内容。`;
  }

  return { prompt, wordCountConfig, perspectiveConfig, isEnglish };
};

export const generateBlogDraft = async (
  titleOrParams: string | DraftGenerationParams,
  outline?: string,
  comments?: Comment[],
  clientName?: string
): Promise<GenerationResult> => {
  const warnings: string[] = [];
  let bestResult = "";
  let bestScore = -Infinity; // Higher is better (closer to target)
  
  try {
    const ai = getAiClient();

    // Support both old and new function signatures
    let params: DraftGenerationParams;
    if (typeof titleOrParams === "string") {
      // Legacy call: generateBlogDraft(title, outline, comments, clientName)
      params = {
        title: titleOrParams,
        outline: outline || "",
        comments: comments || [],
        clientName: clientName || "",
      };
    } else {
      // New call: generateBlogDraft(params)
      params = titleOrParams;
    }

    const { wordCountConfig, isEnglish } = buildDraftPrompt(params);
    const targetLanguage = params.language || "English";
    const targetPerspective = params.perspective || "third";
    
    for (let attempt = 0; attempt <= MAX_RETRY_COUNT; attempt++) {
      // Build retry feedback if needed
      let retryFeedback: { wordCount?: string; perspective?: string } | undefined;
      
      if (attempt > 0 && bestResult) {
        const currentWordCount = countWords(bestResult, targetLanguage);
        const currentPerspectiveRatio = detectPerspectiveRatio(bestResult, targetPerspective, targetLanguage);
        
        retryFeedback = {};
        
        if (currentWordCount < wordCountConfig.min || currentWordCount > wordCountConfig.max) {
          const overBy = currentWordCount - wordCountConfig.max;
          const underBy = wordCountConfig.min - currentWordCount;
          
          if (currentWordCount > wordCountConfig.max) {
            // Over word limit - provide detailed reduction instructions
            if (isEnglish) {
              retryFeedback.wordCount = `🚨 CRITICAL: Your previous draft had ${currentWordCount} words, which is ${overBy} words OVER the maximum of ${wordCountConfig.max}. 
You MUST reduce by at least ${overBy} words. Strategies:
- Shorten each paragraph to 2-3 sentences maximum
- Remove redundant explanations and examples
- Use bullet points instead of long paragraphs
- Keep only the most essential information in each section
- Combine similar points into single concise statements`;
            } else {
              retryFeedback.wordCount = `🚨 严重问题：你上次的草稿有 ${currentWordCount} 字，超出上限 ${wordCountConfig.max} 字达 ${overBy} 字。
你必须至少减少 ${overBy} 字。精简策略：
- 每个段落最多2-3句话
- 删除冗余的解释和举例
- 用列表代替长段落
- 每个章节只保留最核心的信息
- 将相似的观点合并为一句简洁的陈述`;
            }
          } else {
            // Under word limit
            if (isEnglish) {
              retryFeedback.wordCount = `Your previous draft had ${currentWordCount} words, which is ${underBy} words under the minimum of ${wordCountConfig.min}. Please add more detail while staying within ${wordCountConfig.min}-${wordCountConfig.max} words.`;
            } else {
              retryFeedback.wordCount = `你上次的草稿有 ${currentWordCount} 字，比最低要求 ${wordCountConfig.min} 字少了 ${underBy} 字。请添加更多细节，但确保总字数在 ${wordCountConfig.min}-${wordCountConfig.max} 字之间。`;
            }
          }
        }
        
        if (currentPerspectiveRatio < PERSPECTIVE_THRESHOLD) {
          const perspectiveLabel = PERSPECTIVE_CONFIG[targetPerspective].label;
          if (isEnglish) {
            retryFeedback.perspective = `Your previous draft did not consistently use ${perspectiveLabel}. Please rewrite to use ${perspectiveLabel} throughout the entire article.`;
          } else {
            retryFeedback.perspective = `你上次的草稿没有统一使用${perspectiveLabel}。请重写，全文使用${perspectiveLabel}。`;
          }
        }
        
        // If no issues found in retry feedback, we shouldn't be retrying
        if (!retryFeedback.wordCount && !retryFeedback.perspective) {
          retryFeedback = undefined;
        }
      }
      
      const { prompt } = buildDraftPrompt(params, retryFeedback);
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      
      let content = response.text || "";
      if (!content) continue;
      
      // Validate word count
      const wordCount = countWords(content, targetLanguage);
      const wordCountValid = wordCount >= wordCountConfig.min && wordCount <= wordCountConfig.max;
      
      // Validate perspective
      let perspectiveRatio = detectPerspectiveRatio(content, targetPerspective, targetLanguage);
      let perspectiveValid = perspectiveRatio >= PERSPECTIVE_THRESHOLD;
      
      // If perspective is invalid, try to fix with AI
      if (!perspectiveValid) {
        const fixedContent = await fixPerspectiveWithAI(content, targetPerspective, targetLanguage);
        const fixedRatio = detectPerspectiveRatio(fixedContent, targetPerspective, targetLanguage);
        
        // Use fixed content if it's better
        if (fixedRatio > perspectiveRatio) {
          content = fixedContent;
          perspectiveRatio = fixedRatio;
          perspectiveValid = perspectiveRatio >= PERSPECTIVE_THRESHOLD;
        }
      }
      
      // Calculate score (word count deviation + perspective ratio)
      const wordCountDeviation = wordCountValid ? 0 : 
        Math.abs(wordCount - (wordCountConfig.min + wordCountConfig.max) / 2) / wordCountConfig.max;
      const score = perspectiveRatio - wordCountDeviation;
      
      // Track best result
      if (score > bestScore) {
        bestScore = score;
        bestResult = content;
      }
      
      // If both valid, return immediately
      if (wordCountValid && perspectiveValid) {
        return { content, warnings: [] };
      }
      
      // If this was the last attempt, break
      if (attempt === MAX_RETRY_COUNT) break;
    }
    
    // If we get here, validation failed after all retries
    const finalWordCount = countWords(bestResult, targetLanguage);
    const finalPerspectiveRatio = detectPerspectiveRatio(bestResult, targetPerspective, targetLanguage);
    
    if (finalWordCount < wordCountConfig.min || finalWordCount > wordCountConfig.max) {
      if (isEnglish) {
        warnings.push(`Word count (${finalWordCount}) is outside the target range (${wordCountConfig.min}-${wordCountConfig.max}). Please adjust manually if needed.`);
      } else {
        warnings.push(`字数（${finalWordCount}）不在目标范围（${wordCountConfig.min}-${wordCountConfig.max}）内，请根据需要手动调整。`);
      }
    }
    
    if (finalPerspectiveRatio < PERSPECTIVE_THRESHOLD) {
      const perspectiveLabel = PERSPECTIVE_CONFIG[targetPerspective].label;
      if (isEnglish) {
        warnings.push(`Perspective consistency (${Math.round(finalPerspectiveRatio * 100)}%) is below the target (70%). Please review and adjust ${perspectiveLabel} usage manually.`);
      } else {
        warnings.push(`人称一致性（${Math.round(finalPerspectiveRatio * 100)}%）低于目标（70%）。请手动检查并调整${perspectiveLabel}的使用。`);
      }
    }
    
    return { content: bestResult, warnings };
  } catch (error) {
    console.error("Failed to generate draft:", error);
    return { content: "", warnings: ["Failed to generate draft"] };
  }
};

/**
 * Generate Key Points (核心要点) section based on article content
 * Target: ~150 words/characters
 */
export const generateKeyPoints = async (
  articleContent: string,
  language: string,
  articleRequirements?: string
): Promise<string> => {
  try {
    const ai = getAiClient();
    const isEnglish = language.toLowerCase() === "english";
    
    let customRequirementsNote = "";
    if (articleRequirements && articleRequirements.trim()) {
      customRequirementsNote = isEnglish 
        ? `\nAdditional requirements to follow: ${articleRequirements}`
        : `\n需要遵守的额外要求：${articleRequirements}`;
    }

    let prompt: string;
    if (isEnglish) {
      prompt = `Based on the following article content, generate a "Key Takeaways" section.

Requirements:
- Create 4-6 bullet points summarizing the most important points
- Each bullet point should be concise (1-2 sentences)
- Total length should be around 150 words
- Format as a bullet list using "-" for each point
- Do NOT include any heading (no "## Key Takeaways" etc.)
- Just return the bullet points directly
${customRequirementsNote}

Article Content:
${articleContent}

Return ONLY the bullet points, nothing else.`;
    } else {
      prompt = `根据以下文章内容，生成"核心要点"部分。

要求：
- 创建4-6个要点，总结文章最重要的内容
- 每个要点简洁明了（1-2句话）
- 总长度约150字
- 使用"-"作为列表符号
- 不要包含任何标题（不要写"## 核心要点"等）
- 直接返回要点列表
${customRequirementsNote}

文章内容：
${articleContent}

只返回要点列表，不要其他内容。`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const keyPoints = response.text?.trim() || "";
    
    // Format with heading
    const heading = isEnglish ? "## Key Takeaways" : "## 核心要点";
    return `${heading}\n\n${keyPoints}`;
  } catch (error) {
    console.error("Failed to generate key points:", error);
    return "";
  }
};

/**
 * Generate FAQ section based on article content
 * Target: ~350 words/characters, 3-5 questions
 */
export const generateFaq = async (
  articleContent: string,
  language: string,
  articleRequirements?: string
): Promise<string> => {
  try {
    const ai = getAiClient();
    const isEnglish = language.toLowerCase() === "english";
    
    let customRequirementsNote = "";
    if (articleRequirements && articleRequirements.trim()) {
      customRequirementsNote = isEnglish 
        ? `\nAdditional requirements to follow: ${articleRequirements}`
        : `\n需要遵守的额外要求：${articleRequirements}`;
    }

    let prompt: string;
    if (isEnglish) {
      prompt = `Based on the following article content, generate a FAQ section.

Requirements:
- Create 3-5 frequently asked questions related to the article topic
- Each question should be formatted as an H3 heading (### Question?)
- Each answer should be 2-3 sentences, clear and helpful
- Total length should be around 350 words
- Questions should address common concerns readers might have
- Do NOT include the main "## FAQ" heading
- Format each Q&A as:
### Question here?
Answer paragraph here.
${customRequirementsNote}

Article Content:
${articleContent}

Return ONLY the Q&A pairs formatted as specified, nothing else.`;
    } else {
      prompt = `根据以下文章内容，生成FAQ（常见问题）部分。

要求：
- 创建3-5个与文章主题相关的常见问题
- 每个问题使用H3标题格式（### 问题？）
- 每个回答2-3句话，清晰有帮助
- 总长度约350字
- 问题应该解答读者可能关心的常见疑问
- 不要包含主标题"## FAQ"
- 格式如下：
### 问题内容？
回答段落。
${customRequirementsNote}

文章内容：
${articleContent}

只返回按指定格式的问答对，不要其他内容。`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const faqContent = response.text?.trim() || "";
    
    // Format with heading
    return `## FAQ\n\n${faqContent}`;
  } catch (error) {
    console.error("Failed to generate FAQ:", error);
    return "";
  }
};

/**
 * Detect if text contains Chinese characters
 * Used to determine the language of content based on actual text
 */
const detectLanguageFromText = (text: string): string => {
  // Count Chinese characters (CJK Unified Ideographs)
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
  // If more than 10 Chinese characters, consider it Chinese
  return chineseChars.length > 10 ? "Chinese" : "English";
};

/**
 * Generate complete article with optional Key Points and FAQ sections
 * Flow: Generate body -> Generate Key Points (if enabled) -> Generate FAQ (if enabled) -> Combine
 */
export const generateCompleteArticle = async (
  params: DraftGenerationParams
): Promise<GenerationResult> => {
  const warnings: string[] = [];
  
  // Detect language from outline content instead of relying on params.language
  const detectedLanguage = detectLanguageFromText(params.outline);
  const language = detectedLanguage;
  const isEnglish = language.toLowerCase() === "english";
  
  console.log(`🌐 Detected language from outline: ${language}`);
  
  try {
    // Step 1: Generate main body content
    console.log("📝 Step 1: Generating main article body...");
    const bodyResult = await generateBlogDraft(params);
    
    if (!bodyResult.content) {
      return { 
        content: "", 
        warnings: bodyResult.warnings || [isEnglish ? "Failed to generate article body" : "生成文章正文失败"] 
      };
    }
    
    // Collect warnings from body generation
    if (bodyResult.warnings) {
      warnings.push(...bodyResult.warnings);
    }
    
    let keyPointsSection = "";
    let faqSection = "";
    
    // Step 2: Generate Key Points (if enabled)
    if (params.includeKeyPoints) {
      console.log("📌 Step 2: Generating Key Points...");
      try {
        keyPointsSection = await generateKeyPoints(
          bodyResult.content, 
          language, 
          params.articleRequirements
        );
        if (!keyPointsSection) {
          warnings.push(isEnglish 
            ? "Failed to generate Key Points section" 
            : "生成核心要点部分失败"
          );
        }
      } catch (error) {
        console.error("Key Points generation failed:", error);
        warnings.push(isEnglish 
          ? "Failed to generate Key Points section" 
          : "生成核心要点部分失败"
        );
      }
    }
    
    // Step 3: Generate FAQ (if enabled)
    if (params.includeFaq) {
      console.log("❓ Step 3: Generating FAQ...");
      try {
        faqSection = await generateFaq(
          bodyResult.content, 
          language, 
          params.articleRequirements
        );
        if (!faqSection) {
          warnings.push(isEnglish 
            ? "Failed to generate FAQ section" 
            : "生成FAQ部分失败"
          );
        }
      } catch (error) {
        console.error("FAQ generation failed:", error);
        warnings.push(isEnglish 
          ? "Failed to generate FAQ section" 
          : "生成FAQ部分失败"
        );
      }
    }
    
    // Step 4: Combine all sections
    // Order: H1 Title -> Key Points (if any) -> Body sections -> FAQ (if any)
    console.log("🔗 Step 4: Combining sections...");
    let finalContent = "";
    
    if (keyPointsSection) {
      // Try to insert Key Points after H1 title, before first H2 section
      const bodyContent = bodyResult.content;
      
      // Find the position of the first H2 heading
      const h2Match = bodyContent.match(/^##\s+[^#]/m);
      
      if (h2Match && h2Match.index !== undefined) {
        // Insert Key Points between H1 and first H2
        const beforeH2 = bodyContent.substring(0, h2Match.index).trimEnd();
        const fromH2 = bodyContent.substring(h2Match.index);
        finalContent = beforeH2 + "\n\n" + keyPointsSection + "\n\n" + fromH2;
      } else {
        // Fallback: put Key Points at the beginning
        finalContent = keyPointsSection + "\n\n" + bodyContent;
      }
    } else {
      finalContent = bodyResult.content;
    }
    
    if (faqSection) {
      finalContent += "\n\n" + faqSection;
    }
    
    console.log("✅ Article generation complete!");
    return { content: finalContent.trim(), warnings };
    
  } catch (error) {
    console.error("Failed to generate complete article:", error);
    return { 
      content: "", 
      warnings: [isEnglish ? "Failed to generate article" : "生成文章失败"] 
    };
  }
};

export const refineBlogContent = async (
  currentContent: string,
  instruction: string
): Promise<string> => {
  try {
    const ai = getAiClient();
    const prompt = `Act as a professional copy editor. Refine the following blog post content based on this instruction: "${instruction}".
    
    Current Content:
    ${currentContent}
    
    Return the updated content in Markdown. Keep formatting consistent.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text || currentContent;
  } catch (error) {
    console.error("Failed to refine content:", error);
    return currentContent;
  }
};

// New function for partial text refinement
export const refineSection = async (
  selectedText: string,
  instruction: string
): Promise<string> => {
  try {
    const ai = getAiClient();
    const prompt = `You are a text editing assistant. Rewrite the following text snippet based on the instruction provided.
    
    Instruction: "${instruction}"
    
    Selected Text Snippet:
    "${selectedText}"
    
    Return ONLY the rewritten text snippet. Do not include quotes or conversational filler.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text || selectedText;
  } catch (error) {
    console.error("Failed to refine section:", error);
    return selectedText;
  }
};

// Multi-modal placement suggestion
export const suggestImagePlacement = async (
  currentContent: string,
  imageBase64: string,
  instruction?: string
): Promise<{ suggestedTextAnchor: string; reason: string }> => {
  try {
    const ai = getAiClient();

    const prompt = `You are a blog editor. I have an image (which I will provide) and the current article text.
    Your goal is to determine the BEST location to insert this image within the text.
    
    Instruction: ${instruction || "Place this where it fits best contextually."}
    
    Current Article Text:
    "${currentContent.substring(0, 5000)}..." (truncated)
    
    Analyze the image. Find a specific sentence or paragraph header in the text where this image should go IMMEDIATELY AFTER.
    
    Return a JSON object:
    {
      "suggestedTextAnchor": "The exact sentence or header text from the article to place the image after.",
      "reason": "A short explanation of why this spot is best."
    }
    `;

    // Strip the prefix if present for the API call, though the API handles it generally.
    // Assuming imageBase64 is the raw base64 string or data url.
    // We need just the base64 data.
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/png", data: base64Data } },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedTextAnchor: { type: Type.STRING },
            reason: { type: Type.STRING },
          },
        },
      },
    });

    const jsonStr = response.text;
    if (!jsonStr) throw new Error("No response");
    return JSON.parse(jsonStr) as {
      suggestedTextAnchor: string;
      reason: string;
    };
  } catch (error) {
    console.error("Failed to suggest placement:", error);
    return { suggestedTextAnchor: "", reason: "Could not analyze image." };
  }
};

export interface PostMetadata {
  slug: string;
  category: string;
  summary: string;
  intro: string;
}

export const generatePostMetadata = async (
  content: string,
  title: string
): Promise<PostMetadata> => {
  try {
    const ai = getAiClient();
    const prompt = `Based on the blog post content provided below, generate a Short Text summary (Meta Description).
    
    Requirements:
    1. Maximum 160 characters.
    2. Engaging and relevant to the content.
    3. Use the Title: "${title}" as context.
    
    Content Snippet: ${content.substring(0, 3000)}...
    
    Return JSON only with a single field "summary".`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
          },
        },
      },
    });

    const jsonStr = response.text;
    if (!jsonStr) throw new Error("No response");
    const result = JSON.parse(jsonStr) as { summary: string };

    // Maintain interface compatibility but fill others with empty strings
    return {
      slug: "",
      category: "",
      summary: result.summary,
      intro: "",
    };
  } catch (error) {
    console.error("Failed to generate metadata:", error);
    return { slug: "", category: "", summary: "", intro: "" };
  }
};

export interface SEOScore {
  score: number;
  suggestions: string[];
}

export const analyzeSEO = async (
  content: string,
  title: string
): Promise<SEOScore> => {
  try {
    const ai = getAiClient();
    const prompt = `Analyze the following blog post draft for SEO effectiveness. 
    Target Keyword/Topic implied by title: "${title}".
    
    Content:
    "${content.substring(0, 5000)}" (truncated for context)

    Return a JSON object with:
    1. 'score' (integer 0-100)
    2. 'suggestions' (array of strings, max 3 specific improvements).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
        },
      },
    });

    const jsonStr = response.text;
    if (!jsonStr) throw new Error("No response");
    return JSON.parse(jsonStr) as SEOScore;
  } catch (error) {
    console.error("SEO Check failed:", error);
    return { score: 0, suggestions: ["Could not analyze SEO at this time."] };
  }
};

export const generateCampaignKeywords = async (
  name: string,
  client: string,
  strategy: string,
  audience: string
): Promise<string[]> => {
  try {
    const ai = getAiClient();
    const prompt = `Act as an SEO Expert. Generate 5-7 high-value, relevant seed keywords (tags) for a content marketing campaign.
    
    Campaign Name: "${name}"
    Client: "${client}"
    Strategy Goal: "${strategy}"
    Target Audience: "${audience}"
    
    The keywords should be a mix of broad topics and long-tail phrases suitable for blog ideation.
    Return ONLY a JSON array of strings.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    });

    const jsonStr = response.text;
    if (!jsonStr) return [];
    return JSON.parse(jsonStr) as string[];
  } catch (error) {
    console.error("Failed to generate keywords:", error);
    return [];
  }
};

// Blog topic idea for keyword-driven writing
export interface BlogTopicIdea {
  type: string; // e.g., "Listicle", "How-to", "Comparison", "Tutorial"
  topic: string; // e.g., "Top 10 AI SEO tools for 2026"
}

export interface TopicIdeasParams {
  keyword: string;
  targetMarket: string; // e.g., "United States"
  targetLanguage: string; // e.g., "English"
}

// All available topic types
const ALL_TOPIC_TYPES = [
  "Listicle",
  "How-to",
  "Comparison",
  "Tutorial",
  "Review",
  "Guide",
  "Tips",
  "Trends",
  "Case Study",
  "Beginner's Guide",
  "Ultimate Guide",
  "Checklist",
  "FAQ",
  "Deep Dive",
];

/**
 * Check if target language is Chinese
 */
const isChineseLanguage = (language: string): boolean => {
  return (
    language === "Chinese" ||
    language.includes("中文") ||
    language.includes("Chinese")
  );
};

/**
 * Validate a single topic idea
 * Returns true if topic is non-empty and within character limit
 */
const isValidTopicIdea = (idea: BlogTopicIdea, isChinese: boolean): boolean => {
  if (!idea || typeof idea.topic !== "string") {
    return false;
  }
  const maxLength = isChinese ? 150 : 150;
  return idea.topic.trim().length > 0 && idea.topic.length <= maxLength;
};

/**
 * Generate topic ideas for specific types
 */
const generateTopicIdeasForTypes = async (
  params: TopicIdeasParams,
  types: string[]
): Promise<BlogTopicIdea[]> => {
  const ai = getAiClient();
  const isChinese = isChineseLanguage(params.targetLanguage);
  const maxLength = isChinese ? 150 : 150;

  const prompt = `You are an expert SEO content strategist. Generate blog post topic ideas based on the following keyword.

Keyword: "${params.keyword}"
Target Market: ${params.targetMarket}
Target Language: ${params.targetLanguage}

Generate exactly ${
    types.length
  } topic idea(s) for these specific article types: ${types.join(", ")}

CRITICAL: Each object MUST have TWO SEPARATE fields:
- "type": The article type (MUST be exactly one of: ${types.join(", ")})
- "topic": The blog post topic/title (a complete sentence, NOT the same as type)

Requirements:
1. The "type" field MUST be exactly one of the specified types above
2. The "topic" field MUST be a DIFFERENT value from "type" - it should be a complete blog post topic
3. The "topic" should naturally incorporate the keyword "${params.keyword}"
4. Maximum topic length: ${maxLength} characters
5. Output language: ${params.targetLanguage}

CORRECT example (type and topic are SEPARATE):
[
  { "type": "Listicle", "topic": "Top 10 AI Video Tools for Creators" },
  { "type": "How-to", "topic": "How to Make AI Videos Step by Step" }
]

WRONG example (DO NOT do this - type and topic merged):
[
  { "type": "Listicle Top 10 AI Video Tools" }
]

Return a JSON array with exactly ${types.length} objects.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            topic: { type: Type.STRING },
          },
          required: ["type", "topic"],
        },
      },
    },
  });

  const jsonStr = response.text;
  if (!jsonStr) return [];
  
  try {
    return JSON.parse(jsonStr) as BlogTopicIdea[];
  } catch (parseError) {
    console.error("Failed to parse topic ideas JSON:", parseError);
    console.error("Raw response (first 500 chars):", jsonStr?.substring(0, 500));
    return [];
  }
};

/**
 * Generate 10 blog topic ideas based on a keyword
 * Used in Keyword-Driven Writing path
 * Includes validation and retry logic for invalid topics
 */
export const generateBlogTopicIdeas = async (
  params: TopicIdeasParams
): Promise<BlogTopicIdea[]> => {
  const MAX_RETRIES = 3;
  const isChinese = isChineseLanguage(params.targetLanguage);

  try {
    // Select 10 types from all available types
    const selectedTypes = ALL_TOPIC_TYPES.slice(0, 10);

    // First generation: generate all 10 topics
    let validIdeas: BlogTopicIdea[] = [];
    let pendingTypes = [...selectedTypes];
    let retryCount = 0;

    while (pendingTypes.length > 0 && retryCount <= MAX_RETRIES) {
      const generatedIdeas = await generateTopicIdeasForTypes(
        params,
        pendingTypes
      );

      // Separate valid and invalid ideas
      const newValidIdeas: BlogTopicIdea[] = [];
      const invalidTypes: string[] = [];

      for (const idea of generatedIdeas) {
        if (isValidTopicIdea(idea, isChinese)) {
          // Check if this type is not already in validIdeas (avoid duplicates)
          const typeAlreadyExists = validIdeas.some(
            (v) => v.type === idea.type
          );
          if (!typeAlreadyExists) {
            newValidIdeas.push(idea);
          }
        } else {
          invalidTypes.push(idea.type);
        }
      }

      // Add new valid ideas to the collection
      validIdeas = [...validIdeas, ...newValidIdeas];

      // Find types that still need to be generated
      // (either invalid or not returned by AI)
      const validTypes = new Set(validIdeas.map((v) => v.type));
      pendingTypes = pendingTypes.filter((t) => !validTypes.has(t));

      if (pendingTypes.length > 0) {
        retryCount++;
        console.log(
          `Retry ${retryCount}/${MAX_RETRIES}: Regenerating ${
            pendingTypes.length
          } invalid topics for types: ${pendingTypes.join(", ")}`
        );
      }
    }

    if (pendingTypes.length > 0) {
      console.warn(
        `After ${MAX_RETRIES} retries, still missing topics for types: ${pendingTypes.join(
          ", "
        )}`
      );
    }

    return validIdeas;
  } catch (error) {
    console.error("Failed to generate topic ideas:", error);
    return [];
  }
};

export interface KeywordDrivenTitleParams {
  keyword: string;
  selectedTopicIdea: BlogTopicIdea; // The topic idea user selected
  targetAudience: string;
  tone: string;
  rules?: string;
  language: string;
}

/**
 * Generate 5 specific blog titles based on selected topic idea
 * Used in Keyword-Driven Writing path after user selects a topic
 */
export const generateKeywordDrivenTitles = async (
  params: KeywordDrivenTitleParams
): Promise<string[]> => {
  try {
    const ai = getAiClient();

    const prompt = `You are an expert SEO copywriter. Generate exactly 5 compelling, SEO-optimized blog post titles.

Context:
- Primary Keyword: "${params.keyword}"
- Article Type: "${params.selectedTopicIdea.type}"
- Topic Direction: "${params.selectedTopicIdea.topic}"
- Target Audience: "${params.targetAudience}"
- Tone of Voice: "${params.tone}"
- Language: "${params.language}"
${params.rules ? `- Content Rules: "${params.rules}"` : ""}

Requirements:
1. Generate exactly 5 unique titles
2. All titles should be variations of the "${
      params.selectedTopicIdea.type
    }" article type
3. Titles should naturally incorporate the keyword "${params.keyword}"
4. Titles should be engaging, specific, and optimized for click-through rate
5. Match the specified tone of voice
6. Output in ${params.language}

Return ONLY a JSON array of 5 title strings.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    });

    const jsonStr = response.text;
    if (!jsonStr) return [];
    return JSON.parse(jsonStr) as string[];
  } catch (error) {
    console.error("Failed to generate keyword-driven titles:", error);
    return [];
  }
};
