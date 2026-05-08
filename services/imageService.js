const axios = require('axios');
const { signRequest, HOST } = require('./volcSign');
const { wrapImagePrompt } = require('./safety');

const ENDPOINT = `https://${HOST}`;
const VERSION = '2022-08-31';
const REQ_KEY = 'high_aes_general_v30l_zt2i';
// SeedEdit3.0 (图生图3.0-指令编辑) 的 req_key，按实际开通能力可在 .env 覆盖
const EDIT_REQ_KEY = process.env.SEEDEDIT_REQ_KEY || 'byteedit_v3.0';

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

async function callCv(body) {
  const { accessKey, secretKey } = getVolcCreds();
  const query = { Action: 'CVProcess', Version: VERSION };
  const signed = signRequest({ accessKey, secretKey, query, body });
  const url = `${ENDPOINT}/?Action=CVProcess&Version=${VERSION}`;
  const res = await axios.post(url, signed.body, {
    headers: signed.headers,
    timeout: 60000,
    validateStatus: () => true,
  });
  return res.data;
}

function pickImageUrl(data) {
  return (
    data.data?.image_urls?.[0] ||
    (Array.isArray(data.data?.binary_data_base64) && data.data.binary_data_base64[0]
      ? `data:image/png;base64,${data.data.binary_data_base64[0]}`
      : null)
  );
}

async function createImage(prompt) {
  const data = await callCv({
    req_key: REQ_KEY,
    prompt: wrapImagePrompt(prompt),
    return_url: true,
    width: 1120,
    height: 1120,
  });

  if (data.code !== 10000) {
    const err = new Error(data.message || '图片生成失败');
    err.apiCode = data.code;
    err.apiResponse = data;
    throw err;
  }

  const imageUrl = pickImageUrl(data);
  if (!imageUrl) throw new Error('未返回图片 URL');
  return { mode: 'sync', imageUrl };
}

/**
 * 以图生图（SeedEdit3.0）：基于上一张图按指令编辑
 * @param {string} prompt 编辑指令（自然语言）
 * @param {string} imageUrl 上一张图的 URL（http/https）
 */
async function editImage(prompt, imageUrl) {
  if (!imageUrl) throw new Error('editImage 需要 imageUrl');

  const data = await callCv({
    req_key: EDIT_REQ_KEY,
    prompt: wrapImagePrompt(prompt),
    image_urls: [imageUrl],
    return_url: true,
    scale: 0.5,
    seed: -1,
  });

  if (data.code !== 10000) {
    const err = new Error(data.message || '以图生图失败');
    err.apiCode = data.code;
    err.apiResponse = data;
    console.warn('[editImage] 失败响应:', JSON.stringify(data).slice(0, 500));
    throw err;
  }

  const out = pickImageUrl(data);
  if (!out) throw new Error('以图生图未返回图片 URL');
  return { mode: 'sync', imageUrl: out };
}

// Kept for route API compatibility, not used with sync image generation
async function queryImage() {
  return { status: 'done', imageUrl: null };
}

module.exports = { createImage, editImage, queryImage };

