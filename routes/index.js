const express = require('express');
const router = express.Router();

const aiService = require('../services/aiService');
const prompts = require('../services/prompts');
const safety = require('../services/safety');
const sessionStore = require('../services/sessionStore');
const imageService = require('../services/imageService');
const videoService = require('../services/videoService');
const historyService = require('../services/historyService');

// ============ 页面 ============

router.get('/', (req, res) => {
  res.render('index', {
    title: '故事魔法师',
    opening: prompts.OPENING,
  });
});

// ============ 会话 ============

router.post('/api/session', (req, res) => {
  const validGroups = ['3-4', '4-5', '5-6'];
  const ageGroup = validGroups.includes(req.body.ageGroup) ? req.body.ageGroup : '4-5';
  const s = sessionStore.newSession(ageGroup);
  res.json({ sessionId: s.id, opening: prompts.getOpening(ageGroup), ageGroup });
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
    const parsed = aiService.extractJson(raw) || {};

    const reply = String(parsed.reply || '我再想想哦～接下来呢？').slice(0, 120);
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

// ============ 文生图（提交 + 查询） ============

router.post('/api/image', async (req, res) => {
  try {
    const { sessionId, prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: '缺少图像 prompt' });
    const result = await imageService.createImage(prompt);

    // 同步模式（ark）直接落盘；异步模式（jimeng）需客户端轮询
    if (result.mode === 'sync' && result.imageUrl) {
      const s = sessionStore.getSession(sessionId);
      if (s) {
        const last = s.scenes[s.scenes.length - 1];
        if (last) {
          last.imageUrl = result.imageUrl;
          historyService.saveHistory(s);
        }
      }
    }
    res.json(result);
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

// ============ 整理成图文小书 ============

router.post('/api/book', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const s = sessionStore.getSession(sessionId);
    if (!s) return res.status(404).json({ error: '会话已过期' });
    if (!s.history.length)
      return res.status(400).json({ error: '故事还没开始呢' });

    const messages = prompts.buildBookMessages(s.history);
    const raw = await aiService.chat(messages, {
      temperature: 0.6,
      maxTokens: 1800,
      responseFormat: 'json',
    });
    const book = aiService.extractJson(raw) || {};
    if (!Array.isArray(book.pages) || !book.pages.length) {
      return res.status(500).json({ error: '成书失败，请重试' });
    }

    // 把已生成的图片/视频 URL 回填到对应页（按顺序近似匹配）
    const generated = s.scenes.filter((x) => x.imageUrl || x.videoUrl);
    book.pages.forEach((p, idx) => {
      const g = generated[idx];
      if (g?.imageUrl && !p.imageUrl) p.imageUrl = g.imageUrl;
      if (g?.videoUrl && !p.videoUrl) p.videoUrl = g.videoUrl;
    });

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

  res.json({
    sessionId: s.id,
    title: data.title,
    ageGroup,
    phase: s.phase,
    history: s.history,
    scenes: s.scenes,
  });
});

module.exports = router;
