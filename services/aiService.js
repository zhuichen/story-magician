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
    // Responses API: output[].content[].text
    const content = data?.output?.find((o) => o.role === 'assistant')
      ?.content?.find((c) => c.type === 'output_text')?.text;
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

module.exports = { chat, extractJson };
