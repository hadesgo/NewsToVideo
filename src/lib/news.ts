import Parser from "rss-parser";
import { GoogleGenAI } from "@google/genai";

const parser = new Parser();

// ==== 配置 ====
const RSS_FEEDS = [
  "http://feeds.bbci.co.uk/news/world/rss.xml",
  "http://rss.cnn.com/rss/edition.rss",
  "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
  "https://www.aljazeera.com/xml/rss/all.xml",
  "https://plink.anyfeeder.com/zaobao/realtime/world",
];

// ==== 抓取RSS ====
async function fetchNews() {
  const today = new Date().toISOString().slice(0, 10);
  const newsItems: {
    title: string | undefined;
    summary: string;
    link: string | undefined;
  }[] = [];

  for (const url of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(url);
      feed.items.forEach((item) => {
        if (item.pubDate) {
          const pubDate = new Date(item.pubDate).toISOString().slice(0, 10);
          if (pubDate === today) {
            newsItems.push({
              title: item.title,
              summary: item.contentSnippet || "",
              link: item.link,
            });
          }
        }
      });
    } catch (err) {
      console.error(
        "❌ RSS 抓取失败:",
        url,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  return newsItems;
}

const ai = new GoogleGenAI({});

// ==== AI 总结 ====
async function summarizeNews(newsItems: any[]) {
  if (newsItems.length === 0) {
    return undefined;
  }

  const text = newsItems
    .map((item, i) => `${i + 1}. ${item.title} - ${item.summary}`)
    .join("\n");

  const prompt = `以下是今天的新闻，请总结并挑选最重要的10条，用简洁的中文列出“标题 + 一句话背景”。按列表输出。\n\n新闻列表：\n${text}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });
  return response.text;
}

// 提炼新闻并给出关键词
async function extractNews(prompt: string | undefined) {
  if (!prompt) {
    return [];
  }
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: `你是一个新闻摘要和筛选引擎。  
你的任务是从输入的 N 条新闻信息中，挑选出最重要的 10 条，并严格按照以下规则输出：  

1. 为每条新闻生成一个简洁明了的标题（中文）。  
2. 提炼新闻内容为简短的摘要（中文）。  
3. 为每条新闻提炼一个适合 Pexels API 搜索素材的英文关键词（仅 1 个单词）。  
4. 输出严格为 JSON 数组，格式如下：  
[
  {"title":"标题1", "content":"内容1", "keywords":["keyword1"]},
  {"title":"标题2", "content":"内容2", "keywords":["keyword2"]},
  ...
]  
5. 标题和内容必须为中文，关键词必须为英文。  
6. 输出必须是合法的 JSON，不能有多余文本。  
7. 不得出现中国国家领导人的名字。`,
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
            },
            content: {
              type: "string",
            },
            keywords: {
              type: "array",
              items: {
                type: "string",
              },
            },
          },
          required: ["title", "content", "keywords"],
        },
      },
    },
  });
  const content = response.text;
  return content ? JSON.parse(content) : [];
}

const news = async () => {
  const newsItems = await fetchNews();
  const summary = await summarizeNews(newsItems);
  return await extractNews(summary);
};

export default news;
