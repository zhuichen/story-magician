const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } = require('docx');
const fs = require('fs');
const path = require('path');

const doc = new Document({
  sections: [{
    properties: {},
    children: [
      // 标题
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "故事魔法师",
            bold: true,
            size: 48,
            color: "6B46C1"
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [
          new TextRun({
            text: "Story Magician 用户使用手册",
            size: 28,
            color: "718096"
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [
          new TextRun({
            text: "—— 面向3-6岁幼儿的绘本创编伙伴智能体",
            size: 24,
            italics: true,
            color: "4A5568"
          })
        ]
      }),

      // 目录
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "目录", bold: true })]
      }),
      new Paragraph({ text: "1. 项目介绍.............................................................................................................. 3", spacing: { after: 100 } }),
      new Paragraph({ text: "2. 如何安装使用该项目......................................................................................... 4", spacing: { after: 100 } }),
      new Paragraph({ text: "2.1 外部API如何申请........................................................................................... 5", spacing: { after: 100 } }),
      new Paragraph({ text: "3. 外部API调用价格................................................................................................. 7", spacing: { after: 400 } }),

      // 第一章：项目介绍
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        children: [new TextRun({ text: "1. 项目介绍", bold: true })]
      }),
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "1.1 项目概述", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: "故事魔法师（Story Magician）是一款专为3-6岁幼儿设计的绘本创编伙伴智能体。它通过AI引导式对话的方式，帮助家长和孩子共同完成故事的创作，并自动生成配图、短视频与图文小书，让孩子成为自己故事世界的小主角。"
          })
        ]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "1.2 解决痛点", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: "在传统幼儿故事创作中，家长往往面临以下困境：", bold: true })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "创意枯竭：不知道该讲什么故事，如何让孩子感兴趣" })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "时间有限：工作繁忙，难以每天花大量时间编故事" })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "表达困难：不知道如何用孩子能理解的语言讲述" })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 200 },
        children: [new TextRun({ text: "形式单一：只有文字，缺乏视觉吸引力，孩子容易走神" })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "1.3 项目意义", bold: true })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "激发创造力：通过四阶段叙事模型，引导孩子从角色选择到情绪反思，逐步构建完整故事", bold: true })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "年龄适配：针对3-4岁、4-5岁、5-6岁三个阶段定制语言风格与问题深度", bold: true })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "多模态输出：对话结束后一键生成配图绘本与动态视频，将文字故事转化为视觉作品", bold: true })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "成长记录：通过能力报告从发散思维、词汇量、逻辑性、共情力、故事结构感五个维度量化孩子的叙事能力", bold: true })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 200 },
        children: [new TextRun({ text: "亲子互动：为家长和孩子提供高质量的亲子共创时光", bold: true })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "1.4 核心功能", bold: true })]
      }),
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: "故事共创（四阶段模型）", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: "项目采用专业的故事创作框架，分四个阶段引导孩子：", bold: true })]
      }),
      new Paragraph({
        table: {
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "阶段", bold: true })] })], width: { size: 20, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "名称", bold: true })] })], width: { size: 20, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "目标", bold: true })] })], width: { size: 60, type: WidthType.PERCENTAGE } })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "第一阶段" })] }),
                new TableCell({ children: [new Paragraph({ text: "灵感唤醒" })] }),
                new TableCell({ children: [new Paragraph({ text: "选择角色与场景，激活想象力" })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "第二阶段" })] }),
                new TableCell({ children: [new Paragraph({ text: "感官细节" })] }),
                new TableCell({ children: [new Paragraph({ text: "用五感问题丰富故事画面" })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "第三阶段" })] }),
                new TableCell({ children: [new Paragraph({ text: "逻辑挑战" })] }),
                new TableCell({ children: [new Paragraph({ text: "引入障碍事件，培养问题解决思维" })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "第四阶段" })] }),
                new TableCell({ children: [new Paragraph({ text: "情绪反思" })] }),
                new TableCell({ children: [new Paragraph({ text: "引导情绪识别与故事总结" })] })
              ]
            })
          ]
        },
        spacing: { after: 200 }
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: "多模态生成", bold: true })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "文生图：每个关键叙事节点自动生成儿童插画风配图" })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "文生视频：可选开启，将故事片段转为动态短视频（需设置 ENABLE_VIDEO=true）" })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "图文小书：一键将完整对话整理为4-8页绘本，含页面文字与插图描述" })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 200 },
        children: [new TextRun({ text: "能力报告：AI分析对话内容，输出五维能力星级评定与个性化鼓励语" })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: "交互体验", bold: true })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "语音输入：基于Web Speech API的麦克风输入" })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "朗读功能：TTS朗读AI回复（中文儿童友好声音）" })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "历史记录：自动保存每次对话，支持侧边栏浏览与续写" })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 400 },
        children: [new TextRun({ text: "年龄选择：首次进入时选择孩子年龄段，全程适配表达难度" })]
      }),

      // 第二章：安装使用
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        children: [new TextRun({ text: "2. 如何安装使用该项目", bold: true })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "2.1 前置要求", bold: true })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "Node.js ≥ 18", bold: true })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "字节跳动Ark平台账号（获取API Key及模型ID）" })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "火山引擎账号（获取Access Key ID与Secret Access Key，开通图像/视频生成服务）" })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 300 },
        children: [new TextRun({ text: "火山引擎语音合成服务（可选，用于TTS朗读功能）" })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "2.2 安装步骤", bold: true })]
      }),
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: "第一步：克隆项目", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "git clone <repo-url>", font: "Consolas" })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "cd story-magician" })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: "第二步：安装依赖", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "npm install" })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: "第三步：配置环境变量", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: "复制示例文件并填写密钥：", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: "cp .env.example .env", font: "Consolas" })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "编辑 .env 文件，配置以下内容：", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "# 字节跳动Ark大模型", font: "Consolas" })]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: "ARK_API_KEY=your_ark_api_key_here", font: "Consolas" })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "ARK_MODEL=doubao-seed-2-0-lite-260215", font: "Consolas" })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "# 火山引擎（图像 & 视频生成）", font: "Consolas" })]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: "VOLC_ACCESS_KEY_ID=your_volc_access_key_id_here", font: "Consolas" })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "VOLC_SECRET_ACCESS_KEY=your_volc_secret_access_key_here", font: "Consolas" })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "# 语音合成配置（可选）", font: "Consolas" })]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: "VOLC_TTS_APPID=your_tts_appid_here", font: "Consolas" })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "VOLC_TTS_TOKEN=your_tts_token_here", font: "Consolas" })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "VOLC_TTS_CLUSTER=volcano_tts", font: "Consolas" })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "# 服务端口（默认3200）", font: "Consolas" })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "PORT=3200", font: "Consolas" })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "# 是否开启文生视频功能（默认关闭，建议开启以节省API费用）", font: "Consolas" })]
      }),
      new Paragraph({
        spacing: { after: 300 },
        children: [new TextRun({ text: "ENABLE_VIDEO=false", font: "Consolas" })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: "第四步：启动服务", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: "生产模式：", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "npm start", font: "Consolas" })]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: "开发模式（需安装nodemon）：", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 300 },
        children: [new TextRun({ text: "npm run dev", font: "Consolas" })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: "第五步：访问应用", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 400 },
        children: [new TextRun({ text: "打开浏览器访问：http://localhost:3200", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 400 },
        children: [new TextRun({ text: "首次进入会弹出年龄选择界面，选择孩子所在年龄段即可开始故事创作。", italics: true })]
      }),

      // API申请
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        children: [new TextRun({ text: "2.3 外部API如何申请", bold: true })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "字节跳动Ark大模型 API 申请", bold: true })]
      }),
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: "申请步骤：", bold: true })]
      }),
      new Paragraph({
        numbering: { level: 0 },
        children: [new TextRun({ text: "访问字节跳动火山引擎控制台：https://console.volcengine.com/" })]
      }),
      new Paragraph({
        numbering: { level: 0 },
        children: [new TextRun({ text: "注册或登录账号（如已有火山引擎账号可直接登录）" })]
      }),
      new Paragraph({
        numbering: { level: 0 },
        children: [new TextRun({ text: "在控制台中搜索\"方舟\"或\"Ark\"，进入\"Ark大模型\"服务" })]
      }),
      new Paragraph({
        numbering: { level: 0 },
        children: [new TextRun({ text: "点击\"API Key管理\"，创建新的API Key" })]
      }),
      new Paragraph({
        numbering: { level: 0 },
        spacing: { after: 200 },
        children: [new TextRun({ text: "复制API Key，填入项目的ARK_API_KEY环境变量" })]
      }),
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: "模型配置说明：", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: "项目默认使用模型：doubao-seed-2-0-lite-260215（豆包种子模型2.0轻量版）", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 400 },
        children: [new TextRun({ text: "该模型针对创意写作场景优化，非常适合故事创作任务。如需更换其他模型，可在.env中修改ARK_MODEL参数。" })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "火山引擎 API 申请（图像与视频生成）", bold: true })]
      }),
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: "申请步骤：", bold: true })]
      }),
      new Paragraph({
        numbering: { level: 0 },
        children: [new TextRun({ text: "访问火山引擎控制台：https://console.volcengine.com/" })]
      }),
      new Paragraph({
        numbering: { level: 0 },
        children: [new TextRun({ text: "进入\"访问控制\" -> \"访问密钥\"，创建Access Key（AK）和Secret Access Key（SK）" })]
      }),
      new Paragraph({
        numbering: { level: 0 },
        children: [new TextRun({ text: "复制AK和SK，填入项目的VOLC_ACCESS_KEY_ID和VOLC_SECRET_ACCESS_KEY环境变量" })]
      }),
      new Paragraph({
        numbering: { level: 0 },
        children: [new TextRun({ text: "在控制台中搜索\"图像生产\"或\"视频生产\"，开通相应服务" })]
      }),
      new Paragraph({
        numbering: { level: 0 },
        spacing: { after: 400 },
        children: [new TextRun({ text: "根据需要选择按量付费或购买资源包" })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "火山引擎语音合成 API 申请（可选）", bold: true })]
      }),
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: "申请步骤：", bold: true })]
      }),
      new Paragraph({
        numbering: { level: 0 },
        children: [new TextRun({ text: "在火山引擎控制台中搜索\"豆包语音\"或\"语音合成\"" })]
      }),
      new Paragraph({
        numbering: { level: 0 },
        children: [new TextRun({ text: "进入\"应用管理\"，点击\"创建应用\"" })]
      }),
      new Paragraph({
        numbering: { level: 0 },
        children: [new TextRun({ text: "创建完成后，获取AppID、Token和Cluster信息" })]
      }),
      new Paragraph({
        numbering: { level: 0 },
        spacing: { after: 200 },
        children: [new TextRun({ text: "将获取的信息填入项目的VOLC_TTS_APPID、VOLC_TTS_TOKEN和VOLC_TTS_CLUSTER环境变量" })]
      }),
      new Paragraph({
        spacing: { after: 400 },
        children: [
          new TextRun({ text: "注意：", bold: true }),
          new TextRun({ text: "语音合成功能为可选配置。如未配置，系统会自动降级到浏览器自带的语音合成（质量较低）。" })
        ]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "声音选项说明", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: "项目使用\"灿灿2.0\"（BV700_V2_streaming）作为默认声音，这是一款活泼可爱的女童声音，更加适合3-6岁幼儿。其他可选声音：", italics: true })]
      }),
      new Paragraph({
        table: {
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "声音名称", bold: true })] })], width: { size: 30, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "voice_type", bold: true })] })], width: { size: 30, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "特点", bold: true })] })], width: { size: 40, type: WidthType.PERCENTAGE } })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "灿灿 2.0（默认）" })] }),
                new TableCell({ children: [new Paragraph({ text: "BV700_V2_streaming" })] }),
                new TableCell({ children: [new Paragraph({ text: "女童声，活泼可爱，支持22种情感" })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "天才少女" })] }),
                new TableCell({ children: [new Paragraph({ text: "BV421_streaming" })] }),
                new TableCell({ children: [new Paragraph({ text: "女童声，聪明伶俐" })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "奶气萌娃" })] }),
                new TableCell({ children: [new Paragraph({ text: "BV051_streaming" })] }),
                new TableCell({ children: [new Paragraph({ text: "男童声，奶声奶气" })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "天才童声" })] }),
                new TableCell({ children: [new Paragraph({ text: "BV061_streaming" })] }),
                new TableCell({ children: [new Paragraph({ text: "男童声，天真可爱" })] })
              ]
            })
          ]
        },
        spacing: { after: 400 }
      }),

      // 第三章：价格
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        children: [new TextRun({ text: "3. 外部API调用价格", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "运行该项目主要涉及以下三方服务的API调用费用，以下价格为参考价，具体以各平台最新定价为准。", italics: true })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "3.1 字节跳动Ark大模型（必选）", bold: true })]
      }),
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: "计费方式：按Token计费（输入+输出）", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "推荐模型：doubao-seed-2-0-lite-260215（轻量版）", bold: true })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "输入Token价格：约 ¥0.001元/千Token（约 ¥1元/百万Token）" })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "输出Token价格：约 ¥0.002元/千Token（约 ¥2元/百万Token）" })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "预估成本：", bold: true })]
      }),
      new Paragraph({
        table: {
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "使用场景", bold: true })] })], width: { size: 50, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "预估费用", bold: true })] })], width: { size: 50, type: WidthType.PERCENTAGE } })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "每次故事对话（约10-20轮）" })] }),
                new TableCell({ children: [new Paragraph({ text: "约 ¥0.1-0.3元" })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "每天使用10次" })] }),
                new TableCell({ children: [new Paragraph({ text: "约 ¥1-3元/天" })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "每月使用（每天10次）" })] }),
                new TableCell({ children: [new Paragraph({ text: "约 ¥30-90元/月" })] })
              ]
            })
          ]
        },
        spacing: { after: 400 }
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "3.2 火山引擎图像生成（必选）", bold: true })]
      }),
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: "计费方式：按张计费或按量付费", bold: true })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "文生图单张价格：约 ¥0.1-0.3元/张（根据分辨率和模型不同有所差异）" })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "以图生图单张价格：约 ¥0.2-0.5元/张" })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "预估成本：", bold: true })]
      }),
      new Paragraph({
        table: {
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "使用场景", bold: true })] })], width: { size: 50, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "预估费用", bold: true })] })], width: { size: 50, type: WidthType.PERCENTAGE } })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "每次故事生成5-8张配图" })] }),
                new TableCell({ children: [new Paragraph({ text: "约 ¥0.5-2.4元" })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "每天生成3本绘本" })] }),
                new TableCell({ children: [new Paragraph({ text: "约 ¥1.5-7元/天" })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "每月使用（每天3本绘本）" })] }),
                new TableCell({ children: [new Paragraph({ text: "约 ¥45-210元/月" })] })
              ]
            })
          ]
        },
        spacing: { after: 400 }
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "3.3 火山引擎视频生成（可选，默认关闭）", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "如需开启视频生成功能，请在.env中设置 ENABLE_VIDEO=true", bold: true })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "视频生成单条价格：约 ¥1-3元/条（15秒视频）" })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "生成时间：30-120秒（异步任务）" })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "预估成本：", bold: true })]
      }),
      new Paragraph({
        table: {
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "使用场景", bold: true })] })], width: { size: 50, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "预估费用", bold: true })] })], width: { size: 50, type: WidthType.PERCENTAGE } })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "每本绘本生成1-2个视频" })] }),
                new TableCell({ children: [new Paragraph({ text: "约 ¥2-6元" })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "每天生成3本绘本，各1个视频" })] }),
                new TableCell({ children: [new Paragraph({ text: "约 ¥6-18元/天" })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "每月使用（每天3本绘本）" })] }),
                new TableCell({ children: [new Paragraph({ text: "约 ¥180-540元/月" })] })
              ]
            })
          ]
        },
        spacing: { after: 400 }
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "3.4 火山引擎语音合成（可选）", bold: true })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "TTS按字符计费：约 ¥0.0005-0.001元/千字符" })]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "预估成本：", bold: true })]
      }),
      new Paragraph({
        table: {
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "使用场景", bold: true })] })], width: { size: 50, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "预估费用", bold: true })] })], width: { size: 50, type: WidthType.PERCENTAGE } })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "每次朗读3-5段文字" })] }),
                new TableCell({ children: [new Paragraph({ text: "约 ¥0.01-0.05元" })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "每月使用（每天朗读10次）" })] }),
                new TableCell({ children: [new Paragraph({ text: "约 ¥3-15元/月" })] })
              ]
            })
          ]
        },
        spacing: { after: 400 }
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "3.5 月度总成本估算", bold: true })]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: "根据不同使用频率，月度成本估算如下：", bold: true })]
      }),
      new Paragraph({
        table: {
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "使用频率", bold: true })] })], width: { size: 30, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "包含功能", bold: true })] })], width: { size: 30, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "预估月费", bold: true })] })], width: { size: 40, type: WidthType.PERCENTAGE } })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "轻度使用\n（每天1次）" })] }),
                new TableCell({ children: [new Paragraph({ text: "对话 + 图片" })] }),
                new TableCell({ children: [new Paragraph({ text: "约 ¥30-80元/月", color: "22C55E" })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "中度使用\n（每天3次）" })] }),
                new TableCell({ children: [new Paragraph({ text: "对话 + 图片" })] }),
                new TableCell({ children: [new Paragraph({ text: "约 ¥90-250元/月", color: "F59E0B" })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "重度使用\n（每天5次）" })] }),
                new TableCell({ children: [new Paragraph({ text: "对话 + 图片" })] }),
                new TableCell({ children: [new Paragraph({ text: "约 ¥150-400元/月", color: "EF4444" })] })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "含视频\n（中度使用）" })] }),
                new TableCell({ children: [new Paragraph({ text: "对话 + 图片 + 视频" })] }),
                new TableCell({ children: [new Paragraph({ text: "约 ¥270-790元/月", color: "DC2626" })] })
              ]
            })
          ]
        },
        spacing: { after: 300 }
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "3.6 成本优化建议", bold: true })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "购买资源包：各大平台都提供资源包，购买后单价更低", bold: true })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "关闭视频生成：视频费用较高，日常使用建议关闭（ENABLE_VIDEO=false）", bold: true })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "使用免费额度：新用户通常有免费试用额度，可充分利用", bold: true })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: "设置用量告警：在各平台设置消费上限，避免意外超支", bold: true })]
      }),
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 400 },
        children: [new TextRun({ text: "定期查看账单：监控API使用情况，及时调整使用策略", bold: true })]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "3.7 注意事项", bold: true })]
      }),
      new Paragraph({
        numbering: { level: 0 },
        children: [new TextRun({ text: "以上价格为参考价，实际价格以各平台最新定价为准" })]
      }),
      new Paragraph({
        numbering: { level: 0 },
        children: [new TextRun({ text: "不同地区的定价可能有所差异，建议选择就近区域" })]
      }),
      new Paragraph({
        numbering: { level: 0 },
        children: [new TextRun({ text: "API调用可能因网络、限流等因素产生额外费用" })]
      }),
      new Paragraph({
        numbering: { level: 0 },
        spacing: { after: 600 },
        children: [new TextRun({ text: "建议首次使用时先进行小额测试，了解实际费用后再正常使用" })]
      }),

      // 页脚
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
        children: [
          new TextRun({
            text: "—— 文档结束 ——",
            color: "718096",
            italics: true
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [
          new TextRun({
            text: "如有疑问，请访问项目GitHub页面或联系开发者",
            color: "A0AEC0",
            size: 20
          })
        ]
      })
    ]
  }]
});

async function createDoc() {
  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(__dirname, 'Story_Magician_User_Guide.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log('文档已生成: ' + outputPath);
}

createDoc().catch(console.error);
