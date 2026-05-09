const fs = require('fs');
const path = require('path');

const HISTORY_DIR = path.resolve(__dirname, '../.history');
const ID_RE = /^[0-9a-f]{16}$/;

function ensureDir() {
  if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

function deriveTitle(session) {
  const first = (session.history || []).find(m => m.role === 'user');
  if (!first) return '新故事';
  const t = first.content.slice(0, 24);
  return t.length < first.content.length ? t + '…' : t;
}

function saveHistory(session) {
  try {
    ensureDir();
    const data = {
      id: session.id,
      title: deriveTitle(session),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      history: session.history,
      scenes: session.scenes,
      ageGroup: session.ageGroup || '4-5',
      phase: session.phase || 1,
      gamePlayed: !!session.gamePlayed,
    };
    fs.writeFileSync(
      path.join(HISTORY_DIR, `${session.id}.json`),
      JSON.stringify(data),
    );
  } catch (e) {
    console.error('保存历史失败:', e.message);
  }
}

function listHistories() {
  try {
    ensureDir();
    return fs.readdirSync(HISTORY_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, f), 'utf8'));
          return {
            id: data.id,
            title: data.title || '无标题故事',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            messageCount: Math.floor(((data.history || []).length) / 2),
          };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch { return []; }
}

function loadHistory(id) {
  if (!ID_RE.test(id)) return null;
  try {
    const file = path.join(HISTORY_DIR, `${id}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { return null; }
}

module.exports = { saveHistory, listHistories, loadHistory };
