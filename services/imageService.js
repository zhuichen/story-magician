const axios = require('axios');
const { signRequest, HOST } = require('./volcSign');
const { wrapImagePrompt } = require('./safety');

const ENDPOINT = `https://${HOST}`;
const VERSION = '2022-08-31';
const REQ_KEY = 'high_aes_general_v30l_zt2i';

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

async function createImage(prompt) {
  const { accessKey, secretKey } = getVolcCreds();
  const body = {
    req_key: REQ_KEY,
    prompt: wrapImagePrompt(prompt),
    return_url: true,
    width: 1120,
    height: 1120,
  };
  const query = { Action: 'CVProcess', Version: VERSION };
  const signed = signRequest({ accessKey, secretKey, query, body });
  const url = `${ENDPOINT}/?Action=CVProcess&Version=${VERSION}`;

  const res = await axios.post(url, signed.body, {
    headers: signed.headers,
    timeout: 60000,
    validateStatus: () => true,
  });

  const data = res.data;
  if (data.code !== 10000) {
    const err = new Error(data.message || '图片生成失败');
    err.apiCode = data.code;
    err.apiResponse = data;
    throw err;
  }

  const imageUrl =
    data.data?.image_urls?.[0] ||
    (Array.isArray(data.data?.binary_data_base64) && data.data.binary_data_base64[0]
      ? `data:image/png;base64,${data.data.binary_data_base64[0]}`
      : null);
  if (!imageUrl) throw new Error('未返回图片 URL');

  return { mode: 'sync', imageUrl };
}

// Kept for route API compatibility, not used with sync image generation
async function queryImage() {
  return { status: 'done', imageUrl: null };
}

module.exports = { createImage, queryImage };

