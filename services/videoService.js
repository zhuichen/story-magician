const axios = require('axios');
const { signRequest, HOST } = require('./volcSign');
const { wrapVideoPrompt } = require('./safety');

const ENDPOINT = `https://${HOST}`;
const VERSION = '2022-08-31';
const REQ_KEY = 'pippit_iv2v_v20_cvtob_with_vinput';
const BOOK_VIDEO_REQ_KEY = process.env.VOLC_BOOK_VIDEO_REQ_KEY || 'pippit_iv2v_cvtob';

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

async function createBookVideo(imageUrls, prompt) {
  const urls = (imageUrls || []).filter((u) => /^https?:\/\//i.test(u));
  if (!urls.length) {
    throw new Error('需要先生成魔法小书的插图');
  }
  // 单张图片 + 视频总数不超过 50；prompt 限制 2000 字以内
  const imgList = urls.slice(0, 50);
  const safePrompt = wrapVideoPrompt(prompt || '').slice(0, 2000);
  const body = {
    req_key: BOOK_VIDEO_REQ_KEY,
    prompt: safePrompt,
    img_url_list: imgList,
    ratio: '16:9',
    duration: '～30s',
    language: 'Chinese',
    enable_watermark: false,
  };
  console.log('[book-video] submit:', JSON.stringify({
    req_key: body.req_key,
    promptPreview: safePrompt.slice(0, 80),
    promptLen: safePrompt.length,
    imgCount: imgList.length,
    imgUrls: imgList,
    ratio: body.ratio,
    duration: body.duration,
  }));
  const data = await volcCall('CVSync2AsyncSubmitTask', body);
  console.log('[book-video] submit response:', JSON.stringify(data));
  if (data.code !== 10000) {
    const err = new Error(data.message || '动画提交失败');
    err.apiCode = data.code;
    err.apiResponse = data;
    throw err;
  }
  return { mode: 'async', taskId: data.data.task_id };
}

async function queryBookVideo(taskId) {
  const body = { req_key: BOOK_VIDEO_REQ_KEY, task_id: taskId };
  const data = await volcCall('CVSync2AsyncGetResult', body);
  const d = data.data || {};
  console.log('[book-video] query:', JSON.stringify({
    taskId,
    code: data.code,
    message: data.message,
    status: d.status,
    videoUrl: d.video_url || null,
  }));
  if (data.code !== 10000) {
    const err = new Error(data.message || '动画查询失败');
    err.apiCode = data.code;
    err.apiResponse = data;
    throw err;
  }
  const rawStatus = d.status;
  const status = (rawStatus === 'success' || rawStatus === 'succeed') ? 'done'
    : (rawStatus === 'failed' || rawStatus === 'failure') ? 'failed'
    : 'pending';
  return { status, videoUrl: d.video_url || null };
}

module.exports = { createVideo, queryVideo, createBookVideo, queryBookVideo };

