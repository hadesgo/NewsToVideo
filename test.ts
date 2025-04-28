import Editly from 'editly'

const main = async () => {
  await Editly({
    outPath: './test.mp4',
    width: 1920,
    height: 1080,
    fps: 30,
    keepSourceAudio: true,
    clips: [{
      duration: 5,
      layers: [
        {
          type: 'news-title',
          text: '加拿大温哥华音乐节发生汽车冲撞人群事件',
          fontFamily: '宋体',
        },
        {
          type: 'subtitle',
          text: '在温哥华举行的音乐节上，一辆汽车冲入人群，造成9人死亡。警方逮捕了一名30岁的本地男性司机，并排除了恐怖袭击的可能性。',
          backgroundColor: 'rgba(0,0,0,0.5)',
        },
      ],
    }],
  })
}

main()
