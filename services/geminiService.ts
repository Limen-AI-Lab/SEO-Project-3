
import { GoogleGenAI, Type } from "@google/genai";
import { Comment, WordCountRange, ArticlePerspective, WORD_COUNT_CONFIG, PERSPECTIVE_CONFIG } from "../types";

// Initialize the client
// NOTE: In Vite, use import.meta.env instead of process.env
// API Key should be in .env file as VITE_GEMINI_API_KEY
const getAiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ''; 
  
  if (!apiKey) {
    console.warn('VITE_GEMINI_API_KEY is not set. AI features will not work.');
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

export const generateBlogTitles = async (params: TitleGenerationParams): Promise<string[]> => {
  try {
    const ai = getAiClient();
    
    const prompt = `Generate 5 professional, SEO-friendly blog post titles for a firm named "${params.clientName}".
    
    Parameters:
    - Topic/Subject: "${params.topic}"
    - Target Audience: "${params.targetAudience}"
    - Keywords to include: "${params.keywords}"
    - Language: "${params.language}"
    - Tone of Voice: "${params.tone}"
    ${params.rules ? `- Strict Content Rules: "${params.rules}"` : ''}
    
    The titles should be catchy, relevant, and optimized for search engines.
    Return ONLY a JSON array of strings.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        }
      }
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
  volume: 'High' | 'Medium' | 'Low';
}

export const suggestBlogKeywords = async (topic: string, audience: string, clientName: string): Promise<KeywordSuggestion[]> => {
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
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              keyword: { type: Type.STRING },
              volume: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
            }
          }
        }
      }
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
  language?: string;  // Target language for outline content (e.g., "English", "Chinese")
  wordCountRange?: WordCountRange;  // Target word count range (affects H2 count)
  perspective?: ArticlePerspective;  // Writing perspective (first/second/third person)
}

export const generateBlogOutline = async (params: OutlineGenerationParams): Promise<string> => {
  try {
    const ai = getAiClient();
    
    // Determine target language (default to English)
    const targetLanguage = params.language || 'English';
    const isEnglish = targetLanguage.toLowerCase() === 'english';
    
    // Get word count and H2 count configuration
    const wordCountConfig = params.wordCountRange ? WORD_COUNT_CONFIG[params.wordCountRange] : WORD_COUNT_CONFIG['1000-2000'];
    const perspectiveConfig = params.perspective ? PERSPECTIVE_CONFIG[params.perspective] : PERSPECTIVE_CONFIG['third'];
    
    // Calculate H3 count based on H2 count (1-2 H3 per H2, total around 7-8)
    const h3Min = wordCountConfig.h2Min;
    const h3Max = wordCountConfig.h2Max * 2;
    
    // Build comprehensive context from all available information
    let contextParts: string[] = [];
    
    // 1. Primary directive and title (most important)
    if (isEnglish) {
      contextParts.push(`You are creating a concise blog post outline for the following title:\n"${params.selectedTitle}"`);
    } else {
      contextParts.push(`您正在为以下标题创建简洁的博客文章大纲：\n"${params.selectedTitle}"`);
    }
    
    // 2. Word count and structure requirements
    if (isEnglish) {
      contextParts.push(`\nArticle Length Requirements:
- Target word count: ${wordCountConfig.min}-${wordCountConfig.max} words (STRICTLY follow this limit)
- Number of H2 sections: exactly ${wordCountConfig.h2Min}-${wordCountConfig.h2Max} sections
- Number of H3 subsections: ${h3Min}-${h3Max} total (1-2 per H2 section)
- Writing perspective: ${perspectiveConfig.label} (${perspectiveConfig.description})`);
    } else {
      contextParts.push(`\n文章长度要求：
- 目标字数：${wordCountConfig.min}-${wordCountConfig.max} 字（必须严格遵守）
- H2章节数量：${wordCountConfig.h2Min}-${wordCountConfig.h2Max} 个
- H3子章节数量：总共 ${h3Min}-${h3Max} 个（每个H2下1-2个H3）
- 写作视角：${perspectiveConfig.label}（${perspectiveConfig.description}）`);
    }
    
    // 3. Campaign strategy and goals
    if (params.campaignGoals && params.campaignGoals.trim()) {
      if (isEnglish) {
        contextParts.push(`\nMarketing Strategy Goals:\n${params.campaignGoals}`);
      } else {
        contextParts.push(`\n营销策略目标：\n${params.campaignGoals}`);
      }
    }
    
    // 4. Keywords for SEO
    if (params.keywords && params.keywords.length > 0) {
      if (isEnglish) {
        contextParts.push(`\nKeywords (integrate naturally into headings):\n${params.keywords.join(', ')}`);
      } else {
        contextParts.push(`\n关键词（请自然融入标题）：\n${params.keywords.join(', ')}`);
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
        .map(c => `- ${c.text}`)
        .join('\n');
      if (isEnglish) {
        contextParts.push(`\nClient Feedback and Requirements (must be fully considered):\n${commentsText}`);
      } else {
        contextParts.push(`\n客户反馈和要求（必须充分考虑）：\n${commentsText}`);
      }
    }
    
    const context = contextParts.join('\n');
    
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
5. Exactly ${wordCountConfig.h2Min}-${wordCountConfig.h2Max} H2 sections
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

Return ONLY the Markdown headings, nothing else.`;
    } else {
      prompt = `${context}

创建一个简洁的博客文章大纲，只包含标题（H1、H2、H3）。标题下不要有任何描述或说明文字。

**必须严格遵守的规则**：
1. 只输出以 #、## 或 ### 开头的标题行
2. 标题下方不要添加任何文字 - 只有标题
3. 不要添加列表项、描述或解释
4. 只有 1 个 H1（主标题）
5. 正好 ${wordCountConfig.h2Min}-${wordCountConfig.h2Max} 个 H2 章节
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

只返回 Markdown 标题，不要有其他内容。`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text || "";
  } catch (error) {
    console.error("Failed to generate outline:", error);
    return "";
  }
};

export const refineBlogOutline = async (currentOutline: string, instruction: string): Promise<string> => {
  try {
    const ai = getAiClient();
    const prompt = `Act as a professional editor. Modify the following blog post outline based strictly on this instruction: "${instruction}".
    
    Current Outline:
    ${currentOutline}
    
    Return the updated outline in Markdown format. Do not add conversational filler.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
}

export const generateBlogDraft = async (
  titleOrParams: string | DraftGenerationParams, 
  outline?: string, 
  comments?: Comment[], 
  clientName?: string
): Promise<string> => {
  try {
    const ai = getAiClient();
    
    // Support both old and new function signatures
    let params: DraftGenerationParams;
    if (typeof titleOrParams === 'string') {
      // Legacy call: generateBlogDraft(title, outline, comments, clientName)
      params = {
        title: titleOrParams,
        outline: outline || '',
        comments: comments || [],
        clientName: clientName || ''
      };
    } else {
      // New call: generateBlogDraft(params)
      params = titleOrParams;
    }
    
    // Get word count and perspective configuration
    const wordCountConfig = params.wordCountRange ? WORD_COUNT_CONFIG[params.wordCountRange] : WORD_COUNT_CONFIG['1000-2000'];
    const perspectiveConfig = params.perspective ? PERSPECTIVE_CONFIG[params.perspective] : PERSPECTIVE_CONFIG['third'];
    
    // Determine target language
    const targetLanguage = params.language || 'English';
    const isEnglish = targetLanguage.toLowerCase() === 'english';
    
    let commentsContext = "";
    if (params.comments.length > 0) {
      if (isEnglish) {
        commentsContext = `
IMPORTANT: You must incorporate the following feedback from the client into the draft:
${params.comments.map(c => `- "${c.text}" (from ${c.author})`).join('\n')}
`;
      } else {
        commentsContext = `
重要：请在正文中融入以下客户反馈：
${params.comments.map(c => `- "${c.text}" (来自 ${c.author})`).join('\n')}
`;
      }
    }
    
    // Build perspective instruction
    let perspectiveInstruction: string;
    if (isEnglish) {
      switch (params.perspective) {
        case 'first':
          perspectiveInstruction = 'Use first person perspective ("we", "our", "us") throughout the article.';
          break;
        case 'second':
          perspectiveInstruction = 'Use second person perspective ("you", "your") throughout the article, directly addressing the reader.';
          break;
        case 'third':
        default:
          perspectiveInstruction = 'Use third person perspective with objective, professional tone throughout the article.';
      }
    } else {
      switch (params.perspective) {
        case 'first':
          perspectiveInstruction = '全文使用第一人称视角（"我们"、"本公司"），拉近与读者的距离。';
          break;
        case 'second':
          perspectiveInstruction = '全文使用第二人称视角（"您"、"你"），直接与读者对话。';
          break;
        case 'third':
        default:
          perspectiveInstruction = '全文使用第三人称视角，保持客观、专业的叙述方式。';
      }
    }

    let prompt: string;
    
    if (isEnglish) {
      prompt = `Write a full blog post draft for a firm named "${params.clientName}".
    
Title: "${params.title}"

Follow this structure strictly:
${params.outline}

${commentsContext}

**Writing Requirements**:
- ${perspectiveInstruction}
- Tone: Professional, Authoritative, yet Accessible.
- Format: Markdown. Use bold (**text**) for emphasis.
- Do NOT use single asterisks (*) for italics. Use asterisks ONLY for bullet points.
- Length: ${wordCountConfig.min}-${wordCountConfig.max} words.

Do not include preambles like "Here is the draft". Just start with the content.`;
    } else {
      prompt = `为"${params.clientName}"撰写一篇完整的博客文章。
    
标题："${params.title}"

请严格按照以下大纲结构撰写：
${params.outline}

${commentsContext}

**写作要求**：
- ${perspectiveInstruction}
- 语气：专业、权威，同时保持亲和力。
- 格式：Markdown。可以使用粗体（**文字**）进行强调。
- 不要使用单星号 (*) 进行斜体强调。星号仅用于列表项（Bullet points）。
- 字数：${wordCountConfig.min}-${wordCountConfig.max} 字。

不要包含"以下是草稿"之类的开场白，直接开始正文内容。`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text || "";
  } catch (error) {
    console.error("Failed to generate draft:", error);
    return "";
  }
};

export const refineBlogContent = async (currentContent: string, instruction: string): Promise<string> => {
  try {
    const ai = getAiClient();
    const prompt = `Act as a professional copy editor. Refine the following blog post content based on this instruction: "${instruction}".
    
    Current Content:
    ${currentContent}
    
    Return the updated content in Markdown. Keep formatting consistent.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text || currentContent;
  } catch (error) {
    console.error("Failed to refine content:", error);
    return currentContent;
  }
};

// New function for partial text refinement
export const refineSection = async (selectedText: string, instruction: string): Promise<string> => {
  try {
    const ai = getAiClient();
    const prompt = `You are a text editing assistant. Rewrite the following text snippet based on the instruction provided.
    
    Instruction: "${instruction}"
    
    Selected Text Snippet:
    "${selectedText}"
    
    Return ONLY the rewritten text snippet. Do not include quotes or conversational filler.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
): Promise<{ suggestedTextAnchor: string, reason: string }> => {
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
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
         responseSchema: {
            type: Type.OBJECT,
            properties: {
                suggestedTextAnchor: { type: Type.STRING },
                reason: { type: Type.STRING }
            }
        }
      }
    });
    
    const jsonStr = response.text;
    if (!jsonStr) throw new Error("No response");
    return JSON.parse(jsonStr) as { suggestedTextAnchor: string, reason: string };
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

export const generatePostMetadata = async (content: string, title: string): Promise<PostMetadata> => {
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
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING }
            }
        }
      }
    });
    
    const jsonStr = response.text;
    if (!jsonStr) throw new Error("No response");
    const result = JSON.parse(jsonStr) as { summary: string };
    
    // Maintain interface compatibility but fill others with empty strings
    return { 
        slug: '', 
        category: '', 
        summary: result.summary, 
        intro: '' 
    };
  } catch (error) {
    console.error("Failed to generate metadata:", error);
    return { slug: '', category: '', summary: '', intro: '' };
  }
};

export interface SEOScore {
  score: number;
  suggestions: string[];
}

export const analyzeSEO = async (content: string, title: string): Promise<SEOScore> => {
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
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                score: { type: Type.INTEGER },
                suggestions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        }
      }
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
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        }
      }
    });

    const jsonStr = response.text;
    if (!jsonStr) return [];
    return JSON.parse(jsonStr) as string[];
  } catch (error) {
    console.error("Failed to generate keywords:", error);
    return [];
  }
};
