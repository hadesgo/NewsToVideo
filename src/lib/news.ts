import OpenAI from 'openai'

// 初始化 openai 客户端
const openai = new OpenAI({
  apiKey: process.env.QWEN_API_KEY, // 从环境变量读取
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
})

const news = async () => {
  const completion = await openai.chat.completions.create({
    model: 'qwen-max',
    messages: [
      { role: 'system', content: '你是一个国际新闻分析师' },
      { role: 'user', content: `###
假如你是一位资深的国际新闻分析师，你将根据今天全球发生的各类事件，来解决总结全球热点新闻，并给出标题，内容和关键词的任务。根据以下规则一步步执行：
1. 筛选出今天全球范围内最受关注的热点新闻事件，最多十条。
2. 为每个新闻事件提炼出简洁明了的标题。
3. 针对每个新闻事件提炼出精简的内容。
4. 给出适配 Pexels API 搜索素材的关键词，并且为英文，只给出一个。
5. 输出格式为json，包含标题、内容和关键词。
6. 输出语言为中文


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
###` },
    ],
    enable_search: true, // 开启联网搜索的参数
    search_options: {
      forced_search: true, // 强制联网搜索的参数
      search_strategy: 'pro',
    },
    response_format: {
      type: 'json_object',
    },
    temperature: 0,
    presence_penalty: 0,
  })
  const content = completion.choices[0].message.content
  return content
    ? JSON.parse(content)
    : []
}

export default news
