// 临时测试脚本：直接调用视频 API，打印原始响应
require('dotenv').config();
const axios = require('axios');
const { signRequest, HOST } = require('./services/volcSign');
const { wrapVideoPrompt } = require('./services/safety');
const { createVideo } = require('./services/videoService');

const ENDPOINT = `https://${HOST}`;
const VERSION = '2022-08-31';
const REQ_KEY = 'pippit_iv2v_v20_cvtob_with_vinput';

async function queryVideoRaw(taskId) {
  const accessKey = process.env.VOLC_ACCESS_KEY_ID;
  const secretKey = process.env.VOLC_SECRET_ACCESS_KEY;
  const body = { req_key: REQ_KEY, task_id: taskId };
  const query = { Action: 'CVSync2AsyncGetResult', Version: VERSION };
  const signed = signRequest({ accessKey, secretKey, query, body });
  const url = `${ENDPOINT}/?Action=CVSync2AsyncGetResult&Version=${VERSION}`;
  const res = await axios.post(url, signed.body, { headers: signed.headers, timeout: 30000, validateStatus: () => true });
  return res.data;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const prompt = '一条小龙在蓝天白云中飞翔，阳光明媚，卡通绘本风格';
  console.log('▶ 提交视频任务，prompt:', prompt);

  let taskId;
  try {
    const res = await createVideo(prompt);
    taskId = res.taskId;
    console.log('✅ 提交成功, taskId:', taskId);
  } catch (e) {
    console.error('❌ 提交失败:', e.message, e.apiResponse || '');
    process.exit(1);
  }

  console.log('\n▶ 开始轮询（每10秒，最多30次 = 5分钟）...');
  for (let i = 1; i <= 30; i++) {
    await sleep(10000);
    try {
      const raw = await queryVideoRaw(taskId);
      const d = raw.data || {};
      console.log(`  [${i}] raw.data.status="${d.status}" video_url="${d.video_url || '(空)'}" code=${raw.code}`);
      if (raw.code !== 10000) {
        console.error('  API error:', raw.message);
        break;
      }
      if (d.status === 'success' || d.status === 'succeed' || d.status === 'done') {
        console.log('\n🎉 视频生成成功！URL:', d.video_url);
        process.exit(0);
      }
      if (d.status === 'failed' || d.status === 'failure') {
        console.error('\n❌ 视频生成失败');
        process.exit(1);
      }
    } catch (e) {
      console.error(`  [${i}] 查询报错:`, e.message);
    }
  }
  console.log('\n⚠️ 超时（5分钟），任务仍未完成');
}

main();
