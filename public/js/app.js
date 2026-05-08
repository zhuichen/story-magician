/* global __INIT__ */

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  let sessionId = null;
  let round = 0;
  let busy = false;
  let ageGroup = '4-5';
  let ttsEnabled = true;
  let isRecording = false;
  let recognition = null;
  let isCallMode = false;
  let callRecognition = null;
  let silenceTimer = null;
  let isSpeaking = false;

  // ── DOM refs ────────────────────────────────────────────────────────────────
  const chatMessages = document.getElementById('chatMessages');
  const userInput    = document.getElementById('userInput');
  const sendBtn      = document.getElementById('sendBtn');
  const micBtn       = document.getElementById('micBtn');
  const ttsBtn       = document.getElementById('ttsBtn');
  const bookBtn      = document.getElementById('bookBtn');
  const reportBtn    = document.getElementById('reportBtn');
  const resetBtn     = document.getElementById('resetBtn');
  const gallery      = document.getElementById('gallery');
  const loadingToast = document.getElementById('loadingToast');
  const loadingText  = document.getElementById('loadingText');
  const bookModal    = document.getElementById('bookModal');
  const bookTitle    = document.getElementById('bookTitle');
  const bookPages    = document.getElementById('bookPages');
  const bookClosing  = document.getElementById('bookClosing');
  const modalClose   = document.getElementById('modalClose');

  const reportModal       = document.getElementById('reportModal');
  const reportModalClose  = document.getElementById('reportModalClose');
  const reportHighlights  = document.getElementById('reportHighlights');
  const reportOverall     = document.getElementById('reportOverall');
  const reportEncouragement = document.getElementById('reportEncouragement');

  const historyBtn          = document.getElementById('historyBtn');
  const historyCount        = document.getElementById('historyCount');
  const historyOverlay      = document.getElementById('historyOverlay');
  const historyClose        = document.getElementById('historyClose');
  const historyList         = document.getElementById('historyList');
  const historyViewModal    = document.getElementById('historyViewModal');
  const historyViewTitle    = document.getElementById('historyViewTitle');
  const historyViewMessages = document.getElementById('historyViewMessages');
  const historyViewClose    = document.getElementById('historyViewClose');

  const ageModal  = document.getElementById('ageModal');
  const ageBadge  = document.getElementById('ageBadge');

  const callBtn       = document.getElementById('callBtn');
  const callOverlay   = document.getElementById('callOverlay');
  const callStatus    = document.getElementById('callStatus');
  const callWaveform  = document.getElementById('callWaveform');
  const hangUpBtn     = document.getElementById('hangUpBtn');

  // ── Phase progress bar ────────────────────────────────────────────────────
  function updatePhaseBar(phase) {
    for (let i = 1; i <= 4; i++) {
      const step = document.getElementById(`phaseStep${i}`);
      if (!step) continue;
      step.classList.toggle('active', i === phase);
      step.classList.toggle('done', i < phase);
    }
  }

  // ── Voice: TTS ────────────────────────────────────────────────────────────
  async function speakText(html) {
    if (!ttsEnabled) return;

    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const text = (tmp.textContent || tmp.innerText || '').trim();
    if (!text) return;

    // 优先使用火山引擎 TTS（儿童声音）
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (res.ok) {
        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play();
        audio.onended = () => URL.revokeObjectURL(audioUrl);
        return;
      }
    } catch (e) {
      console.warn('火山 TTS 失败，降级到浏览器 TTS:', e);
    }

    // 降级：使用浏览器自带 TTS
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'zh-CN';
      utter.rate = 0.95;
      utter.pitch = 1.3;
      utter.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v =>
        v.lang.startsWith('zh') && (
          v.name.includes('Tingting') ||
          v.name.includes('Xiaoxiao') ||
          v.name.includes('Female') ||
          v.name.includes('女')
        )
      );
      if (preferredVoice) utter.voice = preferredVoice;

      window.speechSynthesis.speak(utter);
    }
  }

  function toggleTTS() {
    ttsEnabled = !ttsEnabled;
    ttsBtn.textContent = ttsEnabled ? '🔊 语音' : '🔇 语音';
    ttsBtn.title = ttsEnabled ? '关闭语音播报' : '开启语音播报';
    ttsBtn.classList.toggle('tts-off', !ttsEnabled);
    if (!ttsEnabled) window.speechSynthesis.cancel();
  }

  // ── Voice: STT ────────────────────────────────────────────────────────────
  function initSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { micBtn.style.display = 'none'; return; }
    recognition = new SR();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => {
      userInput.value = e.results[0][0].transcript;
      stopRecording();
      userInput.focus();
    };
    recognition.onerror = () => stopRecording();
    recognition.onend = () => stopRecording();
  }

  function startRecording() {
    if (!recognition || isRecording || busy) return;
    isRecording = true;
    micBtn.classList.add('recording');
    micBtn.textContent = '⏹';
    try { recognition.start(); } catch (e) { stopRecording(); }
  }

  function stopRecording() {
    if (!isRecording) return;
    isRecording = false;
    micBtn.classList.remove('recording');
    micBtn.textContent = '🎤';
    try { recognition.stop(); } catch (e) { /* already stopped */ }
  }

  // ── Call Mode: Continuous Voice Conversation ──────────────────────────────
  function startCallMode() {
    if (isCallMode || !sessionId) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('您的浏览器不支持语音识别功能');
      return;
    }

    isCallMode = true;
    callOverlay.classList.remove('hidden');
    callStatus.textContent = '请开始说话...';

    // 初始化持续语音识别
    callRecognition = new SR();
    callRecognition.lang = 'zh-CN';
    callRecognition.continuous = true;
    callRecognition.interimResults = true;
    callRecognition.maxAlternatives = 1;

    let finalTranscript = '';
    let interimTranscript = '';

    callRecognition.onstart = () => {
      callStatus.textContent = '正在聆听...';
      startWaveformAnimation();
    };

    callRecognition.onresult = (e) => {
      interimTranscript = '';

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // 显示实时识别结果
      const displayText = finalTranscript + interimTranscript;
      if (displayText.trim()) {
        callStatus.textContent = `"${displayText}"`;
        isSpeaking = true;

        // 重置静默计时器
        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          if (finalTranscript.trim()) {
            sendCallMessage(finalTranscript.trim());
            finalTranscript = '';
            interimTranscript = '';
          }
        }, 1500); // 1.5秒静默后自动发送
      }
    };

    callRecognition.onerror = (e) => {
      console.error('语音识别错误:', e.error);
      if (e.error === 'no-speech') {
        callStatus.textContent = '没有听到声音，请说话...';
      } else if (e.error === 'network') {
        callStatus.textContent = '网络错误，请检查连接';
      }
    };

    callRecognition.onend = () => {
      if (isCallMode) {
        // 自动重启识别以保持持续监听
        try {
          callRecognition.start();
        } catch (e) {
          console.error('重启识别失败:', e);
        }
      }
    };

    try {
      callRecognition.start();
    } catch (e) {
      console.error('启动识别失败:', e);
      stopCallMode();
    }
  }

  function stopCallMode() {
    if (!isCallMode) return;

    isCallMode = false;
    isSpeaking = false;
    clearTimeout(silenceTimer);

    if (callRecognition) {
      try {
        callRecognition.stop();
      } catch (e) {
        console.error('停止识别失败:', e);
      }
      callRecognition = null;
    }

    stopWaveformAnimation();
    callOverlay.classList.add('hidden');
  }

  async function sendCallMessage(text) {
    if (!text || busy || !sessionId) return;

    callStatus.textContent = '魔法师正在回答...';
    stopWaveformAnimation();

    appendUserMsg(text);
    setBusy(true);

    try {
      const data = await apiFetch('/api/chat', 'POST', { sessionId, input: text });
      round = data.round || round + 1;

      if (data.phase) updatePhaseBar(data.phase);

      const sanitizeNote = data.sanitized
        ? '<div class="msg-sanitized">✨ 魔法师把故事变得更美好了</div>'
        : '';

      const isEmotion = data.action === 'ask_emotion';
      appendAssistantMsg(data.reply + sanitizeNote, isEmotion ? 'msg-emotion' : '');

      if (round >= 5) bookBtn.classList.remove('hidden');
      if (round >= 3) reportBtn.classList.remove('hidden');

      if (data.action === 'generate_image' && data.imagePrompt) {
        await handleImageGeneration(data.imagePrompt, data.scene || text);
      } else if (data.action === 'generate_video' && data.videoPrompt) {
        await handleVideoGeneration(data.videoPrompt, data.scene || text);
      } else if (data.action === 'finalize_book') {
        bookBtn.classList.remove('hidden');
      }

      // 等待 TTS 播放完成后再继续监听
      callStatus.textContent = '请继续说话...';
      startWaveformAnimation();
    } catch (e) {
      appendError(e.message || '出了点小问题，请再试一次！');
      callStatus.textContent = '出错了，请重试...';
    } finally {
      setBusy(false);
    }
  }

  function startWaveformAnimation() {
    if (callWaveform) {
      callWaveform.classList.add('active');
    }
  }

  function stopWaveformAnimation() {
    if (callWaveform) {
      callWaveform.classList.remove('active');
    }
  }

  // ── Age selection ─────────────────────────────────────────────────────────
  function showAgeModal() {
    ageModal.classList.remove('hidden');
  }

  function hideAgeModal() {
    ageModal.classList.add('hidden');
  }

  function setAgeBadge(group) {
    ageBadge.textContent = `${group}岁`;
    ageBadge.classList.remove('hidden');
  }

  // ── Init session ──────────────────────────────────────────────────────────
  async function initSession() {
    try {
      const res = await apiFetch('/api/session', 'POST', { ageGroup });
      sessionId = res.sessionId;
      const opening = res.opening || (window.__INIT__ || {}).opening || '你好！我是故事魔法师 ✨';
      appendAssistantMsg(opening);
      setAgeBadge(ageGroup);
    } catch (e) {
      appendError('无法连接服务器，请刷新页面');
    }
  }

  // ── Send message ──────────────────────────────────────────────────────────
  async function sendMessage() {
    const text = userInput.value.trim();
    if (!text || busy || !sessionId) return;

    appendUserMsg(text);
    userInput.value = '';
    setBusy(true);

    try {
      const data = await apiFetch('/api/chat', 'POST', { sessionId, input: text });
      round = data.round || round + 1;

      // Update phase bar
      if (data.phase) updatePhaseBar(data.phase);

      // Show sanitize notice if content was replaced
      const sanitizeNote = data.sanitized
        ? '<div class="msg-sanitized">✨ 魔法师把故事变得更美好了</div>'
        : '';

      const isEmotion = data.action === 'ask_emotion';
      appendAssistantMsg(data.reply + sanitizeNote, isEmotion ? 'msg-emotion' : '');

      // Show book + report buttons at appropriate rounds
      if (round >= 5) bookBtn.classList.remove('hidden');
      if (round >= 3) reportBtn.classList.remove('hidden');

      // Handle action
      if (data.action === 'generate_image' && data.imagePrompt) {
        await handleImageGeneration(data.imagePrompt, data.scene || text);
      } else if (data.action === 'generate_video' && data.videoPrompt) {
        await handleVideoGeneration(data.videoPrompt, data.scene || text);
      } else if (data.action === 'finalize_book') {
        bookBtn.classList.remove('hidden');
      }
    } catch (e) {
      appendError(e.message || '出了点小问题，请再试一次！');
    } finally {
      setBusy(false);
    }
  }

  // ── Image generation ──────────────────────────────────────────────────────
  async function handleImageGeneration(prompt, caption) {
    const { loadingCard, galleryCard } = addGalleryLoading('🎨 正在画画…');
    const chatMediaEl = addChatMediaLoading();

    try {
      const data = await apiFetch('/api/image', 'POST', { sessionId, prompt });

      if (data.mode === 'sync' && data.imageUrl) {
        showImage(data.imageUrl, caption, galleryCard, chatMediaEl);
      } else if (data.mode === 'async' && data.taskId) {
        await pollTask('/api/image/', data.taskId, (result) => {
          if (result.imageUrl) {
            showImage(result.imageUrl, caption, galleryCard, chatMediaEl);
            return true;
          }
          return false;
        }, 3000, 40);
      }
    } catch (e) {
      galleryCard.innerHTML = `<div style="padding:12px;font-size:.8rem;color:#c62828;">图片生成失败: ${e.message}</div>`;
      chatMediaEl.innerHTML = `<span style="color:#c62828;font-size:.8rem;">图片生成失败</span>`;
    } finally {
      loadingCard.remove();
    }
  }

  function showImage(url, caption, galleryCard, chatMediaEl) {
    galleryCard.innerHTML = `
      <img src="${escHtml(url)}" alt="${escHtml(caption)}" loading="lazy" />
      <div class="gallery-card-caption">${escHtml(caption)}</div>
    `;
    chatMediaEl.innerHTML = `<img src="${escHtml(url)}" alt="${escHtml(caption)}" loading="lazy" />`;
    hideGalleryEmpty();
  }

  // ── Video generation ──────────────────────────────────────────────────────
  async function handleVideoGeneration(prompt, caption) {
    const { loadingCard, galleryCard } = addGalleryLoading('🎬 正在制作动画…');
    const chatMediaEl = addChatMediaLoading('🎬 动画制作中，稍等一下下哦～');

    try {
      const data = await apiFetch('/api/video', 'POST', { sessionId: sessionId, prompt });

      if (data.taskId) {
        await pollTask(
          `/api/video/`,
          data.taskId,
          (result) => {
            if (result.status === 'done' && result.videoUrl) {
              showVideo(result.videoUrl, caption, galleryCard, chatMediaEl);
              return true;
            }
            if (result.status === 'failed') {
              throw new Error('视频生成失败');
            }
            return false;
          },
          5000,
          120,
          { sessionId },
        );
      }
    } catch (e) {
      galleryCard.innerHTML = `<div style="padding:12px;font-size:.8rem;color:#c62828;">视频生成失败: ${e.message}</div>`;
      chatMediaEl.innerHTML = `<span style="color:#c62828;font-size:.8rem;">视频生成失败</span>`;
    } finally {
      loadingCard.remove();
    }
  }

  function showVideo(url, caption, galleryCard, chatMediaEl) {
    galleryCard.innerHTML = `
      <video src="${escHtml(url)}" controls autoplay muted loop playsinline></video>
      <div class="gallery-card-caption">${escHtml(caption)}</div>
    `;
    chatMediaEl.innerHTML = `<video src="${escHtml(url)}" controls muted loop playsinline style="max-width:240px;border-radius:12px;"></video>`;
    hideGalleryEmpty();
  }

  // ── Make book ─────────────────────────────────────────────────────────────
  async function makeBook() {
    if (busy) return;
    setBusy(true);
    showToast('✨ 正在整理你的魔法小书…');

    try {
      const data = await apiFetch('/api/book', 'POST', { sessionId });
      renderBook(data.book);
      bookModal.classList.remove('hidden');
    } catch (e) {
      appendError('成书失败，请再试一次：' + e.message);
    } finally {
      setBusy(false);
      hideToast();
    }
  }

  function renderBook(book) {
    bookTitle.textContent = `✨ ${book.title || '我的魔法小书'}`;
    bookPages.innerHTML = '';

    (book.pages || []).forEach((page, i) => {
      const div = document.createElement('div');
      div.className = 'book-page';

      let mediaHtml = '';
      if (page.imageUrl) {
        mediaHtml = `<img class="book-page-img" src="${escHtml(page.imageUrl)}" alt="第${i+1}页插图" />`;
      } else if (page.videoUrl) {
        mediaHtml = `<video class="book-page-img" src="${escHtml(page.videoUrl)}" controls muted loop playsinline></video>`;
      } else {
        mediaHtml = `
          <div class="book-page-img-placeholder">
            <span>🎨</span>
            <small>${escHtml(page.imagePrompt || '').slice(0, 40)}</small>
          </div>`;
      }

      div.innerHTML = `
        ${mediaHtml}
        <div class="book-page-text">${escHtml(page.text || '')}</div>
        <div class="book-page-num">第 ${i + 1} 页</div>
      `;
      bookPages.appendChild(div);
    });

    bookClosing.textContent = book.closing || '';
  }

  // ── Thinking report ───────────────────────────────────────────────────────
  async function makeReport() {
    if (busy) return;
    setBusy(true);
    showToast('🌟 正在生成能力报告…');

    try {
      const data = await apiFetch('/api/report', 'POST', { sessionId });
      renderReport(data.report);
      reportModal.classList.remove('hidden');
    } catch (e) {
      appendError('报告生成失败：' + e.message);
    } finally {
      setBusy(false);
      hideToast();
    }
  }

  function renderReport(report) {
    const stars = (n) => '⭐'.repeat(Math.min(5, Math.max(1, n || 3)));

    reportHighlights.innerHTML = '';
    (report.highlights || []).forEach((h) => {
      const card = document.createElement('div');
      card.className = 'report-card';
      card.innerHTML = `
        <div class="report-card-header">
          <span class="report-card-icon">${escHtml(h.icon || '✨')}</span>
          <span class="report-card-dimension">${escHtml(h.dimension || '')}</span>
          <span class="report-card-stars">${stars(h.star)}</span>
        </div>
        <div class="report-card-desc">${escHtml(h.description || '')}</div>
      `;
      reportHighlights.appendChild(card);
    });

    reportOverall.textContent = report.overallComment || '';
    reportEncouragement.textContent = report.encouragement
      ? `💬 ${report.encouragement}`
      : '';
  }

  // ── History ───────────────────────────────────────────────────────────────
  async function loadHistoryList() {
    try {
      const list = await apiFetch('/api/histories', 'GET', null);
      historyCount.textContent = list.length ? String(list.length) : '';
      if (!list.length) {
        historyList.innerHTML = '<div class="history-empty">暂无历史故事</div>';
        return;
      }
      historyList.innerHTML = '';
      list.forEach(item => {
        const el = document.createElement('div');
        el.className = 'history-item';
        el.innerHTML = `
          <div class="history-item-body">
            <div class="history-item-title">${escHtml(item.title)}</div>
            <div class="history-item-meta">${item.messageCount}轮对话 · ${timeAgo(item.updatedAt)}</div>
          </div>
          <div class="history-item-actions">
            <button class="btn-history-view" data-id="${escHtml(item.id)}">查看</button>
            <button class="btn-history-resume" data-id="${escHtml(item.id)}">继续对话</button>
          </div>
        `;
        el.querySelector('.btn-history-view').addEventListener('click', (e) => {
          e.stopPropagation();
          viewHistory(item.id);
        });
        el.querySelector('.btn-history-resume').addEventListener('click', (e) => {
          e.stopPropagation();
          resumeHistory(item.id);
        });
        historyList.appendChild(el);
      });
    } catch {
      historyList.innerHTML = '<div class="history-empty">加载失败，请重试</div>';
    }
  }

  async function viewHistory(id) {
    try {
      const data = await apiFetch(`/api/histories/${encodeURIComponent(id)}`, 'GET', null);
      historyViewTitle.textContent = data.title || '故事回顾';
      historyViewMessages.innerHTML = '';
      (data.history || []).forEach(msg => {
        const isUser = msg.role === 'user';
        const el = document.createElement('div');
        el.className = `history-msg ${isUser ? 'history-msg-user' : 'history-msg-assistant'}`;
        el.innerHTML = `
          <div class="msg-avatar">${isUser ? '🧒' : '🧙'}</div>
          <div class="history-msg-bubble">${escHtml(msg.content)}</div>
        `;
        historyViewMessages.appendChild(el);
      });

      // Add resume button inside the view modal
      const resumeBtn = document.createElement('button');
      resumeBtn.className = 'btn-history-resume-modal';
      resumeBtn.textContent = '▶ 继续这个故事';
      resumeBtn.addEventListener('click', () => {
        historyViewModal.classList.add('hidden');
        resumeHistory(id);
      });
      historyViewMessages.appendChild(resumeBtn);

      historyViewModal.classList.remove('hidden');
    } catch (e) {
      appendError('加载历史失败：' + e.message);
    }
  }

  async function resumeHistory(id) {
    try {
      showToast('故事魔法恢复中…');
      const data = await apiFetch(`/api/histories/${encodeURIComponent(id)}/resume`, 'POST', null);

      // Close drawers
      historyOverlay.classList.add('hidden');
      historyViewModal.classList.add('hidden');

      // Reset UI state
      round = 0;
      busy = false;
      window.speechSynthesis && window.speechSynthesis.cancel();
      if (isRecording) stopRecording();
      bookBtn.classList.add('hidden');
      reportBtn.classList.add('hidden');
      chatMessages.innerHTML = '';
      gallery.innerHTML = `
        <div class="gallery-empty">
          <p>🌈 故事越精彩</p>
          <p>画面越美丽！</p>
        </div>`;

      // Apply resumed session state
      sessionId = data.sessionId;
      ageGroup = data.ageGroup || '4-5';
      const resumedPhase = data.phase || 1;
      updatePhaseBar(resumedPhase);
      setAgeBadge(ageGroup);
      hideAgeModal();

      // Render history messages into main chat (TTS silent)
      const savedTts = ttsEnabled;
      ttsEnabled = false;
      (data.history || []).forEach(msg => {
        if (msg.role === 'user') {
          appendUserMsg(msg.content);
        } else {
          appendAssistantMsg(escHtml(msg.content));
        }
      });
      ttsEnabled = savedTts;

      // Render existing scene images into gallery
      (data.scenes || []).forEach(scene => {
        if (scene.imageUrl) {
          hideGalleryEmpty();
          const card = document.createElement('div');
          card.className = 'gallery-card';
          card.innerHTML = `<img src="${escHtml(scene.imageUrl)}" alt="${escHtml(scene.text || '')}" />`;
          gallery.appendChild(card);
        }
      });

      // Show action buttons based on round count
      round = Math.floor((data.history || []).length / 2);
      if (round >= 5) bookBtn.classList.remove('hidden');
      if (round >= 3) reportBtn.classList.remove('hidden');

      // Continuation prompt in chat
      appendAssistantMsg('✨ 故事恢复啦！我们继续冒险吧～有什么想说的？');
      userInput.disabled = false;
      sendBtn.disabled = false;
      userInput.focus();
      hideToast();
    } catch (e) {
      hideToast();
      appendError('恢复历史失败：' + e.message);
    }
  }

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return `${min}分钟前`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}小时前`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day}天前`;
    return new Date(ts).toLocaleDateString('zh-CN');
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  function reset() {
    round = 0;
    busy = false;
    sessionId = null;
    if (isRecording) stopRecording();
    window.speechSynthesis && window.speechSynthesis.cancel();
    userInput.disabled = false;
    sendBtn.disabled = false;
    bookBtn.classList.add('hidden');
    reportBtn.classList.add('hidden');
    chatMessages.innerHTML = '';
    gallery.innerHTML = `
      <div class="gallery-empty">
        <p>🌈 故事越精彩</p>
        <p>画面越美丽！</p>
      </div>`;
    updatePhaseBar(1);
    hideToast();
    ageBadge.classList.add('hidden');
    showAgeModal();
  }

  // ── Helpers: DOM ──────────────────────────────────────────────────────────
  function appendAssistantMsg(htmlContent, extraClass = '') {
    const div = document.createElement('div');
    div.className = `msg msg-assistant ${extraClass}`.trim();
    div.innerHTML = `
      <div class="msg-avatar">🧙</div>
      <div>
        <div class="msg-bubble">${htmlContent}</div>
      </div>`;
    chatMessages.appendChild(div);
    scrollBottom();
    speakText(htmlContent);
    return div;
  }

  function appendUserMsg(text) {
    const div = document.createElement('div');
    div.className = 'msg msg-user';
    div.innerHTML = `
      <div class="msg-avatar">🧒</div>
      <div class="msg-bubble">${escHtml(text)}</div>`;
    chatMessages.appendChild(div);
    scrollBottom();
  }

  function appendError(msg) {
    const div = document.createElement('div');
    div.className = 'msg msg-assistant';
    div.innerHTML = `
      <div class="msg-avatar">🧙</div>
      <div class="msg-bubble" style="background:#ffebee;color:#c62828;">⚠️ ${escHtml(msg)}</div>`;
    chatMessages.appendChild(div);
    scrollBottom();
  }

  function addChatMediaLoading(text = '🎨 图画施法中，马上就好哦～') {
    const lastMsg = chatMessages.querySelector('.msg-assistant:last-child .msg-bubble');
    if (!lastMsg) return document.createElement('div');
    const wrap = document.createElement('div');
    wrap.className = 'msg-media media-loading';
    wrap.innerHTML = `<span class="loading-spinner"></span><span>${escHtml(text)}</span>`;
    lastMsg.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  function addGalleryLoading(text) {
    const loadingCard = document.createElement('div');
    loadingCard.className = 'gallery-loading';
    loadingCard.innerHTML = `<span class="loading-spinner"></span><span>${escHtml(text)}</span>`;
    gallery.appendChild(loadingCard);

    const galleryCard = document.createElement('div');
    galleryCard.className = 'gallery-card';
    gallery.appendChild(galleryCard);

    hideGalleryEmpty();
    return { loadingCard, galleryCard };
  }

  function hideGalleryEmpty() {
    const empty = gallery.querySelector('.gallery-empty');
    if (empty) empty.remove();
  }

  function scrollBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function setBusy(val) {
    busy = val;
    userInput.disabled = val;
    sendBtn.disabled = val;
    micBtn.disabled = val;
    if (val) {
      if (isRecording) stopRecording();
      showToast('魔法师正在思考…');
    } else {
      hideToast();
      userInput.focus();
    }
  }

  function showToast(text) {
    loadingText.textContent = text;
    loadingToast.classList.remove('hidden');
  }

  function hideToast() {
    loadingToast.classList.add('hidden');
  }

  // ── Helpers: API ──────────────────────────────────────────────────────────
  async function apiFetch(path, method, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (method !== 'GET' && body !== null) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  }

  /**
   * Poll a task endpoint until done or maxTries reached.
   * @param {string} basePath  e.g. '/api/image/'
   * @param {string} taskId
   * @param {Function} onResult  return true to stop
   * @param {number} intervalMs
   * @param {number} maxTries
   * @param {object} extraQuery  additional query params
   */
  function pollTask(basePath, taskId, onResult, intervalMs, maxTries, extraQuery = {}) {
    return new Promise((resolve, reject) => {
      let tries = 0;
      const qp = new URLSearchParams(extraQuery).toString();
      const url = `${basePath}${encodeURIComponent(taskId)}${qp ? '?' + qp : ''}`;

      const timer = setInterval(async () => {
        tries++;
        try {
          const data = await apiFetch(url, 'GET', null);
          let done = false;
          try { done = onResult(data); } catch (e) { clearInterval(timer); reject(e); return; }
          if (done) { clearInterval(timer); resolve(); }
          else if (tries >= maxTries) {
            clearInterval(timer);
            reject(new Error('任务超时，请稍后刷新重试'));
          }
        } catch (e) {
          clearInterval(timer);
          reject(e);
        }
      }, intervalMs);
    });
  }

  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Event listeners ───────────────────────────────────────────────────────
  sendBtn.addEventListener('click', sendMessage);

  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  micBtn.addEventListener('click', () => {
    if (isRecording) stopRecording();
    else startRecording();
  });

  ttsBtn.addEventListener('click', toggleTTS);

  bookBtn.addEventListener('click', makeBook);
  reportBtn.addEventListener('click', makeReport);
  resetBtn.addEventListener('click', reset);

  // Age selection: pick group → hide modal → start session
  document.querySelectorAll('.age-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      ageGroup = btn.dataset.age || '4-5';
      hideAgeModal();
      userInput.focus();
      loadHistoryList();
      await initSession();
    });
  });

  modalClose.addEventListener('click', () => bookModal.classList.add('hidden'));
  bookModal.addEventListener('click', (e) => {
    if (e.target === bookModal) bookModal.classList.add('hidden');
  });

  reportModalClose.addEventListener('click', () => reportModal.classList.add('hidden'));
  reportModal.addEventListener('click', (e) => {
    if (e.target === reportModal) reportModal.classList.add('hidden');
  });

  historyBtn.addEventListener('click', async () => {
    await loadHistoryList();
    historyOverlay.classList.remove('hidden');
  });
  historyClose.addEventListener('click', () => historyOverlay.classList.add('hidden'));
  historyOverlay.addEventListener('click', (e) => {
    if (e.target === historyOverlay) historyOverlay.classList.add('hidden');
  });
  historyViewClose.addEventListener('click', () => historyViewModal.classList.add('hidden'));
  historyViewModal.addEventListener('click', (e) => {
    if (e.target === historyViewModal) historyViewModal.classList.add('hidden');
  });

  callBtn.addEventListener('click', startCallMode);
  hangUpBtn.addEventListener('click', stopCallMode);

  // ── Boot ──────────────────────────────────────────────────────────────────
  updatePhaseBar(1);
  initSpeechRecognition();
  showAgeModal();
})();
