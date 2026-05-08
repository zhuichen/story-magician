const crypto = require('crypto');
const axios = require('axios');

const ASR_SUBMIT_URL = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit';
const ASR_QUERY_URL = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/query';

async function recognize(audioBuffer, format) {
  const appid = process.env.VOLC_TTS_APPID;
  const token = process.env.VOLC_TTS_TOKEN;

  if (!appid || !token) {
    throw new Error('请在 .env 中配置 VOLC_TTS_APPID 和 VOLC_TTS_TOKEN');
  }

  const base64Audio = audioBuffer.toString('base64');

  const reqid = crypto.randomUUID();

  const submitHeaders = {
    'Content-Type': 'application/json',
    'X-Api-App-Key': appid,
    'X-Api-Access-Key': token,
    'X-Api-Resource-Id': 'volc.bigasr.auc',
    'X-Api-Request-Id': reqid,
    'X-Api-Sequence': '-1',
  };

  const submitBody = {
    user: { uid: 'story_user_' + Date.now() },
    audio: {
      data: base64Audio,
      format: format || 'wav',
    },
    request: {
      model_name: 'bigmodel',
      model_version: '400',
      enable_itn: true,
      enable_punc: true,
      show_utterances: false,
    },
  };

  try {
    const submitRes = await axios.post(ASR_SUBMIT_URL, submitBody, {
      headers: submitHeaders,
      timeout: 30000,
    });

    const statusCode = submitRes.headers['x-api-status-code'];
    const xTtLogid = submitRes.headers['x-tt-logid'] || '';

    if (statusCode && statusCode !== '20000000' && statusCode !== '20000001' && statusCode !== '20000002') {
      const msg = submitRes.headers['x-api-message'] || '未知错误';
      throw new Error(`ASR 提交失败: ${statusCode} - ${msg}`);
    }

    return await pollResult(reqid, xTtLogid, appid, token);
  } catch (err) {
    if (err.response) {
      const msg = err.response.headers?.['x-api-message'] || err.message;
      throw new Error(`ASR 接口错误: ${msg}`);
    }
    throw err;
  }
}

async function pollResult(reqid, xTtLogid, appid, token) {
  const queryHeaders = {
    'Content-Type': 'application/json',
    'X-Api-App-Key': appid,
    'X-Api-Access-Key': token,
    'X-Api-Resource-Id': 'volc.bigasr.auc',
    'X-Api-Request-Id': reqid,
    'X-Tt-Logid': xTtLogid,
  };

  const maxAttempts = 15;
  const interval = 1000;

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(interval);

    try {
      const res = await axios.post(ASR_QUERY_URL, {}, {
        headers: queryHeaders,
        timeout: 15000,
      });

      const statusCode = res.headers['x-api-status-code'];

      if (statusCode === '20000000') {
        const result = res.data?.result;
        if (result && result.text) {
          return result.text.trim();
        }
        return '';
      }

      if (statusCode === '20000003') {
        return '';
      }

      if (statusCode === '20000001' || statusCode === '20000002') {
        continue;
      }

      const msg = res.headers['x-api-message'] || '未知错误';
      throw new Error(`ASR 查询失败: ${statusCode} - ${msg}`);
    } catch (err) {
      if (err.message.startsWith('ASR')) throw err;
      if (i === maxAttempts - 1) throw err;
    }
  }

  throw new Error('ASR 识别超时');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { recognize };
