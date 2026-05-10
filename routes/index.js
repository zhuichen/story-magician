const express = require('express');
const https = require('https');
const http = require('http');
const router = express.Router();

const aiService = require('../services/aiService');
const prompts = require('../services/prompts');
const safety = require('../services/safety');
const sessionStore = require('../services/sessionStore');
const imageService = require('../services/imageService');
const videoService = require('../services/videoService');
const historyService = require('../services/historyService');
const ttsService = require('../services/ttsService');
const sttService = require('../services/sttService');
const gameService = require('../services/gameService');

// ============ 页面 ============

router.get('/', (req, res) => {
  res.render('index', { title: '故事魔法师' });
});

// ============ 图片代理（绕过 html2canvas 跨域污染） ============

router.get('/api/proxy-image', (req, res) => {
  const url = String(req.query.url || '');
  if (!/^https?:\/\//i.test(url)) {
    return res.status(400).send('bad url');
  }
  const client = url.startsWith('https://') ? https : http;
  client
    .get(url, (upstream) => {
      if (upstream.statusCode && upstream.statusCode >= 400) {
        res.status(upstream.statusCode).end();
        upstream.resume();
        return;
      }
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const ct = upstream.headers['content-type'];
      if (ct) res.setHeader('Content-Type', ct);
      upstream.pipe(res);
    })
    .on('error', (err) => {
      console.warn('proxy-image error:', err.message);
      if (!res.headersSent) res.status(502).end();
    });
});

// ============ 会话 ============

router.post('/api/session', (req, res) => {
  const validGroups = ['3-4', '4-5', '5-6'];
  const ageGroup = validGroups.includes(req.body.ageGroup) ? req.body.ageGroup : '4-5';
  const s = sessionStore.newSession(ageGroup);
  res.json({ sessionId: s.id, ageGroup });
});

// ============ 开场白（流式随机生成） ============

router.post('/api/opening-stream', async (req, res) => {
  const { sessionId } = req.body;

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const session = sessionStore.getSession(sessionId);
    if (!session) { send('error', { error: '会话已过期，请刷新页面' }); return res.end(); }

    const messages = prompts.buildOpeningMessages(session.ageGroup || '4-5');
    let full = '';
    try {
      full = await aiService.chatStream(
        messages,
        { temperature: 1.0, maxTokens: 200 },
        (delta) => send('delta', { text: delta })
      );
    } catch (e) {
      // AI 失败时降级到内置开场白
      const fallback = prompts.getOpening(session.ageGroup || '4-5');
      send('delta', { text: fallback });
      full = fallback;
    }

    const opening = String(full).trim().slice(0, 200);
    session.history.push({ role: 'assistant', content: opening });
    sessionStore.touch(sessionId);
    historyService.saveHistory(session);

    send('done', { opening });
    res.end();
  } catch (err) {
    console.error('opening-stream 失败:', err.message);
    send('error', { error: err.message || '开场白生成失败' });
    res.end();
  }
});

// ============ 对话接龙 ============

router.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, input } = req.body;
    if (!sessionId) return res.status(400).json({ error: '缺少 sessionId' });
    if (!input || !String(input).trim()) {
      return res.status(400).json({ error: '小朋友还没说话呀' });
    }
    const session = sessionStore.getSession(sessionId);
    if (!session) return res.status(404).json({ error: '会话已过期，请刷新页面' });

    // 1) 敏感词温柔改写
    const { text: safeInput, replaced } = safety.sanitize(input);

    // 2) 调用 LLM（携带当前阶段 + 年龄组上下文）
    const messages = prompts.buildMessages(session.history, safeInput, session.phase || 1, session.ageGroup || '4-5');
    const raw = await aiService.chat(messages, {
      temperature: 0.85,
      maxTokens: 800,
      responseFormat: 'json',
    });
    const parsed = aiService.extractJson(raw);
    if (!parsed) {
      console.warn('[chat] extractJson 解析失败，完整 raw:', String(raw || ''));
    }
    if (!parsed) parsed = {};

    const reply = String(parsed.reply || '我再想想哦～接下来呢？').slice(0, 160);
    let action = parsed.action || 'continue';
    let imagePrompt = parsed.imagePrompt || '';
    const videoPrompt = parsed.videoPrompt || '';
    const scene = parsed.scene || safeInput;
    const emotionQuestion = parsed.emotionQuestion || '';

    // 更新会话阶段（AI 决定推进哪个阶段）
    const nextPhase = parseInt(parsed.phase, 10);
    if (nextPhase >= 1 && nextPhase <= 4) {
      session.phase = nextPhase;
    }

    // 视频生成默认关闭，由 ENABLE_VIDEO=true 开启
    const videoEnabled = process.env.ENABLE_VIDEO === 'true';
    if (!videoEnabled && action === 'generate_video') {
      action = 'generate_image';
      imagePrompt = videoPrompt || imagePrompt;
    }

    // mini_game 护栏：每个会话最多 1 次；Phase 1 / Phase 4 不允许触发
    let gameScenario = (parsed && parsed.gameScenario) || '';
    if (action === 'mini_game') {
      if (session.gamePlayed || session.phase === 1 || session.phase >= 4 || !gameScenario.trim()) {
        action = 'continue';
        gameScenario = '';
      }
    }

    // 3) 写入历史（用户侧保存改写后的安全版本）
    session.history.push({ role: 'user', content: safeInput });
    session.history.push({ role: 'assistant', content: reply });
    session.scenes.push({ text: scene });
    sessionStore.touch(sessionId);
    historyService.saveHistory(session);

    res.json({
      reply,
      action,
      imagePrompt,
      videoPrompt,
      gameScenario,
      scene,
      emotionQuestion,
      sanitized: replaced,
      phase: session.phase,
      ageGroup: session.ageGroup || '4-5',
      round: Math.ceil(session.history.length / 2),
    });
  } catch (err) {
    console.error('chat 失败:', err.message);
    res.status(500).json({ error: err.message || 'AI 调用失败' });
  }
});

// ============ 对话接龙（流式） ============

/**
 * 从流式 JSON 文本中实时抽取 `reply` 字段的字符。
 * 仅支持顶层 reply 字符串（与系统提示词约定一致）。
 */
function makeReplyExtractor() {
  let buf = '';
  let started = false;       // 已找到 "reply" 的开始引号
  let finished = false;      // 已找到 reply 的结束引号
  let escape = false;        // 上一个字符是反斜杠
  let cursor = 0;            // 在 buf 中的扫描位置

  return function pump(chunk) {
    buf += chunk;
    let out = '';

    if (!started) {
      const m = buf.slice(cursor).match(/"reply"\s*:\s*"/);
      if (!m) return out;
      cursor += m.index + m[0].length;
      started = true;
    }

    if (finished) return out;

    while (cursor < buf.length) {
      const ch = buf[cursor++];
      if (escape) {
        // 简化处理常见转义
        if (ch === 'n') out += '\n';
        else if (ch === 't') out += '\t';
        else if (ch === 'r') out += '\r';
        else out += ch;
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        finished = true;
        break;
      } else {
        out += ch;
      }
    }
    return out;
  };
}

router.post('/api/chat-stream', async (req, res) => {
  const { sessionId, input } = req.body;

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    if (!sessionId) { send('error', { error: '缺少 sessionId' }); return res.end(); }
    if (!input || !String(input).trim()) {
      send('error', { error: '小朋友还没说话呀' });
      return res.end();
    }
    const session = sessionStore.getSession(sessionId);
    if (!session) { send('error', { error: '会话已过期，请刷新页面' }); return res.end(); }

    const { text: safeInput, replaced } = safety.sanitize(input);
    const messages = prompts.buildMessages(session.history, safeInput, session.phase || 1, session.ageGroup || '4-5');

    const extractReply = makeReplyExtractor();
    let streamedTextLen = 0;
    const raw = await aiService.chatStream(
      messages,
      { temperature: 0.85, maxTokens: 800, responseFormat: 'json' },
      (delta) => {
        const piece = extractReply(delta);
        if (piece) {
          streamedTextLen += piece.length;
          send('delta', { text: piece });
        }
      }
    );

    let parsed = aiService.extractJson(raw);
    if (!parsed) {
      console.warn('[chat-stream] extractJson 首次解析失败，完整 raw:', String(raw || ''));
      const jsonMatch = String(raw || '').match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch (e2) {
          console.warn('[chat-stream] 二次 JSON 解析也失败:', e2.message);
        }
      }
    }

    const isPostGame = /^我做到啦|完成啦|通关啦|搭好啦|叠好啦|救出来啦|我成功/.test(safeInput || '');
    const fallbackReply = isPostGame
      ? '哎呀宝贝你真是小英雄！故事里的小伙伴在你帮助下顺利脱险啦～接下来你想让它做什么呀？'
      : '我再想想哦～接下来呢？';

    let reply;
    if (parsed && parsed.reply) {
      reply = String(parsed.reply).slice(0, 160);
    } else if (raw && String(raw).trim() && !String(raw).trim().startsWith('{')) {
      reply = String(raw).trim().slice(0, 160);
      console.warn('[chat-stream] 模型返回了纯文本而非 JSON，将纯文本作为 reply');
    } else {
      reply = fallbackReply;
      console.warn('[chat-stream] JSON 解析全部失败，将使用兜底文案');
    }

    if (streamedTextLen === 0 && reply) {
      send('delta', { text: reply });
      streamedTextLen = reply.length;
    }
    let action = (parsed && parsed.action) || 'continue';
    let imagePrompt = (parsed && parsed.imagePrompt) || '';

    const videoPrompt = (parsed && parsed.videoPrompt) || '';
    const scene = (parsed && parsed.scene) || safeInput;
    const emotionQuestion = (parsed && parsed.emotionQuestion) || '';

    const nextPhase = parseInt((parsed && parsed.phase) || 0, 10);
    if (nextPhase >= 1 && nextPhase <= 4) session.phase = nextPhase;

    const videoEnabled = process.env.ENABLE_VIDEO === 'true';
    if (!videoEnabled && action === 'generate_video') {
      action = 'generate_image';
      imagePrompt = videoPrompt || imagePrompt;
    }

    let gameScenario = (parsed && parsed.gameScenario) || '';

    // mini_game 护栏：每个会话最多 1 次；Phase 1 / Phase 4 不允许触发
    const shouldTriggerGame = action === 'mini_game' && !session.gamePlayed && session.phase >= 2 && session.phase <= 3 && gameScenario.trim();
    if (action === 'mini_game' && !shouldTriggerGame) {
      action = 'continue';
      gameScenario = '';
    }

    // 优化1：每一步对话强制生成图片（finalize_book、ask_emotion 和 游戏时除外）
    if (action !== 'finalize_book' && action !== 'ask_emotion' && action !== 'mini_game') {
      if (action !== 'generate_image' && action !== 'generate_video') {
        action = 'generate_image';
      }
      if (!imagePrompt.trim()) {
        imagePrompt = `故事场景：${scene || safeInput}，一个生动的卡通画面`;
      }
    }

    // 强制护栏：在情绪反思至少完成 2 轮之前，禁止 finalize_book（最多2个情绪问题）
    // 计数规则：上一轮 AI 是 ask_emotion 且本轮孩子给出了非空回答，emotionRounds += 1
    if (session.lastAction === 'ask_emotion' && safeInput && safeInput.trim()) {
      session.emotionRounds = (session.emotionRounds || 0) + 1;
    }

    // 优化4：修复制作魔法小书触发条件 - 检测关键词包含"精装小书"、"魔法小书"时触发finalize_book
    const hasBookKeywords = /精装小书|魔法小书|变成一本.*书|做成.*书|变成.*绘本/i.test(reply);
    if (hasBookKeywords && action !== 'finalize_book') {
      action = 'finalize_book';
    }

    if (action === 'finalize_book' && (session.emotionRounds || 0) < 2) {
      action = 'ask_emotion';
      reply = '你的故事好精彩呀！在画成小书前，魔法师想问问你——故事里它现在心情是怎样的呢？';
      send('delta', { text: '\n（先做最后一个情绪小问题哦～）' });
    }
    session.lastAction = action;

    // 兜底：除 finalize_book 外，每条 reply 都必须以问号结尾，确保对话不中断
    const endsWithQuestion = /[？?]\s*$/.test(reply);
    if (!endsWithQuestion && action !== 'finalize_book') {
      const followUps = {
        1: ' 魔法师好想知道，它长什么样子呀？',
        2: ' 你来告诉魔法师，摸起来会是什么感觉呢？',
        3: ' 哎呀，那它会怎么办呢？',
        4: ' 你猜猜看，它现在心里是什么感觉呀？',
      };
      const append = followUps[session.phase] || ' 那接下来呢？';
      reply = (reply + append).slice(0, 160);
      send('delta', { text: append });
    }

    session.history.push({ role: 'user', content: safeInput });
    session.history.push({ role: 'assistant', content: reply });
    session.scenes.push({ text: scene });
    sessionStore.touch(sessionId);
    historyService.saveHistory(session);

    send('done', {
      reply,
      action,
      imagePrompt,
      videoPrompt,
      gameScenario,
      scene,
      emotionQuestion,
      sanitized: replaced,
      phase: session.phase,
      ageGroup: session.ageGroup || '4-5',
      round: Math.ceil(session.history.length / 2),
    });
    res.end();
  } catch (err) {
    console.error('chat-stream 失败:', err.message);
    send('error', { error: err.message || 'AI 调用失败' });
    res.end();
  }
});

// ============ 文生图（提交 + 查询） ============

router.post('/api/image', async (req, res) => {
  try {
    const { sessionId, prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: '缺少图像 prompt' });
    const s = sessionStore.getSession(sessionId);

    // 有上一张图就走以图生图，让画面保持连续性
    let result;
    let usedEdit = false;
    const lastImageUrl = s?.lastImageUrl;
    if (lastImageUrl && /^https?:\/\//i.test(lastImageUrl)) {
      try {
        result = await imageService.editImage(prompt, lastImageUrl);
        usedEdit = true;
      } catch (e) {
        console.warn('[editImage] 降级到文生图:', e.message);
        result = await imageService.createImage(prompt);
      }
    } else {
      result = await imageService.createImage(prompt);
    }

    if (result.mode === 'sync' && result.imageUrl && s) {
      const last = s.scenes[s.scenes.length - 1];
      if (last) last.imageUrl = result.imageUrl;
      // 仅当返回的是公网 URL 才作为下一次以图生图的输入
      if (/^https?:\/\//i.test(result.imageUrl)) {
        s.lastImageUrl = result.imageUrl;
      }
      historyService.saveHistory(s);
    }
    res.json({ ...result, usedEdit });
  } catch (err) {
    console.error('image 失败:', err.apiResponse || err.message);
    const status = err.code === 'CREDS_MISSING' ? 500 : 400;
    res.status(status).json({ error: err.message });
  }
});

router.get('/api/image/:taskId', async (req, res) => {
  try {
    const { sessionId } = req.query;
    const data = await imageService.queryImage(req.params.taskId);
    if (data.status === 'done' && data.imageUrl && sessionId) {
      const s = sessionStore.getSession(sessionId);
      if (s) {
        const last = s.scenes[s.scenes.length - 1];
        if (last && !last.imageUrl) {
          last.imageUrl = data.imageUrl;
          historyService.saveHistory(s);
        }
      }
    }
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message, apiCode: err.apiCode });
  }
});

// ============ 文生视频（提交 + 查询） ============

router.post('/api/video', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: '缺少视频 prompt' });
    const result = await videoService.createVideo(prompt);
    res.json(result);
  } catch (err) {
    console.error('video 失败:', err.apiResponse || err.message);
    const status = err.code === 'CREDS_MISSING' ? 500 : 400;
    res.status(status).json({ error: err.message });
  }
});

router.get('/api/video/:taskId', async (req, res) => {
  try {
    const { sessionId } = req.query;
    const data = await videoService.queryVideo(req.params.taskId);
    if (data.status === 'done' && data.videoUrl && sessionId) {
      const s = sessionStore.getSession(sessionId);
      if (s) {
        const last = s.scenes[s.scenes.length - 1];
        if (last && !last.videoUrl) {
          last.videoUrl = data.videoUrl;
          historyService.saveHistory(s);
        }
      }
    }
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message, apiCode: err.apiCode });
  }
});

// ============ 魔法小书动画（多图 + 文案） ============

router.post('/api/book-video', async (req, res) => {
  try {
    const { sessionId, imageUrls, prompt } = req.body;
    const s = sessionStore.getSession(sessionId);
    if (!s) return res.status(404).json({ error: '会话已过期' });
    if (!Array.isArray(imageUrls) || !imageUrls.length) {
      return res.status(400).json({ error: '需要先生成魔法小书的插图' });
    }

    if (s.bookVideoUrl) {
      return res.json({ mode: 'cached', videoUrl: s.bookVideoUrl });
    }

    const result = await videoService.createBookVideo(imageUrls, prompt || '');
    s.bookVideoTaskId = result.taskId;
    historyService.saveHistory(s);
    res.json(result);
  } catch (err) {
    console.error('book-video 失败:', err.apiResponse || err.message);
    const status = err.code === 'CREDS_MISSING' ? 500 : 400;
    res.status(status).json({ error: err.message });
  }
});

router.get('/api/book-video/:taskId', async (req, res) => {
  try {
    const { sessionId } = req.query;
    const data = await videoService.queryBookVideo(req.params.taskId);
    if (data.status === 'done' && data.videoUrl && sessionId) {
      const s = sessionStore.getSession(sessionId);
      if (s) {
        s.bookVideoUrl = data.videoUrl;
        historyService.saveHistory(s);
      }
    }
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message, apiCode: err.apiCode });
  }
});

// ============ 整理成图文小书 ============

router.post('/api/book', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const s = sessionStore.getSession(sessionId);
    if (!s) return res.status(404).json({ error: '会话已过期' });
    if (!s.history.length)
      return res.status(400).json({ error: '故事还没开始呢' });

    // 已生成图片的场景作为素材清单交给 AI 选用
    const scenesWithImages = (s.scenes || []).filter((x) => x.imageUrl);

    const messages = prompts.buildBookMessages(s.history, scenesWithImages);
    const raw = await aiService.chat(messages, {
      temperature: 0.7,
      maxTokens: 2800,
      responseFormat: 'json',
    });
    const book = aiService.extractJson(raw) || {};
    if (!Array.isArray(book.pages) || !book.pages.length) {
      return res.status(500).json({ error: '成书失败，请重试' });
    }

    // 1) 优先用 AI 选出的 imageRef 把现有图片回填到对应页
    book.pages.forEach((p) => {
      if (p.imageUrl) return;
      const ref = String(p.imageRef || '').trim();
      const m = ref.match(/^img(\d+)$/i);
      if (!m) return;
      const idx = parseInt(m[1], 10) - 1;
      const asset = scenesWithImages[idx];
      if (asset?.imageUrl) p.imageUrl = asset.imageUrl;
    });

    // 2) 仍缺图的页，按页连续生成（有上一张图就以图生图，没有就文生图）
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const QPS_INTERVAL = 1100;
    let prevImage = null;
    for (let i = 0; i < book.pages.length; i++) {
      const p = book.pages[i];
      if (p.imageUrl) {
        if (/^https?:\/\//i.test(p.imageUrl)) prevImage = p.imageUrl;
        continue;
      }
      if (p.videoUrl) continue;
      const promptText = (p.imagePrompt || p.text || '').trim();
      if (!promptText) continue;

      const tryOnce = async () => {
        let result;
        if (prevImage) {
          try {
            result = await imageService.editImage(promptText, prevImage);
          } catch (e) {
            console.warn(`第${i + 1}页 editImage 降级:`, e.message);
            result = await imageService.createImage(promptText);
          }
        } else {
          result = await imageService.createImage(promptText);
        }
        if (result.imageUrl) {
          p.imageUrl = result.imageUrl;
          if (/^https?:\/\//i.test(result.imageUrl)) prevImage = result.imageUrl;
        }
      };

      try {
        await tryOnce();
      } catch (e) {
        const isRateLimit = /Concurrent Limit|rate.?limit|429/i.test(e.message || '');
        if (isRateLimit) {
          await sleep(2000);
          try { await tryOnce(); }
          catch (e2) { console.warn(`第${i + 1}页插图生成失败(重试后):`, e2.message); }
        } else {
          console.warn(`第${i + 1}页插图生成失败:`, e.message);
        }
      }
      await sleep(QPS_INTERVAL);
    }

    // 把成书时新出的最后一张图也回写到 session，便于继续故事
    if (prevImage) s.lastImageUrl = prevImage;
    historyService.saveHistory(s);

    res.json({ book });
  } catch (err) {
    console.error('book 失败:', err.message);
    res.status(500).json({ error: err.message || '成书失败' });
  }
});

// ============ 能力报告 ============

router.post('/api/report', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const s = sessionStore.getSession(sessionId);
    if (!s) return res.status(404).json({ error: '会话已过期' });
    const userTurns = (s.history || []).filter((h) => h.role === 'user');
    if (userTurns.length < 2) {
      return res.status(400).json({ error: '故事太短了，再多聊几句再来看报告吧！' });
    }

    const messages = prompts.buildReportMessages(s.history);
    const raw = await aiService.chat(messages, { temperature: 0.5, maxTokens: 1000 });
    const report = aiService.extractJson(raw) || {};
    if (!Array.isArray(report.highlights) || !report.highlights.length) {
      return res.status(500).json({ error: '报告生成失败，请重试' });
    }
    res.json({ report });
  } catch (err) {
    console.error('report 失败:', err.message);
    res.status(500).json({ error: err.message || '报告生成失败' });
  }
});

// ============ 迷你游戏（AI 生成 + 通关回写） ============

router.post('/api/mini-game', async (req, res) => {
  try {
    const { sessionId, scenario } = req.body;
    const s = sessionStore.getSession(sessionId);
    if (!s) return res.status(404).json({ error: '会话已过期' });
    if (s.gamePlayed) return res.status(400).json({ error: '本次故事已经玩过游戏啦' });
    if (!scenario || !String(scenario).trim()) {
      return res.status(400).json({ error: '缺少游戏剧情说明' });
    }

    // 取最近 6 轮对话作为上下文（让 AI 复刻主角与场景）
    const recent = (s.history || []).slice(-12)
      .map((h) => `${h.role === 'user' ? '小朋友' : '魔法师'}：${h.content}`)
      .join('\n');

    const { html } = await gameService.generateMiniGame(
      String(scenario).trim(),
      s.ageGroup || '4-5',
      recent
    );
    res.json({ html });
  } catch (err) {
    console.error('mini-game 失败:', err.message);
    res.status(500).json({ error: err.message || '游戏生成失败' });
  }
});

router.post('/api/mini-game/done', (req, res) => {
  try {
    const { sessionId, scenario } = req.body;
    const s = sessionStore.getSession(sessionId);
    if (!s) return res.status(404).json({ error: '会话已过期' });

    s.gamePlayed = true;
    // 合成消息要"像孩子说的话"，AI 才能正确接话——避免书名号、括号、meta 描述
    const desc = (scenario && String(scenario).trim()) || '';
    const synthetic = desc
      ? `我做到啦！${desc}！`
      : '我做到啦！我帮到故事里的小伙伴啦！';
    sessionStore.touch(sessionId);
    historyService.saveHistory(s);

    res.json({ syntheticInput: synthetic });
  } catch (err) {
    console.error('mini-game/done 失败:', err.message);
    res.status(500).json({ error: err.message || '通关写入失败' });
  }
});

// ============ 历史会话 ============

router.get('/api/histories', (req, res) => {
  res.json(historyService.listHistories());
});

router.get('/api/histories/:id', (req, res) => {
  const data = historyService.loadHistory(req.params.id);
  if (!data) return res.status(404).json({ error: '历史记录不存在' });
  res.json(data);
});

router.post('/api/histories/:id/resume', (req, res) => {
  const data = historyService.loadHistory(req.params.id);
  if (!data) return res.status(404).json({ error: '历史记录不存在' });

  const ageGroup = data.ageGroup || '4-5';
  const s = sessionStore.newSession(ageGroup);
  s.history = Array.isArray(data.history) ? [...data.history] : [];
  s.scenes = Array.isArray(data.scenes) ? [...data.scenes] : [];
  s.phase = data.phase || 1;
  s.createdAt = data.createdAt || s.createdAt;

  // 恢复"最近一张图"以便继续故事时仍走以图生图
  const lastWithImg = [...s.scenes].reverse().find((x) => x?.imageUrl && /^https?:\/\//i.test(x.imageUrl));
  if (lastWithImg) s.lastImageUrl = lastWithImg.imageUrl;

  // 恢复情绪反思计数：粗略估计——若 phase 已到 4，认为至少做过 1 轮
  s.emotionRounds = s.phase >= 4 ? 1 : 0;
  s.lastAction = '';
  s.gamePlayed = !!data.gamePlayed;

  res.json({
    sessionId: s.id,
    title: data.title,
    ageGroup,
    phase: s.phase,
    history: s.history,
    scenes: s.scenes,
  });
});

// ============ 语音合成 ============

router.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: '缺少文本内容' });
    }

    const audioBuffer = await ttsService.synthesize(text);
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
    });
    res.send(audioBuffer);
  } catch (err) {
    console.error('TTS 失败:', err.message);
    res.status(500).json({ error: err.message || '语音合成失败' });
  }
});

// ============ 语音识别 ============

router.post('/api/stt', async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    if (audioBuffer.length < 1000) {
      return res.json({ text: '' });
    }

    const format = (req.headers['x-audio-format'] || 'webm').replace(/[^a-z0-9]/g, '');
    const text = await sttService.recognize(audioBuffer, format);
    res.json({ text });
  } catch (err) {
    console.error('STT 失败:', err.message);
    res.status(500).json({ error: err.message || '语音识别失败' });
  }
});

module.exports = router;
