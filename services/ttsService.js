const crypto = require('crypto');
const axios = require('axios');

const TTS_API = 'https://openspeech.bytedance.com/api/v1/tts';

/**
 * 火山引擎语音合成服务
 * 使用儿童友好的声音：灿灿 2.0（活泼可爱的女童声）
 */

/**
 * 生成语音
 * @param {string} text 要合成的文本
 * @returns {Promise<Buffer>} 音频数据
 */
async function synthesize(text) {
  const appid = process.env.VOLC_TTS_APPID || '4793097125';
  const token = process.env.VOLC_TTS_TOKEN;
  const cluster = process.env.VOLC_TTS_CLUSTER || 'volcano_tts';

  if (!token) {
    throw new Error('请在 .env 中配置 VOLC_TTS_TOKEN（在火山引擎控制台创建语音合成应用获取）');
  }

  // 使用儿童友好的声音
  // BV700_V2_streaming: 灿灿 2.0（女童声，活泼可爱，支持22种情感）
  // 其他儿童声音选项：
  // - BV421_streaming: 天才少女
  // - BV051_streaming: 奶气萌娃（男童）
  // - BV061_streaming: 天才童声（男童）
  const payload = {
    app: {
      appid: appid,
      token: token,
      cluster: cluster
    },
    user: {
      uid: 'story_user_' + Date.now()
    },
    audio: {
      voice_type: 'BV700_V2_streaming',  // 灿灿 2.0 - 女童声
      encoding: 'mp3',
      speed_ratio: 1.0,      // 语速：1.0 正常
      volume_ratio: 1.2,     // 音量稍大
      pitch_ratio: 1.0,      // 音调
      emotion: 'happy'       // 情感：开心（支持：通用、愉悦、开心、讲故事等）
    },
    request: {
      reqid: crypto.randomUUID(),
      text: text.slice(0, 1000),  // 限制长度
      text_type: 'plain',
      operation: 'query',
      with_frontend: 1,
      frontend_type: 'unitTson'
    }
  };

  try {
    const response = await axios.post(TTS_API, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer;${token}`
      },
      timeout: 30000
    });

    // 响应是 JSON，音频数据在 data 字段中，base64 编码
    if (response.data && response.data.data) {
      return Buffer.from(response.data.data, 'base64');
    } else {
      throw new Error('TTS 返回格式错误');
    }
  } catch (err) {
    console.error('TTS 错误:', err.response?.data || err.message);
    throw new Error('语音合成失败: ' + (err.response?.data?.message || err.message));
  }
}

module.exports = { synthesize };
