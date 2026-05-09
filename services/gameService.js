// 故事中穿插的迷你 HTML5 小游戏生成器
// 给定一个剧情场景和年龄段，调用 AI 生成一份完整自包含的 HTML 文档（内联 CSS/JS），
// 由前端用 iframe srcdoc + sandbox 注入。游戏通关时会向父窗口 postMessage。

const aiService = require("./aiService");

const AGE_RULES = {
  "3-4": '允许"点击"或"拖拽到目标区域"。目标 3 个，元素超大（120px+）。10-15 秒能通关。拖拽要有醒目的"放这里"虚线提示框。',
  "4-5":
    '允许"点击""按顺序点击""拖拽到目标区域""叠加堆放"。目标 3-4 个，元素 100px 左右。15-25 秒能通关。',
  "5-6": '允许"点击""按顺序点击""拖拽""叠加""简单配对"。目标 4-5 个。20-30 秒通关。',
};

const gameSystem = `你是"故事魔法师"的小游戏制作师。给定一个故事场景和孩子年龄段，**生成一份简单、能秒玩通关的迷你互动小游戏 HTML**。

【🚨 最高优先级：游戏必须扣住故事场景，绝对不允许偏题】
- 游戏的**主角 emoji**、**目标 emoji**、**任务文案**、**背景色调**都必须**直接来自传入的故事场景**。
- 例：场景"小狗狗掉湖里出不来" → 主角必须是 🐶，目标可以是 ⭐💡🪼 等"会指路/能救援"的元素，背景必须是水/湖（蓝色渐变），任务文案必须含"小狗狗"和"湖/岸"等词。
- **严禁**生成与剧情完全无关的游戏（比如剧情是救小狗，却让孩子点蛋糕、捉蝴蝶——这是错的，会被立即拒绝）。
- 顶部任务文案里**至少要出现故事中已经被提到的角色名或物体名**（小狗狗、小兔兔、湖、桥、星星…）。
- 如果场景里已经给出明确的玩法提示（如"按顺序点亮 4 朵水母给小狗指路"），**严格按这个玩法实现**，不要换成别的。
- 如果给出了"近期对话上下文"，请从中识别主角名字、当前位置、要解决的麻烦，并把这些元素都揉进游戏画面里。

【目标：又快又简单】
- 游戏整体代码量越少越好。**目标 HTML 在 1500 字以内**，越精简越好。
- **玩法必须由 gameScenario 里的动词决定**——动词是什么，玩法就是什么，不要用"点击"敷衍所有场景：
  - **"叠 / 堆 / 搭 / 垒"** → 必须是**拖拽到目标区域**，让物体一块块叠高（先放的在底，后放的在顶，画面有"叠加成长"的视觉反馈）
  - **"放 / 装 / 送 / 投 / 喂"** → 必须是**拖拽到一个目标容器/角色**（如把石头拖到湖里、把鱼拖到小猫嘴边）
  - **"点亮 / 按顺序点 / 戳"** → 才是按顺序点击
  - **"找 / 抓"** → 点击全部
- 如果玩法是拖拽：**必须有一个虚线/亮色的"放这里 ⬇️"目标框/位置**，孩子能一眼看到要放哪里。物体要用 pointer / touch 事件实现拖动（不要只用 HTML5 draggable 属性，移动端不友好）。
- 通关时间预算：**10-30 秒**。元素数量 **3-5 个**。
- **没有标题界面、没有开始按钮**——打开就直接进入游戏，最上方一行任务文字。
- **游戏结束时**除了显示"🎉 你成功啦！"庆祝层，还**必须显示一行下方提示**："小朋友厉害！点这里继续故事 →"，并提供一个 ≥ 80px 的"继续"按钮，按钮 click/touch 时也调用 postMessage 通关回调（即使前面已经调过也无妨——前端只在第一次接收）。这样孩子能明确"我做完啦"。

【铁律】
1. 输出**只能是一份完整的 HTML 文档**（从 <!DOCTYPE html> 开始到 </html> 结束），**不要任何前后缀、不要 Markdown 围栏、不要解释**。
2. 所有 CSS 和 JS 必须**内联**。**严禁** <script src=...> / <link rel=...> / @import / fetch() / XMLHttpRequest / WebSocket / import / require / new Worker。**严禁** localStorage / sessionStorage / cookie / indexedDB / window.open / location 跳转。
3. **严禁**任何外部资源。所有视觉用 emoji、纯色、CSS 渐变、SVG 内联。
4. 画面铺满 iframe（100vw / 100vh，无横向滚动条）。
5. **必须有一行任务说明**（顶部，≤16 字，必须包含故事角色名/物体名）。
6. **通关条件清晰**：达成目标的瞬间立即调用 \`window.parent.postMessage({ type: 'sm-game', event: 'win' }, '*');\`，并显示一个庆祝层（"🎉 你成功啦！"）。
7. **没有失败分支**——孩子怎么操作都不会输。最多让目标"弹回原位"。**不要计时器、不要倒计时、不要扣分**。
8. **不要外部音效**。可以用 1-2 行 Web Audio 合成"叮"声做点击反馈（可选，不做也可以）。
9. 文字 ≥ 22px，可点目标 ≥ 80x80。全程中文。

【骨架 A：点击型（gameScenario 含"点亮 / 按顺序点 / 戳 / 找"等动词时用）】
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0;user-select:none;-webkit-tap-highlight-color:transparent}
html,body{width:100%;height:100%;overflow:hidden;font-family:"PingFang SC","Microsoft YaHei",sans-serif}
body{background:linear-gradient(180deg,#BEE7FF,#FFE9F2);display:flex;flex-direction:column;align-items:center;padding:20px 16px}
.task{font-size:22px;font-weight:800;color:#3D2C5C;margin-bottom:14px;text-align:center}
.stage{flex:1;width:100%;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:18px}
.it{font-size:80px;cursor:pointer;transition:transform .2s}
.it:active{transform:scale(.85)}
.it.done{animation:pop .4s ease forwards}
@keyframes pop{50%{transform:scale(1.4)}100%{transform:scale(0);opacity:0}}
.win{position:fixed;inset:0;background:rgba(255,255,255,.94);display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#FF6FA8;font-weight:900;text-align:center;padding:20px}
.win.s{display:flex}
.win .em{font-size:64px}.win .t{font-size:30px}.win .h{font-size:18px;color:#7A6B96;font-weight:700}
.go{margin-top:6px;padding:14px 28px;font-size:20px;font-weight:800;background:#FF6FA8;color:#fff;border:0;border-radius:999px;cursor:pointer;box-shadow:0 4px 0 #C95A8C}
</style></head><body>
<div class="task">点亮 4 颗星星 ⭐</div>
<div class="stage" id="s"></div>
<div class="win" id="w"><div class="em">🎉</div><div class="t">你成功啦！</div><div class="h">小朋友厉害！</div><button class="go" id="go">继续故事 →</button></div>
<script>
const TARGETS=['⭐','⭐','⭐','⭐'];let done=0,sent=0;
const fin=()=>{if(sent)return;sent=1;window.parent.postMessage({type:'sm-game',event:'win'},'*');};
const s=document.getElementById('s');
TARGETS.forEach(e=>{const d=document.createElement('div');d.className='it';d.textContent=e;
d.onclick=()=>{if(d.classList.contains('done'))return;d.classList.add('done');done++;
if(done===TARGETS.length){setTimeout(()=>{document.getElementById('w').classList.add('s');},350);}};s.appendChild(d);});
document.getElementById('go').onclick=fin;
</script></body></html>

【骨架 B：拖拽型（gameScenario 含"叠 / 堆 / 搭 / 垒 / 放 / 装 / 送 / 投 / 喂"等动词时用）】
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;touch-action:none}
html,body{width:100%;height:100%;overflow:hidden;font-family:"PingFang SC","Microsoft YaHei",sans-serif}
body{background:linear-gradient(180deg,#BEE7FF,#FFE9F2);display:flex;flex-direction:column;align-items:center;padding:18px 14px}
.task{font-size:22px;font-weight:800;color:#3D2C5C;margin-bottom:12px;text-align:center}
.scene{flex:1;width:100%;position:relative}
.zone{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);width:140px;min-height:60px;border:4px dashed #FF6FA8;border-radius:18px;display:flex;flex-direction:column-reverse;align-items:center;justify-content:flex-end;padding:6px 0;background:rgba(255,255,255,.55)}
.zone .hint{position:absolute;top:-30px;font-size:16px;font-weight:700;color:#FF6FA8;white-space:nowrap}
.zone .stack{font-size:60px;line-height:1;margin:-6px 0}
.cat{position:absolute;left:50%;bottom:200px;transform:translateX(-50%);font-size:80px}
.fish{position:absolute;left:50%;top:18px;transform:translateX(-50%);font-size:54px;animation:wig 1.4s ease-in-out infinite alternate}
@keyframes wig{to{transform:translateX(-50%) translateY(6px)}}
.bag{position:absolute;left:14px;bottom:14px;display:flex;flex-direction:column;gap:10px}
.it{font-size:64px;touch-action:none;cursor:grab}
.it.drag{cursor:grabbing;z-index:9}
.win{position:fixed;inset:0;background:rgba(255,255,255,.94);display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#FF6FA8;font-weight:900;text-align:center;padding:20px}
.win.s{display:flex}.win .em{font-size:64px}.win .t{font-size:30px}.win .h{font-size:18px;color:#7A6B96;font-weight:700}
.go{margin-top:6px;padding:14px 28px;font-size:20px;font-weight:800;background:#FF6FA8;color:#fff;border:0;border-radius:999px;cursor:pointer;box-shadow:0 4px 0 #C95A8C}
</style></head><body>
<div class="task">把 3 块石头叠到湖边，让小猫够小鱼 🐟</div>
<div class="scene" id="sc">
  <div class="fish">🐟</div>
  <div class="cat">🐱</div>
  <div class="zone" id="z"><div class="hint">叠这里 ⬇️</div></div>
  <div class="bag" id="bag"></div>
</div>
<div class="win" id="w"><div class="em">🎉</div><div class="t">你成功啦！</div><div class="h">小猫咪够到小鱼啦！</div><button class="go" id="go">继续故事 →</button></div>
<script>
const N=3;let placed=0,sent=0;
const fin=()=>{if(sent)return;sent=1;window.parent.postMessage({type:'sm-game',event:'win'},'*');};
const bag=document.getElementById('bag'),zone=document.getElementById('z');
for(let i=0;i<N;i++){const d=document.createElement('div');d.className='it';d.textContent='🪨';bag.appendChild(d);bind(d);}
function bind(el){let dx=0,dy=0,sx=0,sy=0;
const start=(x,y)=>{const r=el.getBoundingClientRect();sx=x;sy=y;dx=r.left;dy=r.top;el.classList.add('drag');el.style.position='fixed';el.style.left=dx+'px';el.style.top=dy+'px';};
const move=(x,y)=>{el.style.left=(dx+x-sx)+'px';el.style.top=(dy+y-sy)+'px';};
const end=()=>{const r=el.getBoundingClientRect(),z=zone.getBoundingClientRect();
if(r.left<z.right&&r.right>z.left&&r.top<z.bottom+30&&r.bottom>z.top){
  el.style.position='static';el.classList.remove('it','drag');
  const s=document.createElement('div');s.className='stack';s.textContent='🪨';zone.appendChild(s);
  el.remove();placed++;
  if(placed===N){setTimeout(()=>document.getElementById('w').classList.add('s'),400);}
}else{el.style.position='static';el.classList.remove('drag');}};
el.addEventListener('pointerdown',e=>{e.preventDefault();start(e.clientX,e.clientY);
const mv=ev=>move(ev.clientX,ev.clientY);
const up=ev=>{document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);end();};
document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up);});}
document.getElementById('go').onclick=fin;
</script></body></html>`;

function buildGameMessages(scenario, ageGroup = "4-5", context = "") {
  const ageHint = AGE_RULES[ageGroup] || AGE_RULES["4-5"];
  const ctxBlock =
    context && context.trim()
      ? `近期对话上下文（请从中提取主角与场景，把它们融进游戏画面）：\n${context.trim()}\n`
      : "";
  const userMsg = [
    `故事场景（玩法主线）：${scenario}`,
    `小朋友年龄段：${ageGroup} 岁`,
    `年龄交互规则：${ageHint}`,
    "",
    ctxBlock,
    "请基于以上**故事场景与对话上下文**，制作一份扣题的迷你互动小游戏。",
    "主角 emoji、目标 emoji、任务文案必须直接来自这段故事，不允许跑题。",
    "只输出完整 HTML 文档，不要任何额外文字或围栏。",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { role: "system", content: gameSystem },
    { role: "user", content: userMsg },
  ];
}

function extractHtmlDoc(text) {
  if (!text) return "";
  const s = String(text).trim();
  // 去除可能的 markdown 围栏
  const fenced = s.match(/```(?:html)?\s*([\s\S]*?)\s*```/i);
  const raw = fenced ? fenced[1] : s;
  const m = raw.match(/<!DOCTYPE[\s\S]*<\/html>/i);
  return (m ? m[0] : raw).trim();
}

function looksUnsafe(html) {
  const lower = html.toLowerCase();
  const banned = [
    "<script src=",
    "<link ",
    "@import",
    "fetch(",
    "xmlhttprequest",
    "websocket",
    "localstorage",
    "sessionstorage",
    "document.cookie",
    "indexeddb",
    "window.open",
    "location.href",
    "location.replace",
    "navigator.sendbeacon",
    "new worker",
    "importscripts",
  ];
  return banned.some((kw) => lower.includes(kw));
}

async function generateMiniGame(scenario, ageGroup = "4-5", context = "") {
  if (!scenario || !String(scenario).trim()) {
    throw new Error("缺少游戏剧情说明");
  }

  const messages = buildGameMessages(scenario, ageGroup, context);
  const raw = await aiService.chat(messages, {
    temperature: 0.5,
    maxTokens: 2400,
  });

  const html = extractHtmlDoc(raw);
  if (!html || !/<html[\s\S]*<\/html>/i.test(html)) {
    throw new Error("AI 未返回完整 HTML");
  }
  if (looksUnsafe(html)) {
    throw new Error("生成的游戏含不安全内容，已拒绝");
  }
  if (!/postMessage\s*\(/i.test(html)) {
    throw new Error("生成的游戏未包含通关回调");
  }

  return { html };
}

module.exports = { generateMiniGame };
