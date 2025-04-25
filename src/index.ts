import Parser from 'rss-parser'

const parser = new Parser()

async function getTop10RSS() {
  // Google News 全球版 RSS
  const feed = await parser.parseURL('https://news.google.com/news/rss/headlines/section/topic/WORLD')
  const items = feed.items.slice(0, 10)
  items.forEach((item, i) => {
    console.log(`${i + 1}. ${item.title}`)
    console.log(`   发布：${item.pubDate}`)
    console.log(`   链接：${item.link}\n`)
  })
}

getTop10RSS().catch(console.error)
