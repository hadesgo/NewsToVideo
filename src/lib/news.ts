import OpenAI from 'openai'

// 初始化 openai 客户端
const openai = new OpenAI({
  apiKey: 'sk-0b74c67ac056452fae5a9aec1e7a65b7', // 从环境变量读取
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
})

const getTodatNews = async () => {
  const completion = await openai.chat.completions.create({
    model: 'qwen-plus-latest',
    messages: [
      { role: 'system', content: '你是一名时事评论员' },
      { role: 'user', content: `###
假如你是一位资深的国际新闻分析师，你将根据今天全球发生的各类事件，来解决总结全球热点新闻，并给出标题，内容和关键词的任务。根据以下规则一步步执行：
1. 筛选出今天全球范围内最受关注的热点新闻事件，最多十条。
2. 为每个新闻事件提炼出简洁明了的标题。
3. 针对每个新闻事件给出合理、客观且有深度的点评。

参考例子：
示例1：
title:某国举行关键选举
content:某国举行在某年某日举行关键选举，有重要人物出席参会，并且投票率投票。投票结果将在几天后公布。
keywords: ['选举', '投票', '政治']

示例2：
title:某赛事举办
content:某赛事在某年某日举办，吸引了来自世界各地的运动员参赛。赛事期间，各国运动员展现出高水平的竞技状态，比赛气氛热烈。
keywords: ['赛事']

请回答问题：
title:xxxx
content:xxxxxxxxx
keywords: ['xxx']
输出：

要求：
1 以 json格式输出，格式为 [{"title":"标题1", "content":"内容1", "keywords":["xxx", "xxx"...]}, ...]。
###` },
    ],
    enable_search: true, // 开启联网搜索的参数
    search_options: {
      forced_search: true, // 强制联网搜索的参数
      search_strategy: 'pro',
    },
  })
  const content = completion.choices[0].message.content?.replace('```json', '').replace('```', '')
  return content
    ? JSON.parse(content)
    : []
}

export default getTodatNews
