
import { GoogleGenAI, Type } from "@google/genai";
import { Comment } from "../types";

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
}

export const generateBlogOutline = async (params: OutlineGenerationParams): Promise<string> => {
  try {
    const ai = getAiClient();
    
    // Build comprehensive context from all available information
    let contextParts: string[] = [];
    
    // 1. Primary directive and title (most important)
    contextParts.push(`您正在为以下标题创建详细的博客文章大纲：\n"${params.selectedTitle}"`);
    
    // 2. Campaign strategy and goals
    if (params.campaignGoals && params.campaignGoals.trim()) {
      contextParts.push(`\n营销策略目标：\n${params.campaignGoals}`);
    }
    
    // 3. Keywords for SEO
    if (params.keywords && params.keywords.length > 0) {
      contextParts.push(`\n关键词（请自然融入大纲）：\n${params.keywords.join(', ')}`);
    }
    
    // 4. Target audience
    if (params.targetAudience && params.targetAudience.trim()) {
      contextParts.push(`\n目标受众：\n${params.targetAudience}`);
    }
    
    // 5. Client feedback and requirements
    if (params.clientComments && params.clientComments.length > 0) {
      const commentsText = params.clientComments
        .map(c => `- ${c.text}`)
        .join('\n');
      contextParts.push(`\n客户反馈和要求（必须充分考虑）：\n${commentsText}`);
    }
    
    const context = contextParts.join('\n');
    
    const prompt = `${context}

请创建一个结构清晰、逻辑严谨的博客文章大纲。

**严格格式要求**：
1. 只使用 Markdown 标题格式：# 表示 H1，## 表示 H2，### 表示 H3
2. 在标题下方用普通文本（不加任何符号）写简短的描述或说明
3. 绝对不要使用单独的星号 (*) 或其他符号作为标题或列表项
4. 确保层级清晰：H1 是主标题，H2 是主要章节，H3 是子章节
5. 每个章节下的描述文字要简洁明了，说明该部分的核心内容方向

**内容要求**：
- 大纲内容必须与标题高度相关
- 充分结合上述所有信息（营销目标、关键词、目标受众、客户反馈）
- 结构合理，逻辑流畅（引言、核心观点、深入分析、总结等）
- 专业且信息丰富的语气

**示例格式**：
# 主标题
简要介绍本文的核心主题和价值

## 第一章节：核心概念
说明本章节将阐述的主要内容

### 子主题1.1
具体细节或案例说明

### 子主题1.2
另一个角度的分析

## 第二章节：深入探讨
说明如何深化主题

请只返回 Markdown 格式的大纲文本，不要添加任何解释性文字。`;

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

export const generateBlogDraft = async (
  title: string, 
  outline: string, 
  comments: Comment[], 
  clientName: string
): Promise<string> => {
  try {
    const ai = getAiClient();
    
    let commentsContext = "";
    if (comments.length > 0) {
      commentsContext = `
      IMPORTANT: You must incorporate the following feedback from the client into the draft:
      ${comments.map(c => `- "${c.text}" (from ${c.author})`).join('\n')}
      `;
    }

    const prompt = `Write a full blog post draft for a firm named "${clientName}".
    
    Title: "${title}"
    
    Follow this structure strictly:
    ${outline}
    
    ${commentsContext}
    
    Tone: Professional, Authoritative, yet Accessible.
    Format: Markdown.
    Length: 800-1200 words.
    
    Do not include preambles like "Here is the draft". Just start with the content.`;

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
    const prompt = `Act as an SEO Expert. Generate 10-15 high-value, relevant seed keywords (tags) for a content marketing campaign.
    
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
