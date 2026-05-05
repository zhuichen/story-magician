const axios = require('axios');
const { signRequest, HOST } = require('./volcSign');
const { wrapVideoPrompt } = require('./safety');

const ENDPOINT = `https://${HOST}`;
const VERSION = '2022-08-31';
const REQ_KEY = 'pippit_iv2v_v20_cvtob_with_vinput';

function getVolcCreds() {
  const accessKey = process.env.VOLC_ACCESS_KEY_ID;
  const secretKey = process.env.VOLC_SECRET_ACCESS_KEY;
  if (!accessKey || !secretKey || accessKey.includes('YOUR_')) {
    const err = new Error('未配置火山引擎密钥（VOLC_ACCESS_KEY_ID / VOLC_SECRET_ACCESS_KEY）');
    err.code = 'CREDS_MISSING';
    throw err;
  }
  return { accessKey, secretKey };
}

async function volcCall(action, body) {
  const { accessKey, secretKey } = getVolcCreds();
  const query = { Action: action, Version: VERSION };
  const signed = signRequest({ accessKey, secretKey, query, body });
  const url = `${ENDPOINT}/?Action=${action}&Version=${VERSION}`;
  const res = await axios.post(url, signed.body, {
    headers: signed.headers,
    timeout: 30000,
    validateStatus: () => true,
  });
  return res.data;
}

async function createVideo(prompt) {
  const body = {
    req_key: REQ_KEY,
    prompt: wrapVideoPrompt(prompt),
    ratio: '16:9',
    duration: '～15s',
    language: 'Chinese',
    enable_watermark: false,
  };
  const data = await volcCall('CVSync2AsyncSubmitTask', body);
  if (data.code !== 10000) {
    const err = new Error(data.message || '视频提交失败');
    err.apiCode = data.code;
    err.apiResponse = data;
    throw err;
  }
  return { mode: 'async', taskId: data.data.task_id };
}

async function queryVideo(taskId) {
  const body = { req_key: REQ_KEY, task_id: taskId };
  const data = await volcCall('CVSync2AsyncGetResult', body);
  if (data.code !== 10000) {
    const err = new Error(data.message || '视频查询失败');
    err.apiCode = data.code;
    err.apiResponse = data;
    throw err;
  }
  const d = data.data || {};
  const rawStatus = d.status;
  const status = (rawStatus === 'success' || rawStatus === 'succeed') ? 'done'
    : (rawStatus === 'failed' || rawStatus === 'failure') ? 'failed'
    : 'pending';
  return { status, videoUrl: d.video_url || null };
}

module.exports = { createVideo, queryVideo };

