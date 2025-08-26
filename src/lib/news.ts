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
    model: "gemini-2.5-pro",
    contents: prompt,
    config: {
      systemInstruction: `###
假如你是一位资深的国际新闻分析师，你将根据用户输入的新闻来进行总结，并给出标题，内容,和关键词的任务。根据以下规则一步步执行：
1. 为每个新闻事件提炼出简洁明了的标题。
2. 针对每个新闻事件提炼出精简的内容。
3. 给出适配 Pexels API 搜索素材的关键词，并且为英文，只给出一个。
4. 输出格式为json，包含标题、内容和关键词。
5. 输出语言为中文
6. 避免出现中国国家领导人的名字


参考例子：
示例1：
title:某国举行关键选举
content:某国举行在某年某日举行关键选举，有重要人物出席参会，并且投票率投票。投票结果将在几天后公布。
keywords:election

示例2：
title:某赛事举办
content:某赛事在某年某日举办，吸引了来自世界各地的运动员参赛。赛事期间，各国运动员展现出高水平的竞技状态，比赛气氛热烈。
keywords:Events

请回答问题：
title:xxxx
content:xxxxxxxxx
keywords: xxx
输出：

要求：
1 以 json格式输出，格式为 [{"title":"标题1", "content":"内容1", "keywords":"xxx"}, ...]。
###`,
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
              type: "string",
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
