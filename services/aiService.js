const axios = require('axios');

const ARK_URL = 'https://ark.cn-beijing.volces.com/api/v3/responses';

/**
 * 将 OpenAI messages 格式转换为 Ark Responses API 的 input 格式。
 * system 消息单独提取为 instructions，其余按角色映射。
 */
function toArkInput(messages) {
  const input = [];
  for (const msg of messages) {
    if (msg.role === 'system') continue; // handled via instructions
    const contentType = msg.role === 'assistant' ? 'output_text' : 'input_text';
    const item = {
      type: 'message',
      role: msg.role,
      content: [{ type: contentType, text: msg.content }],
    };
    if (msg.role === 'assistant') item.status = 'completed';
    input.push(item);
  }
  return input;
}

/**
 * 方舟 Responses API 对话接口。
 * @param {Array<{role:string,content:string}>} messages 完整对话历史（含 system）
 * @param {object} opts
 */
async function chat(messages, opts = {}) {
  const apiKey = process.env.ARK_API_KEY;
  const model = process.env.ARK_MODEL || 'doubao-seed-2-0-lite-260215';

  if (!apiKey || apiKey.includes('xxxx')) {
    throw new Error('请在 .env 中配置 ARK_API_KEY');
  }

  const systemMsg = messages.find((m) => m.role === 'system');

  const payload = {
    model,
    input: toArkInput(messages),
    temperature: opts.temperature ?? 0.8,
    max_output_tokens: opts.maxTokens ?? 1500,
    thinking: { type: 'disabled' },
  };
  if (systemMsg) {
    payload.instructions = systemMsg.content;
  }

  try {
    const { data } = await axios.post(ARK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 120000,
    });
    // Responses API: output[].content[].text（跳过 reasoning 类输出）
    const assistantOutputs = (data?.output || []).filter(
      (o) => o.role === 'assistant' || o.type === 'message'
    );
    let content = '';
    for (const o of assistantOutputs) {
      const arr = Array.isArray(o.content) ? o.content : [];
      for (const c of arr) {
        if (typeof c.text === 'string') content += c.text;
      }
    }
    if (!content) throw new Error('AI 返回内容为空');
    return content;
  } catch (err) {
    if (err.response) {
      throw new Error(
        `AI 接口错误 ${err.response.status}: ${JSON.stringify(err.response.data).slice(0, 300)}`,
      );
    }
    throw err;
  }
}

/**
 * 从模型返回中提取 JSON（兼容围栏代码块）
 */
function extractJson(text) {
  if (!text) return null;
  const trimmed = String(text).trim();
  // 去除 markdown 围栏
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const raw = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(raw);
  } catch (_) {
    // 尝试截取第一个 { ... }
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}

/**
 * 方舟 Responses API 流式对话接口。
 * @param {Array} messages
 * @param {object} opts { temperature, maxTokens }
 * @param {(textChunk: string) => void} onDelta 每收到一段文本就回调
 * @returns {Promise<string>} 完整文本
 */
async function chatStream(messages, opts = {}, onDelta = () => {}) {
  const apiKey = process.env.ARK_API_KEY;
  const model = process.env.ARK_MODEL || 'doubao-seed-2-0-lite-260215';

  if (!apiKey || apiKey.includes('xxxx')) {
    throw new Error('请在 .env 中配置 ARK_API_KEY');
  }

  const systemMsg = messages.find((m) => m.role === 'system');
  const payload = {
    model,
    input: toArkInput(messages),
    temperature: opts.temperature ?? 0.8,
    max_output_tokens: opts.maxTokens ?? 1500,
    stream: true,
    thinking: { type: 'disabled' },
  };
  if (systemMsg) payload.instructions = systemMsg.content;

  const res = await axios.post(ARK_URL, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      Accept: 'text/event-stream',
    },
    timeout: 120000,
    responseType: 'stream',
  });

  let full = '';
  let buffer = '';
  let sawAnyEvent = false;
  let debugCount = 0;
  const DEBUG = process.env.STREAM_DEBUG === 'true';

  await new Promise((resolve, reject) => {
    res.data.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const eventBlock = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        let eventName = '';
        const dataLines = [];
        eventBlock.split('\n').forEach((line) => {
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        });
        if (!dataLines.length) continue;

        const dataStr = dataLines.join('\n');
        if (dataStr === '[DONE]') continue;
        sawAnyEvent = true;

        let obj;
        try { obj = JSON.parse(dataStr); } catch (_) { continue; }

        if (DEBUG && debugCount < 5) {
          debugCount++;
          console.log(`[chatStream debug #${debugCount}] event=${eventName} keys=${Object.keys(obj).join(',')} sample=${JSON.stringify(obj).slice(0, 400)}`);
        }

        const type = String(obj.type || eventName || '').toLowerCase();

        // 黑名单：丢弃模型的思考/推理过程
        if (type.includes('reasoning') || type.includes('thinking')) continue;

        // 只处理增量事件，跳过 created / in_progress / completed / done / added 等
        // 状态快照（这些事件携带的是完整文本，会导致重复）
        const isDelta =
          type.endsWith('.delta') ||
          (!type && typeof obj.delta === 'string'); // 兼容裸 delta 形式
        if (!isDelta) continue;

        let delta = '';
        if (typeof obj.delta === 'string') {
          delta = obj.delta;
        } else if (obj.delta && typeof obj.delta === 'object') {
          delta = obj.delta.content || obj.delta.text || obj.delta.value || '';
        } else if (typeof obj.text === 'string') {
          delta = obj.text;
        } else if (Array.isArray(obj.choices) && obj.choices[0]) {
          delta = obj.choices[0].delta?.content || '';
        }

        if (delta) {
          full += delta;
          onDelta(delta);
        }
      }
    });
    res.data.on('end', resolve);
    res.data.on('error', reject);
  });

  if (!sawAnyEvent) {
    throw new Error('流式响应为空，可能未启用流式或返回了非 SSE 内容');
  }
  if (!full) {
    console.warn('[chatStream] 收到事件但未解析出文本，尝试非流式回退');
    const fallback = await chat(messages, opts);
    onDelta(fallback);
    return fallback;
  }
  return full;
}

module.exports = { chat, chatStream, extractJson };
