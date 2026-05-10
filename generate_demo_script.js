const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, TabStopPosition, TabStopType,
  TableRow, TableCell, Table, WidthType, ShadingType,
  PageBreak
} = require('docx');
const fs = require('fs');

const FONT = '微软雅黑';
const FONT_EN = 'Calibri';

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [
      new TextRun({ text, font: FONT, size: 32, bold: true, color: '2E4057' }),
    ],
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160 },
    children: [
      new TextRun({ text, font: FONT, size: 28, bold: true, color: '4A6FA5' }),
    ],
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 120 },
    children: [
      new TextRun({ text, font: FONT, size: 24, bold: true, color: '6B8F71' }),
    ],
  });
}

function bodyText(text) {
  return new Paragraph({
    spacing: { after: 120, line: 360 },
    children: [
      new TextRun({ text, font: FONT, size: 22 }),
    ],
  });
}

function boldBodyText(label, text) {
  return new Paragraph({
    spacing: { after: 120, line: 360 },
    children: [
      new TextRun({ text: label, font: FONT, size: 22, bold: true }),
      new TextRun({ text, font: FONT, size: 22 }),
    ],
  });
}

function speakerHint(text) {
  return new Paragraph({
    spacing: { after: 100, line: 360 },
    indent: { left: 400 },
    children: [
      new TextRun({ text: '【讲解提示】', font: FONT, size: 20, bold: true, color: 'C0392B' }),
      new TextRun({ text, font: FONT, size: 20, italics: true, color: '7F8C8D' }),
    ],
  });
}

function demoLine(speaker, text) {
  const icon = speaker === 'child' ? '🧒 小朋友' : '🧙 魔法师';
  return new Paragraph({
    spacing: { after: 80, line: 320 },
    indent: { left: 600 },
    children: [
      new TextRun({ text: `${icon}：`, font: FONT, size: 21, bold: true, color: speaker === 'child' ? 'E67E22' : '8E44AD' }),
      new TextRun({ text, font: FONT, size: 21, color: '2C3E50' }),
    ],
  });
}

function divider() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'BDC3C7' } },
    children: [],
  });
}

function bulletItem(text) {
  return new Paragraph({
    spacing: { after: 80, line: 340 },
    indent: { left: 600 },
    children: [
      new TextRun({ text: '• ', font: FONT, size: 22 }),
      new TextRun({ text, font: FONT, size: 22 }),
    ],
  });
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: FONT, size: 22 },
      },
    },
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
      },
    },
    children: [

      // ==================== 封面 ====================
      new Paragraph({ spacing: { before: 2400 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({ text: '故事魔法师', font: FONT, size: 56, bold: true, color: '8E44AD' }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [
          new TextRun({ text: 'Story Magician', font: FONT_EN, size: 36, color: '9B59B6' }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [
          new TextRun({ text: '面向 3-6 岁幼儿的绘本创编伙伴智能体', font: FONT, size: 26, color: '7F8C8D' }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [
          new TextRun({ text: '项目演示讲稿', font: FONT, size: 30, bold: true, color: '2C3E50' }),
        ],
      }),
      new Paragraph({ spacing: { before: 1200 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: '✨ 让每个孩子都成为故事的小魔法师 ✨', font: FONT, size: 22, color: '9B59B6', italics: true }),
        ],
      }),

      // ==================== 第一部分：开场 ====================
      new Paragraph({ children: [new PageBreak()] }),
      heading1('一、开场：项目概述'),

      heading2('1.1 项目定位与价值'),
      bodyText('各位好，今天我要为大家介绍的项目叫做"故事魔法师"——一个专为 3 到 6 岁幼儿设计的 AI 绘本创编伙伴。'),
      bodyText('简单来说，它是一个能陪孩子"一起编故事"的智能体。孩子只需要说话或打字，AI 就会像一位温柔的魔法师一样，一步步引导孩子从零开始，创作出属于自己的完整故事，并且自动生成配图、短视频和图文小书。'),

      heading2('1.2 解决的痛点'),
      boldBodyText('痛点一：', '幼儿想象力丰富但缺乏叙事结构。3-6 岁的孩子脑子里充满了奇思妙想，但他们往往不知道怎么把零散的想法组织成一个完整的故事。故事魔法师通过"四阶段叙事模型"，像搭脚手架一样，一步步引导孩子构建完整的故事结构。'),
      boldBodyText('痛点二：', '家长和老师缺乏个性化引导工具。传统的绘本阅读是单向接收，孩子只是被动听故事。而故事魔法师让孩子从"听故事的人"变成"讲故事的人"，在互动中发展语言表达、逻辑思维和情绪认知能力。'),
      boldBodyText('痛点三：', '儿童内容创作门槛高。创作一本绘本需要绘画、排版、写作等多方面能力。故事魔法师让 AI 自动生成配图和视频，一键整理成可保存的图文小书，让每个孩子都能拥有自己的"出版作品"。'),

      heading2('1.3 核心亮点'),
      bulletItem('年龄自适应：针对 3-4 岁、4-5 岁、5-6 岁三个阶段，定制不同的语言风格与引导深度'),
      bulletItem('四阶段叙事模型：灵感唤醒 → 感官细节 → 逻辑挑战 → 情绪反思，科学引导故事创作'),
      bulletItem('多模态生成：对话中自动生成儿童插画风格配图，可选生成短视频，一键整理成绘本'),
      bulletItem('沉浸式交互：支持语音输入、AI 朗读、电话模式连续对话、迷你互动游戏'),
      bulletItem('安全守护：内容安全过滤、年龄适配、沙箱隔离，全方位保护儿童体验'),
      bulletItem('能力报告：五维度量化评估孩子的叙事能力发展，为家长提供成长参考'),

      speakerHint('开场部分建议控制在 2-3 分钟内，重点传达"这是什么"和"为什么需要它"两个核心信息。'),

      // ==================== 第二部分：核心功能 ====================
      new Paragraph({ children: [new PageBreak()] }),
      heading1('二、核心功能演示'),

      bodyText('接下来，我将按照用户的实际使用流程，逐一演示系统的每一个核心功能。'),

      // ---- 2.1 年龄选择 ----
      heading2('2.1 年龄选择与个性化适配'),
      bodyText('用户首次进入故事魔法师时，系统会弹出一个年龄选择界面，让家长选择孩子所在的年龄段：3-4 岁、4-5 岁或 5-6 岁。'),
      bodyText('这个选择非常重要，因为它决定了整个对话过程中 AI 的语言风格和引导策略：'),
      bulletItem('3-4 岁：句子极短（每句不超过 8 个字），多用叠词和拟声词，问题聚焦命名与描述，每次只问一个问题，孩子说不出来时给出两个具体选项'),
      bulletItem('4-5 岁：句子适中（每句不超过 15 个字），引入因果连词，鼓励情绪词表达，引导孩子说完整句子'),
      bulletItem('5-6 岁：句子可稍长（每句不超过 20 个字），支持多方案思考，引导完整故事结构，提出反事实问题'),

      speakerHint('可以现场演示：选择不同年龄段后，观察开场白的语言差异。3-4 岁的开场白会用"小兔兔""小汽车"这样简单的词，而 5-6 岁的开场白会提供更开放的选择。'),

      // ---- 2.2 四阶段对话 ----
      heading2('2.2 四阶段故事共创'),
      bodyText('这是故事魔法师最核心的功能。AI 会按照"四阶段叙事模型"引导孩子一步步创作故事。下面我逐一讲解每个阶段，并给出参考的对话案例。'),

      heading3('阶段一：灵感唤醒'),
      boldBodyText('目标：', '选定角色与场景，激活想象力。'),
      boldBodyText('策略：', 'AI 提供 2-3 个有反差的具体选项，让孩子选择。孩子选定后，系统立即生成第一张配图。'),
      bodyText('参考对话案例：'),

      demoLine('ai', '你好呀✨ 今天想讲【小兔子找妈妈】的故事，还是【小恐龙过生日】的故事？或者你想讲什么呀？'),
      demoLine('child', '小恐龙过生日！'),
      demoLine('ai', '小恐龙过生日呀！魔法师这就把它画出来✨ 小恐龙的生日蛋糕上，会有几根蜡烛呢？'),

      bodyText('此时系统自动生成一张"小恐龙过生日"的儿童插画风格配图，展示在右侧魔法画廊中。'),
      speakerHint('演示时重点展示：孩子一选定主题，配图就立刻出现，不需要额外等待。这种"即说即画"的体验能极大地激发孩子的参与感。'),

      heading3('阶段二：感官细节'),
      boldBodyText('目标：', '用五感法引导孩子描述细节，丰富词汇。'),
      boldBodyText('策略：', '针对孩子描述的场景，追问感官细节——"摸起来""闻起来""听起来""尝起来""看起来"。每描述一个新的视觉元素，就自动生成一张配图。'),
      bodyText('参考对话案例：'),

      demoLine('child', '蛋糕是巧克力味的！'),
      demoLine('ai', '巧克力蛋糕呀～魔法师都闻到香香的味啦😋 你觉得这个蛋糕咬下去，是软软的，还是脆脆的呀？'),
      demoLine('child', '软软的，还有奶油'),
      demoLine('ai', '软软的奶油蛋糕，咬一口咕噜咕噜就化啦！魔法师把它画出来✨ 小恐龙的朋友们会来参加生日派对吗？'),

      speakerHint('注意 AI 的对话结构：先"接话"复述孩子说的关键词，再"延展"加一句小想象或感官联想，最后用"引导问题"把接力棒交回给孩子。这种"三段式"对话结构贯穿始终。'),

      heading3('阶段三：逻辑挑战'),
      boldBodyText('目标：', '引入意外事件，训练解决问题的能力。'),
      boldBodyText('策略：', '用"随机魔法盒"或"因果提问"制造小障碍——大石头挡路、桥断了、糖果飞走了……让孩子想办法解决。'),
      bodyText('参考对话案例：'),

      demoLine('ai', '小恐龙正要吹蜡烛，突然——呼！一阵大风把蜡烛吹灭啦！小恐龙急得直跺脚，怎么办呀？'),
      demoLine('child', '我来帮它！'),
      demoLine('ai', '哎呀宝贝太勇敢啦！魔法师这就把救援现场变出来——你能帮小恐龙把飘走的 3 个气球一个个抓回来吗？'),

      bodyText('此时系统触发"迷你互动游戏"，孩子可以在屏幕上点击抓回气球，通关后故事继续推进。'),

      heading3('阶段四：情绪反思'),
      boldBodyText('目标：', '识别角色情绪，引导孩子做观点采择。'),
      boldBodyText('策略：', '使用情绪引导问题，帮助孩子识别和表达角色的感受。至少完成一轮情绪反思后，才能结束故事、生成绘本。'),
      bodyText('参考对话案例：'),

      demoLine('ai', '小恐龙终于吹灭了蜡烛，许了一个大大的愿望🥳 它抱着朋友们送的小礼物，你猜它心里是甜甜的，还是暖暖的呢？'),
      demoLine('child', '暖暖的！'),
      demoLine('ai', '暖暖的呀～被朋友们围着的感觉真好呢！宝贝，你最喜欢这个故事里哪一段呀？'),

      speakerHint('四阶段演示建议控制在 5-8 分钟。可以实际运行系统，让孩子（或模拟孩子）与 AI 对话，展示真实的互动效果。如果时间有限，可以提前准备一段录屏。'),

      // ---- 2.3 多模态生成 ----
      new Paragraph({ children: [new PageBreak()] }),
      heading2('2.3 多模态内容生成'),

      heading3('文生图：即时配画'),
      bodyText('在对话过程中，每当孩子描述一个新的视觉元素——角色、颜色、动作、道具、场景——系统就会自动调用火山引擎文生图 API，生成一张 1120×1120 像素的儿童插画风格配图。'),
      bodyText('关键设计：'),
      bulletItem('第一轮对话：孩子选定故事主题后，必须立即出图，不追问额外问题'),
      bulletItem('后续轮次：每描述一个新视觉元素就出图，宁多勿少'),
      bulletItem('以图生图：如果上一轮已有配图，下一轮会基于上一张图进行编辑，保持画面连续性'),
      bulletItem('画风统一：所有图片都自动添加"儿童绘本风格，色彩明快，线条柔和"的前缀提示'),

      speakerHint('演示时可以指着右侧的"魔法画廊"，展示图片如何随着对话逐步丰富。强调"即说即画"的实时性。'),

      heading3('文生视频：动态故事（可选功能）'),
      bodyText('当故事进入高潮或出现明显动作场景时，系统可以自动生成约 15 秒的 16:9 动态短视频。此功能默认关闭，需在环境变量中设置 ENABLE_VIDEO=true 开启，以节省 API 调用成本。'),

      heading3('图文小书：一键成书'),
      bodyText('对话进行到第 5 轮之后，用户可以点击"制作魔法小书"按钮。系统会：'),
      bulletItem('调用 AI 将完整对话整理为 5-8 页的连贯绘本叙事，每页 2-4 句话、30-70 字'),
      bulletItem('优先复用对话中已生成的配图，缺少插图的页面自动补充生成'),
      bulletItem('生成后以弹窗形式展示，支持保存为长图下载'),
      bulletItem('还可将小书的插图合成动画视频，一键生成"故事动画"'),

      speakerHint('这是整个演示的高潮部分。点击"制作魔法小书"后，等待几秒，一本完整的绘本就会呈现在屏幕上。可以翻页展示每一页的图文内容，然后点击"保存长图"演示导出功能。'),

      // ---- 2.4 能力报告 ----
      heading2('2.4 能力发展报告'),
      bodyText('对话进行到第 3 轮之后，用户可以点击"能力报告"按钮。AI 会分析孩子在这次故事创编中展现的能力表现，从五个维度进行星级评定：'),
      bulletItem('发散性思维：是否提出了创意、出人意料的想法'),
      bulletItem('词汇运用：使用了哪些有趣的词汇或生动的描述'),
      bulletItem('逻辑思维：如何回应故事中的冲突和挑战'),
      bulletItem('同理心/情绪认知：对角色情感的理解和描述'),
      bulletItem('故事结构感：是否有起承转合的意识'),
      bodyText('报告还会给出总体评价和个性化鼓励语，为家长提供孩子叙事能力发展的参考。'),

      speakerHint('点击"能力报告"后，展示五维星级评定卡片。强调这不是"考试打分"，而是"成长记录"——帮助家长了解孩子在哪些方面有亮点，哪些方面可以多加练习。'),

      // ---- 2.5 语音交互 ----
      heading2('2.5 语音交互体验'),

      heading3('语音输入'),
      bodyText('基于 Web Speech API，孩子可以点击麦克风按钮，直接用语音说出自己的想法，系统会自动识别为文字并发送。这对于还不会打字的低龄幼儿尤其友好。'),

      heading3('AI 朗读（TTS）'),
      bodyText('AI 的每一条回复都会自动朗读出来。系统优先使用火山引擎 TTS 服务合成中文语音，如果服务不可用则降级到浏览器内置语音合成。朗读语速略慢（0.95 倍速），音调略高（1.3 倍），更符合儿童听觉习惯。'),

      heading3('电话模式'),
      bodyText('这是故事魔法师最具沉浸感的交互方式。开场白朗读结束后，系统会模拟一个"微信来电"界面，伴随"叮咚"铃声，邀请孩子"接听电话"。接听后进入连续语音对话模式：'),
      bulletItem('孩子说话时，系统实时监听音频能量，检测到 2 秒静音后自动结束录音'),
      bulletItem('录音发送至语音识别服务转为文字，再调用 AI 生成回复'),
      bulletItem('AI 回复自动朗读，朗读结束后重新开始监听'),
      bodyText('整个过程孩子完全不需要触碰屏幕，就像在和魔法师打电话一样自然。'),

      speakerHint('电话模式是演示的亮点功能。建议现场演示：让孩子（或模拟）接听来电，展示连续语音对话的流畅体验。如果环境嘈杂，可以改用文字模式演示。'),

      // ---- 2.6 迷你游戏 ----
      heading2('2.6 迷你互动游戏'),
      bodyText('当故事进行到需要孩子"参与救援"或"解决困难"的转折点时，系统会自动触发一个迷你互动游戏。这个游戏完全由 AI 根据当前故事场景实时生成，而非预设模板。'),
      bodyText('游戏特点：'),
      bulletItem('紧扣剧情：游戏的主角、目标、任务文案都直接来自当前故事场景'),
      bulletItem('年龄适配：3-4 岁只需点击 3 个大目标，5-6 岁可能需要拖拽、叠加、配对 4-5 个元素'),
      bulletItem('不会失败：孩子怎么操作都不会输，最多让目标弹回原位'),
      bulletItem('安全沙箱：游戏在 iframe 沙箱中运行，禁止访问外部资源和本地存储'),
      bulletItem('通关接回剧情：游戏通关后，AI 会热情夸奖孩子，并把游戏成果接回故事主线继续推进'),
      bodyText('每个对话会话最多触发一次迷你游戏，且仅在第二阶段末或第三阶段触发。'),

      bodyText('参考通关接话案例：'),
      demoLine('child', '我做到啦！把石头叠起来给小猫咪当小脚墩！'),
      demoLine('ai', '哎呀宝贝你真是小英雄！石头叠得稳稳的，小猫咪踩上去一伸爪子，咕噜噜——终于够到那条香喷喷的小鱼啦🐟 它会咬着小鱼跑去给谁吃呀？'),

      speakerHint('迷你游戏是孩子参与感最强的环节。建议现场触发一个游戏，让孩子实际操作通关，然后展示 AI 如何自然地把游戏结果接回故事。'),

      // ---- 2.7 历史记录 ----
      heading2('2.7 历史记录与续写'),
      bodyText('每次对话都会自动保存到本地 JSON 文件。用户可以：'),
      bulletItem('点击"历史"按钮查看所有已保存的故事列表'),
      bulletItem('查看某个故事的完整对话记录'),
      bulletItem('点击"继续对话"从断点恢复会话，继续创作'),
      bodyText('恢复会话时，系统会还原对话历史、故事阶段、已生成的配图等全部状态，确保故事可以无缝续写。'),

      // ---- 2.8 安全机制 ----
      heading2('2.8 内容安全机制'),
      bodyText('作为面向幼儿的产品，内容安全是故事魔法师的重中之重。系统从多个层面保障安全：'),

      boldBodyText('输入过滤：', '当孩子说出暴力、恐怖、死亡等不适宜内容时，系统会自动进行温柔改写。例如"打死"替换为"轻轻挠痒痒"，"鬼"替换为"顽皮的小精灵"，"死了"替换为"睡着了，做了一个长长的梦"。改写后会显示提示"✨ 魔法师把故事变得更美好了"。'),
      boldBodyText('输出约束：', 'AI 的系统提示词中明确要求"严禁暴力、恐怖、悲惨、成人化情节"，遇到不适内容必须温和改写后继续推进。'),
      boldBodyText('画风保障：', '所有文生图和文生视频的提示词都自动添加"儿童绘本风格，色彩明快，线条柔和，适合 3-6 岁儿童"的前缀。'),
      boldBodyText('游戏沙箱：', '迷你游戏在 sandbox iframe 中运行，禁止访问外部资源、本地存储和跳转，且有安全内容检测。'),

      // ==================== 第三部分：技术架构 ====================
      new Paragraph({ children: [new PageBreak()] }),
      heading1('三、技术架构概览'),

      bodyText('为了让各位对系统有更全面的理解，我简要介绍一下技术架构。'),

      heading2('3.1 技术栈'),
      bulletItem('后端框架：Node.js + Express'),
      bulletItem('前端：原生 JavaScript + EJS 模板（轻量、无框架依赖）'),
      bulletItem('大语言模型：字节跳动 Ark 平台（豆包 doubao-seed）'),
      bulletItem('图像生成：火山引擎 CVProcess API（1120×1120px 同步/异步）'),
      bulletItem('视频生成：火山引擎 CVSync2Async API（16:9，约 15 秒）'),
      bulletItem('语音合成：火山引擎 TTS + 浏览器 SpeechSynthesis 降级'),
      bulletItem('语音识别：火山引擎 ASR + 浏览器 SpeechRecognition 降级'),
      bulletItem('会话存储：内存（运行时，最多 500 条，2 小时 TTL）+ JSON 文件（持久化）'),

      heading2('3.2 请求流程'),
      bodyText('核心对话流程如下：'),
      bulletItem('1. 用户发送消息 → 前端调用 /api/chat-stream（流式接口）'),
      bulletItem('2. 后端读取会话上下文 → 安全过滤输入 → 构造带年龄策略和阶段上下文的消息'),
      bulletItem('3. 调用 Ark 大模型 → 流式返回 reply 文本（打字机效果）'),
      bulletItem('4. 解析 AI 返回的 JSON 结构（reply、action、imagePrompt 等）'),
      bulletItem('5. 若 action=generate_image → 调用文生图 API，结果展示在画廊和聊天气泡中'),
      bulletItem('6. 若 action=mini_game → 调用 AI 生成游戏 HTML，在沙箱 iframe 中加载'),
      bulletItem('7. 若 action=finalize_book → 自动触发成书流程'),
      bulletItem('8. 前端同时调用 TTS 朗读 AI 回复'),

      speakerHint('技术架构部分根据听众背景决定讲解深度。如果听众偏产品或业务方向，可以简化为"AI 对话 + 多模态生成 + 安全过滤"三层；如果听众偏技术方向，可以展开讲流式输出、以图生图、沙箱隔离等细节。'),

      // ==================== 第四部分：演示流程建议 ====================
      heading1('四、完整演示流程建议'),

      bodyText('以下是建议的现场演示流程，总时长约 15-20 分钟：'),

      boldBodyText('第一步（2 分钟）：', '开场介绍。展示项目首页，介绍项目定位、解决的痛点和核心亮点。'),
      boldBodyText('第二步（1 分钟）：', '选择年龄段。现场选择 4-5 岁，展示不同年龄段的开场白差异。'),
      boldBodyText('第三步（5-8 分钟）：', '四阶段对话演示。让孩子（或模拟）与 AI 完整走一遍四阶段流程，重点展示：即时配图、三段式对话结构、迷你游戏触发与通关。'),
      boldBodyText('第四步（2 分钟）：', '制作魔法小书。点击按钮，等待生成，展示绘本翻页效果和长图导出。'),
      boldBodyText('第五步（1 分钟）：', '能力报告。展示五维星级评定和个性化鼓励语。'),
      boldBodyText('第六步（2 分钟）：', '电话模式演示。接听来电，展示连续语音对话的沉浸体验。'),
      boldBodyText('第七步（1 分钟）：', '安全机制。简要介绍内容过滤和画风保障。'),
      boldBodyText('第八步（2 分钟）：', '总结与展望。回顾核心价值，展望未来方向。'),

      // ==================== 第五部分：总结 ====================
      new Paragraph({ children: [new PageBreak()] }),
      heading1('五、总结与展望'),

      heading2('5.1 核心价值回顾'),
      bodyText('故事魔法师的核心价值可以用三句话概括：'),
      bulletItem('让孩子从"听故事的人"变成"讲故事的人"——在 AI 的支架式引导下，每个孩子都能创作属于自己的故事'),
      bulletItem('让创作从"想象"变成"可见"——多模态生成让孩子的想法即时变成配图、视频和绘本'),
      bulletItem('让成长从"模糊"变成"可量化"——五维能力报告帮助家长了解孩子的叙事能力发展'),

      heading2('5.2 未来展望'),
      bulletItem('多语言支持：扩展英文、日文等多语言故事创作'),
      bulletItem('协作模式：支持多个孩子共同创作一个故事'),
      bulletItem('个性化角色库：让孩子创建和积累自己的故事角色'),
      bulletItem('打印服务：对接打印服务，将魔法小书变成真正的纸质绘本'),
      bulletItem('教师端：为幼儿园老师提供班级故事创作管理和能力分析面板'),

      new Paragraph({ spacing: { before: 600 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: '✨ 谢谢大家！让每个孩子都成为故事的小魔法师 ✨', font: FONT, size: 24, bold: true, color: '8E44AD' }),
        ],
      }),

    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  const outPath = process.argv[2] || './Story_Magician_Demo_Script.docx';
  fs.writeFileSync(outPath, buffer);
  console.log('✅ 讲稿已生成:', outPath);
});
