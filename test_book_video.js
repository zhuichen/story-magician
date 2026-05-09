// 临时探针：先生成一张图，再调用 createBookVideo 测试动画接口
require('dotenv').config();
const { createImage } = require('./services/imageService');
const { createBookVideo, queryBookVideo } = require('./services/videoService');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('▶ 第一步：生成一张测试图片...');
  let imgUrl;
  try {
    const r = await createImage('一只可爱的小兔子在草地上跳跃，蓝天白云');
    imgUrl = r.imageUrl;
    console.log('✅ 图片 URL:', imgUrl);
  } catch (e) {
    console.error('❌ 图片生成失败:', e.message, e.apiResponse || '');
    process.exit(1);
  }

  console.log('\n▶ 第二步：用单张图提交动画任务...');
  let taskId;
  try {
    const res = await createBookVideo([imgUrl], '小兔子在草地上欢快地蹦跳');
    taskId = res.taskId;
    console.log('✅ 提交成功, taskId:', taskId);
  } catch (e) {
    console.error('❌ 提交失败:', e.message, e.apiResponse || '');
    process.exit(1);
  }

  console.log('\n▶ 第三步：轮询（每 10 秒，最多 30 次 = 5 分钟）...');
  for (let i = 1; i <= 30; i++) {
    await sleep(10000);
    try {
      const r = await queryBookVideo(taskId);
      console.log(`  [${i}] status=${r.status} videoUrl=${r.videoUrl || '(空)'}`);
      if (r.status === 'done') {
        console.log('\n🎉 动画生成成功！URL:', r.videoUrl);
        process.exit(0);
      }
      if (r.status === 'failed') {
        console.error('\n❌ 动画生成失败');
        process.exit(1);
      }
    } catch (e) {
      console.error(`  [${i}] 查询报错:`, e.message, e.apiResponse || '');
    }
  }
  console.log('\n⚠️ 超时（5 分钟），任务仍未完成。taskId =', taskId);
}

main();
