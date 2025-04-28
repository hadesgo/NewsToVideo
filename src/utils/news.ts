import OpenAI from 'openai'

function extractNumberedContent(text: string): string[] {
  const pattern = /\d+\.\s*(.*)/g
  const matches = []
  let match
  while ((match = pattern.exec(text)) !== null) {
    matches.push(match[1])
  }
  return matches
}

// 初始化 openai 客户端
const openai = new OpenAI({
  apiKey: 'sk-0b74c67ac056452fae5a9aec1e7a65b7', // 从环境变量读取
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
})

export const getTodatNews = async () => {
  const completion = await openai.chat.completions.create({
    model: 'qwen-max',
    messages: [
      { role: 'system', content: '你是一名时事评论员' },
      { role: 'user', content: `请总结今天的全球热点新闻，按照序号排列` },
    ],
    enable_search: true, // 开启联网搜索的参数
    search_options: {
      forced_search: true, // 强制联网搜索的参数
      search_strategy: 'pro',
    },
  })
  const contentList: { title: string, content: string }[] = []
  const tempNumbereList = completion.choices[0].message.content
    ? extractNumberedContent(completion.choices[0].message.content)
    : []
  tempNumbereList.forEach((tempNumbere) => {
    const obj = {
      title: '',
      content: '',
    }
    const tempNumbereList = tempNumbere.split('：')
    obj.title = tempNumbereList[0].replaceAll('**', '')
    obj.content = tempNumbereList[1]
    contentList.push(obj)
  })
  return contentList
}
