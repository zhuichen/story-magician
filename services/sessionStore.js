// 极简内存会话存储（演示用，进程重启会清空）
const crypto = require('crypto');

const SESSIONS = new Map();
const MAX_SESSIONS = 500;
const TTL_MS = 2 * 60 * 60 * 1000; // 2h

function newSession(ageGroup = '4-5') {
  const id = crypto.randomBytes(8).toString('hex');
  const session = {
    id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    history: [], // { role, content }
    scenes: [], // { text, imageUrl?, videoUrl? }
    phase: 1,   // 当前创作阶段 1-4
    ageGroup,   // 年龄组 '3-4' | '4-5' | '5-6'
    emotionRounds: 0,         // 已完成的情绪反思问答轮数（ask_emotion 后孩子给出回答 +1）
    lastAction: '',           // 上一轮 AI 的 action
    gamePlayed: false,        // 是否已触发并完成过迷你小游戏（每个会话最多 1 次）
  };
  SESSIONS.set(id, session);
  pruneIfNeeded();
  return session;
}

function getSession(id) {
  if (!id) return null;
  const s = SESSIONS.get(id);
  if (!s) return null;
  if (Date.now() - s.updatedAt > TTL_MS) {
    SESSIONS.delete(id);
    return null;
  }
  return s;
}

function touch(id) {
  const s = getSession(id);
  if (s) s.updatedAt = Date.now();
}

function pruneIfNeeded() {
  if (SESSIONS.size <= MAX_SESSIONS) return;
  const now = Date.now();
  for (const [k, v] of SESSIONS) {
    if (now - v.updatedAt > TTL_MS) SESSIONS.delete(k);
  }
  if (SESSIONS.size > MAX_SESSIONS) {
    // 删除最旧的一部分
    const arr = [...SESSIONS.entries()].sort(
      (a, b) => a[1].updatedAt - b[1].updatedAt,
    );
    for (let i = 0; i < arr.length - MAX_SESSIONS; i++) {
      SESSIONS.delete(arr[i][0]);
    }
  }
}

module.exports = { newSession, getSession, touch };
