// 儿童绘本适宜性：敏感词 / 不良情节过滤与温柔改写
// 规则：覆盖暴力、恐怖、死亡、脏话等。触发时替换为柔和版本并返回 flag。

const REPLACERS = [
  // 暴力 / 打斗
  { pattern: /(打死|打死了|打爆|杀死|杀了|砍死|砍了|捅死|捅了)/g, to: '轻轻挠痒痒' },
  { pattern: /(打架|动手|打一架)/g, to: '比赛谁先笑出声' },
  { pattern: /(流血|血淋淋|鲜血|出血)/g, to: '撒了一地红色花瓣' },
  // 吃掉 / 吞食
  { pattern: /(吃掉了?|吞掉了?|吞下了?)/g, to: '请吃胡萝卜蛋糕' },
  // 恐怖 / 鬼怪
  { pattern: /(鬼|僵尸|吸血鬼|恶魔|魔鬼)/g, to: '顽皮的小精灵' },
  { pattern: /(怪物|妖怪|怪兽)/g, to: '毛茸茸的大朋友' },
  // 死亡 / 分离
  { pattern: /(死了|死亡|去世|没命了)/g, to: '睡着了，做了一个长长的梦' },
  { pattern: /(永远分开|永远不见|永远分离)/g, to: '约好下次再见面' },
  // 负面情绪过重
  { pattern: /(恨死|讨厌死|气死)/g, to: '有点小生气' },
  // 脏话
  { pattern: /(傻瓜|笨蛋|蠢货|白痴)/g, to: '小糊涂' },
];

function sanitize(text) {
  if (!text) return { text: '', replaced: false, original: text };
  let result = String(text);
  let replaced = false;
  for (const { pattern, to } of REPLACERS) {
    if (pattern.test(result)) {
      replaced = true;
      result = result.replace(pattern, to);
    }
  }
  return { text: result, replaced, original: text };
}

// 用于图像/视频提示词前缀：保证画风适宜
const IMAGE_STYLE_PREFIX =
  '儿童绘本风格，色彩明快，线条柔和，适合3-6岁儿童，温暖治愈，精致插画。';
const VIDEO_STYLE_PREFIX =
  '儿童动画风格，色彩明快，画面温暖，动作流畅自然，适合3-6岁儿童观看。';

function wrapImagePrompt(p) {
  const { text } = sanitize(p);
  return `${IMAGE_STYLE_PREFIX}${text}`;
}

function wrapVideoPrompt(p) {
  const { text } = sanitize(p);
  return `${VIDEO_STYLE_PREFIX}${text}`;
}

module.exports = { sanitize, wrapImagePrompt, wrapVideoPrompt };
