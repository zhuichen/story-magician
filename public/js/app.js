/* global __INIT__ */

(function () {
  'use strict';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered:', registration.scope);
        })
        .catch((error) => {
          console.log('SW registration failed:', error);
        });
    });
  }

  // ── State ──────────────────────────────────────────────────────────────────
  let sessionId = null;
  let round = 0;
  let busy = false;
  let ageGroup = '4-5';
  let ttsEnabled = true;
  let isRecording = false;
  let recognition = null;
  let isCallMode = false;
  let silenceTimer = null;
  let callStream = null;
  let callProcessor = null;
  let callAudioCtx = null;
  let callAnalyser = null;
  let callState = 'idle';
  let callSilenceStart = 0;
  let callHasSpeech = false;
  let callAnimFrame = null;
  let callPcmChunks = [];
  let callInputSampleRate = 0;
  let callRecordStartTime = 0;
  let cachedBook = null;
  let bookVideoUrl = null;

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
  const callBar       = document.getElementById('callBar');
  const callStatus    = document.getElementById('callStatus');
  const callWaveform  = document.getElementById('callWaveform');
  const hangUpBtn     = document.getElementById('hangUpBtn');

  const incomingCall    = document.getElementById('incomingCall');
  const callAcceptBtn   = document.getElementById('callAcceptBtn');
  const callRejectBtn   = document.getElementById('callRejectBtn');

  // Mini-game modal refs
  const miniGameModal       = document.getElementById('miniGameModal');
  const miniGameClose       = document.getElementById('miniGameClose');
  const miniGameSubtitle    = document.getElementById('miniGameSubtitle');
  const miniGameLoading     = document.getElementById('miniGameLoading');
  const miniGameLoadingText = document.getElementById('miniGameLoadingText');
  const miniGameStage       = document.getElementById('miniGameStage');
  const miniGameWin         = document.getElementById('miniGameWin');

  // ── Incoming-call: synthesized ringtone ──────────────────────────────────
  let ringCtx = null;
  let ringTimer = null;
  let ringNodes = [];
  let ringStopFlag = false;

  function stopRingtone() {
    ringStopFlag = true;
    if (ringTimer) { clearTimeout(ringTimer); ringTimer = null; }
    ringNodes.forEach((n) => { try { n.stop(); } catch (_) {} try { n.disconnect(); } catch (_) {} });
    ringNodes = [];
    if (ringCtx) {
      ringCtx.close().catch(() => {});
      ringCtx = null;
    }
  }

  // 模拟微信"叮咚"双音电话铃，使用 Web Audio 合成，避免外链音频资源
  function playRingtone() {
    stopRingtone();
    ringStopFlag = false;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ringCtx = new Ctx();
    } catch (_) { return; }

    const tone = (freq, startAt, dur, peakGain = 0.18) => {
      if (!ringCtx) return;
      const osc = ringCtx.createOscillator();
      const gain = ringCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
      osc.connect(gain).connect(ringCtx.destination);
      osc.start(startAt);
      osc.stop(startAt + dur + 0.05);
      ringNodes.push(osc, gain);
    };

    // 一次铃声 = 高音 + 低音两次叮咚
    function ringOnce() {
      if (ringStopFlag || !ringCtx) return;
      const t0 = ringCtx.currentTime + 0.02;
      tone(988, t0,        0.32);            // B5 叮
      tone(659, t0 + 0.35, 0.45, 0.16);      // E5 咚
      tone(988, t0 + 0.95, 0.32);
      tone(659, t0 + 1.30, 0.45, 0.16);
      // 每 ~2.4s 重复一次，模拟真实电话铃
      ringTimer = setTimeout(() => {
        if (!ringStopFlag) ringOnce();
      }, 2400);
    }

    ringOnce();
  }

  // ── Incoming-call overlay control ────────────────────────────────────────
  let incomingCallOpen = false;
  let incomingShownThisSession = false;
  let incomingCallAutoTimer = null;

  function showIncomingCall() {
    if (incomingCallOpen || isCallMode) return;
    incomingCallOpen = true;
    incomingShownThisSession = true;
    incomingCall.classList.remove('hidden');
    incomingCall.setAttribute('aria-hidden', 'false');
    playRingtone();
    // 30 秒无人接听自动关闭，避免一直响
    if (incomingCallAutoTimer) clearTimeout(incomingCallAutoTimer);
    incomingCallAutoTimer = setTimeout(() => {
      if (incomingCallOpen) hideIncomingCall();
    }, 30000);
  }

  function hideIncomingCall() {
    if (!incomingCallOpen) return;
    incomingCallOpen = false;
    incomingCall.classList.add('hidden');
    incomingCall.setAttribute('aria-hidden', 'true');
    stopRingtone();
    if (incomingCallAutoTimer) { clearTimeout(incomingCallAutoTimer); incomingCallAutoTimer = null; }
  }

  function acceptIncomingCall() {
    hideIncomingCall();
    startCallMode();
  }

  function rejectIncomingCall() {
    hideIncomingCall();
  }

  // ── Phase progress bar ────────────────────────────────────────────────────
  function updatePhaseBar(phase) {
    for (let i = 1; i <= 4; i++) {
      const step = document.getElementById(`phaseStep${i}`);
      if (!step) continue;
      step.classList.toggle('active', i === phase);
      step.classList.toggle('done', i < phase);
    }
  }

  // ── iOS detection ──────────────────────────────────────────────────────────
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  let ttsAudioEl = null;
  let callAudioEl = null;
  let audioUnlocked = false;

  function initTtsAudio() {
    if (!ttsAudioEl) {
      ttsAudioEl = document.createElement('audio');
      ttsAudioEl.preload = 'none';
      ttsAudioEl.setAttribute('playsinline', '');
      ttsAudioEl.setAttribute('webkit-playsinline', '');
    }
    return ttsAudioEl;
  }

  function resetTtsAudio() {
    if (ttsAudioEl) {
      ttsAudioEl.pause();
      ttsAudioEl.src = '';
      ttsAudioEl.load();
    }
    ttsAudioEl = null;
  }

  function initCallAudio() {
    if (!callAudioEl) {
      callAudioEl = document.createElement('audio');
      callAudioEl.preload = 'none';
      callAudioEl.setAttribute('playsinline', '');
      callAudioEl.setAttribute('webkit-playsinline', '');
    }
    return callAudioEl;
  }

  async function unlockAudio() {
    if (audioUnlocked) return;
    if (!isIOS()) {
      audioUnlocked = true;
      return;
    }
    try {
      const el = initTtsAudio();
      await el.play();
      el.pause();
      el.currentTime = 0;
      audioUnlocked = true;
    } catch (_) {}
  }

  // ── Voice: TTS ────────────────────────────────────────────────────────────

  async function speakText(html) {
    if (!ttsEnabled) return;

    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const text = (tmp.textContent || tmp.innerText || '').trim();
    if (!text) return;

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (res.ok) {
        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        if (isIOS()) resetTtsAudio();
        const el = initTtsAudio();
        el.src = audioUrl;
        await new Promise((resolve) => {
          el.onended = () => { if (isIOS()) resetTtsAudio(); else { el.src = ''; URL.revokeObjectURL(audioUrl); } resolve(); };
          el.onerror = () => { if (isIOS()) resetTtsAudio(); else { el.src = ''; URL.revokeObjectURL(audioUrl); } resolve(); };
          el.play().catch(() => resolve());
        });
        return;
      }
    } catch (e) {
      console.warn('火山 TTS 失败，降级到浏览器 TTS:', e);
    }

    if (window.speechSynthesis) {
      if (isIOS()) {
        window.speechSynthesis.cancel();
      }
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'zh-CN';
      utter.rate = 0.95;
      utter.pitch = 1.3;
      utter.volume = 1.0;

      const loadVoices = () => new Promise(resolve => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) resolve(voices);
        else window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices());
      });

      const voices = await loadVoices();
      const preferredVoice = voices.find(v =>
        v.lang.startsWith('zh') && (
          v.name.includes('Tingting') ||
          v.name.includes('Xiaoxiao') ||
          v.name.includes('Female') ||
          v.name.includes('女')
        )
      );
      if (preferredVoice) utter.voice = preferredVoice;

      await new Promise((resolve) => {
        utter.onend = resolve;
        utter.onerror = resolve;
        if (isIOS()) {
          setTimeout(() => {
            window.speechSynthesis.speak(utter);
          }, 100);
        } else {
          window.speechSynthesis.speak(utter);
        }
      });
    }
  }

  function toggleTTS() {
    ttsEnabled = !ttsEnabled;
    ttsBtn.textContent = ttsEnabled ? '🔊 语音' : '🔇 语音';
    ttsBtn.title = ttsEnabled ? '关闭语音播报' : '开启语音播报';
    ttsBtn.classList.toggle('tts-off', !ttsEnabled);
    if (!ttsEnabled && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
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
      if (!isIOS()) userInput.focus();
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
  const CALL_SILENCE_THRESHOLD = 8;
  const CALL_SILENCE_DURATION = 2000;
  const CALL_MAX_RECORDING = 30000;

  function setCallState(state) {
    callState = state;
    callStatus.className = 'call-bar-status';
    callWaveform.className = 'call-bar-waveform';

    switch (state) {
      case 'listening':
        callStatus.textContent = '正在聆听...';
        callStatus.classList.add('listening');
        callWaveform.classList.add('active');
        break;
      case 'thinking':
        callStatus.textContent = '魔法师正在思考...';
        callStatus.classList.add('thinking');
        callWaveform.classList.add('thinking');
        break;
      case 'speaking':
        callStatus.textContent = '魔法师正在说话...';
        callStatus.classList.add('speaking');
        break;
      case 'recognizing':
        callStatus.textContent = '正在识别语音...';
        callStatus.classList.add('thinking');
        callWaveform.classList.add('thinking');
        break;
      default:
        callStatus.textContent = '请开始说话...';
    }
  }

  async function startCallMode() {
    if (isCallMode || !sessionId) return;

    try {
      callStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
    } catch (e) {
      alert('无法访问麦克风，请允许麦克风权限后重试');
      return;
    }

    isCallMode = true;
    callBar.classList.remove('hidden');
    document.body.classList.add('call-active');
    callBtn.classList.add('hidden');

    callAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    callInputSampleRate = callAudioCtx.sampleRate;
    const source = callAudioCtx.createMediaStreamSource(callStream);
    callAnalyser = callAudioCtx.createAnalyser();
    callAnalyser.fftSize = 512;
    source.connect(callAnalyser);

    callProcessor = callAudioCtx.createScriptProcessor(4096, 1, 1);
    callProcessor.onaudioprocess = (e) => {
      if (!isCallMode || callState !== 'listening') return;
      const input = e.inputBuffer.getChannelData(0);
      callPcmChunks.push(new Float32Array(input));
    };
    source.connect(callProcessor);
    callProcessor.connect(callAudioCtx.destination);

    startCallRecording();
  }

  function startCallRecording() {
    if (!isCallMode || !callStream) return;

    callPcmChunks = [];
    callHasSpeech = false;
    callSilenceStart = 0;
    callRecordStartTime = Date.now();

    setCallState('listening');
    monitorCallAudio();
  }

  function monitorCallAudio() {
    if (!callAnalyser || !isCallMode) return;

    const data = new Uint8Array(callAnalyser.frequencyBinCount);

    function check() {
      if (!isCallMode || callState !== 'listening') return;

      callAnalyser.getByteFrequencyData(data);

      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length;

      if (avg > CALL_SILENCE_THRESHOLD) {
        callHasSpeech = true;
        callSilenceStart = 0;
      } else if (callHasSpeech) {
        if (!callSilenceStart) {
          callSilenceStart = Date.now();
        } else if (Date.now() - callSilenceStart > CALL_SILENCE_DURATION) {
          stopCallRecordingAndSend();
          return;
        }
      }

      if (callHasSpeech && Date.now() - callRecordStartTime > CALL_MAX_RECORDING) {
        stopCallRecordingAndSend();
        return;
      }

      callAnimFrame = requestAnimationFrame(check);
    }

    callAnimFrame = requestAnimationFrame(check);
  }

  function stopCallRecordingAndSend() {
    if (callAnimFrame) {
      cancelAnimationFrame(callAnimFrame);
      callAnimFrame = null;
    }
    if (!isCallMode) return;
    if (callHasSpeech && callPcmChunks.length > 0) {
      sendCallAudio();
    } else {
      startCallRecording();
    }
  }

  function flattenPcm(chunks) {
    let length = 0;
    for (const c of chunks) length += c.length;
    const out = new Float32Array(length);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out;
  }

  function downsampleTo16k(buffer, inputRate) {
    const targetRate = 16000;
    if (inputRate === targetRate) return buffer;
    const ratio = inputRate / targetRate;
    const newLen = Math.floor(buffer.length / ratio);
    const out = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.min(buffer.length, Math.floor((i + 1) * ratio));
      let sum = 0;
      let count = 0;
      for (let j = start; j < end; j++) { sum += buffer[j]; count++; }
      out[i] = count > 0 ? sum / count : 0;
    }
    return out;
  }

  function encodeWav(pcm, sampleRate) {
    const bytesPerSample = 2;
    const dataSize = pcm.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    function writeStr(offset, s) {
      for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
    }

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * bytesPerSample, true);
    view.setUint16(32, bytesPerSample, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < pcm.length; i++) {
      let s = Math.max(-1, Math.min(1, pcm[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
    return new Blob([view], { type: 'audio/wav' });
  }

  async function sendCallAudio() {
    if (!isCallMode || busy) {
      if (isCallMode && !busy) startCallRecording();
      return;
    }

    setCallState('recognizing');

    const flat = flattenPcm(callPcmChunks);
    callPcmChunks = [];
    const downsampled = downsampleTo16k(flat, callInputSampleRate);
    const wavBlob = encodeWav(downsampled, 16000);

    try {
      const res = await fetch('/api/stt', {
        method: 'POST',
        headers: { 'X-Audio-Format': 'wav' },
        body: wavBlob,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '识别失败' }));
        throw new Error(err.error || '识别失败');
      }

      const data = await res.json();
      const text = (data.text || '').trim();

      if (text) {
        await sendCallMessage(text);
      } else {
        callStatus.textContent = '没听清，请再说一次...';
        setTimeout(() => {
          if (isCallMode) startCallRecording();
        }, 800);
      }
    } catch (e) {
      console.error('语音识别失败:', e);
      callStatus.textContent = '识别失败，请重试...';
      setTimeout(() => {
        if (isCallMode) startCallRecording();
      }, 1500);
    }
  }

  function stopCallMode() {
    if (!isCallMode) return;

    isCallMode = false;
    callState = 'idle';
    callHasSpeech = false;
    callSilenceStart = 0;
    callPcmChunks = [];
    clearTimeout(silenceTimer);

    if (callAnimFrame) {
      cancelAnimationFrame(callAnimFrame);
      callAnimFrame = null;
    }

    if (callAudioEl) {
      callAudioEl.pause();
      callAudioEl.src = '';
    }

    if (callProcessor) {
      try { callProcessor.disconnect(); } catch (e) {}
      callProcessor.onaudioprocess = null;
      callProcessor = null;
    }

    if (callStream) {
      callStream.getTracks().forEach(t => t.stop());
      callStream = null;
    }

    if (callAudioCtx) {
      callAudioCtx.close().catch(() => {});
      callAudioCtx = null;
      callAnalyser = null;
    }

    callWaveform.className = 'call-bar-waveform';
    callBar.classList.add('hidden');
    document.body.classList.remove('call-active');
    callBtn.classList.remove('hidden');
  }

  async function sendCallMessage(text) {
    if (!text || busy || !sessionId) return;

    setCallState('thinking');

    appendUserMsg(text);
    scrollBottom();
    setBusy(true);

    const { bubble, msgEl } = appendStreamingAssistantMsg();
    let shouldAutoBook = false;

    try {
      const data = await streamChat(
        { sessionId, input: text },
        (delta) => appendToBubble(bubble, delta)
      );
      finalizeStreamingBubble(bubble);
      round = data.round || round + 1;

      if (data.phase) updatePhaseBar(data.phase);

      if (data.sanitized) {
        const note = document.createElement('div');
        note.className = 'msg-sanitized';
        note.textContent = '✨ 魔法师把故事变得更美好了';
        bubble.parentNode.appendChild(note);
      }

      const isEmotion = data.action === 'ask_emotion';
      if (isEmotion) msgEl.classList.add('msg-emotion');

      scrollBottom();

      if (round >= 5) bookBtn.classList.remove('hidden');
      if (round >= 3) reportBtn.classList.remove('hidden');

      let pendingGameScenario = '';
      if (data.action === 'generate_image' && data.imagePrompt) {
        await handleImageGeneration(data.imagePrompt, data.scene || text);
      } else if (data.action === 'generate_video' && data.videoPrompt) {
        await handleVideoGeneration(data.videoPrompt, data.scene || text);
      } else if (data.action === 'mini_game' && data.gameScenario) {
        pendingGameScenario = data.gameScenario;
      } else if (data.action === 'finalize_book') {
        bookBtn.classList.remove('hidden');
        shouldAutoBook = true;
      }

      await playCallTTS(data.reply);

      if (pendingGameScenario) {
        setBusy(false);
        const won = await handleMiniGame(pendingGameScenario);
        if (won) {
          const synthetic = await notifyMiniGameDone(pendingGameScenario);
          if (synthetic && isCallMode) {
            await sendCallMessage(synthetic);
          }
        }
        return;
      }
    } catch (e) {
      finalizeStreamingBubble(bubble);
      bubble.textContent = '⚠️ ' + (e.message || '出了点小问题，请再试一次！');
      bubble.style.background = '#ffebee';
      bubble.style.color = '#c62828';
      callStatus.textContent = '出错了，请重试...';
    } finally {
      setBusy(false);
      if (shouldAutoBook) {
        makeBook();
      } else if (isCallMode) {
        startCallRecording();
      }
    }
  }

  async function playCallTTS(text) {
    if (!ttsEnabled || !text.trim()) return;

    setCallState('speaking');

    const plainText = text.replace(/<[^>]*>/g, '').trim();
    if (!plainText) return;

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: plainText })
      });

      if (res.ok) {
        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const el = initCallAudio();
        const prevOnEnd = el.onended;
        const prevOnErr = el.onerror;
        el.src = audioUrl;

        await new Promise((resolve) => {
          el.onended = () => {
            el.src = '';
            URL.revokeObjectURL(audioUrl);
            el.onended = prevOnEnd;
            el.onerror = prevOnErr;
            resolve();
          };
          el.onerror = () => {
            el.src = '';
            URL.revokeObjectURL(audioUrl);
            el.onended = prevOnEnd;
            el.onerror = prevOnErr;
            resolve();
          };
          el.play().catch(() => resolve());
        });
        return;
      }
    } catch (e) {
      console.warn('火山 TTS 失败，降级到浏览器 TTS:', e);
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(plainText);
      utter.lang = 'zh-CN';
      utter.rate = 0.95;
      utter.pitch = 1.3;
      utter.volume = 1.0;

      const loadVoices = () => new Promise(resolve => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) resolve(voices);
        else window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices());
      });

      const voices = await loadVoices();
      const preferredVoice = voices.find(v =>
        v.lang.startsWith('zh') && (
          v.name.includes('Tingting') ||
          v.name.includes('Xiaoxiao') ||
          v.name.includes('Female') ||
          v.name.includes('女')
        )
      );
      if (preferredVoice) utter.voice = preferredVoice;

      await new Promise((resolve) => {
        utter.onend = resolve;
        utter.onerror = resolve;
        window.speechSynthesis.speak(utter);
      });
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
    showToast('🪄 魔法师启动中…');
    try {
      const res = await apiFetch('/api/session', 'POST', { ageGroup });
      sessionId = res.sessionId;
      setAgeBadge(ageGroup);

      // 流式拉取并打字机展示随机开场白
      const { bubble } = appendStreamingAssistantMsg();
      let opening = '';
      try {
        const data = await streamSSE(
          '/api/opening-stream',
          { sessionId },
          (delta) => appendToBubble(bubble, delta)
        );
        opening = (data && data.opening) || (bubble.textContent || '').trim();
      } finally {
        finalizeStreamingBubble(bubble);
      }
      hideToast();

      // 等开场白朗读结束后，弹出"微信电话"邀请孩子接听进入语音模式
      if (opening) {
        await speakText(opening);
      }
      // 仅每个 session 弹一次，避免重复打扰
      if (!incomingShownThisSession && !isCallMode) {
        showIncomingCall();
      }
    } catch (e) {
      hideToast();
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

    // 先创建一个空气泡用于流式追加
    const { bubble, msgEl } = appendStreamingAssistantMsg();
    let shouldAutoBook = false;

    try {
      const data = await streamChat(
        { sessionId, input: text },
        (delta) => appendToBubble(bubble, delta)
      );
      finalizeStreamingBubble(bubble);
      round = data.round || round + 1;

      if (data.phase) updatePhaseBar(data.phase);

      // Sanitize note
      if (data.sanitized) {
        const note = document.createElement('div');
        note.className = 'msg-sanitized';
        note.textContent = '✨ 魔法师把故事变得更美好了';
        bubble.parentNode.appendChild(note);
      }

      const isEmotion = data.action === 'ask_emotion';
      if (isEmotion) msgEl.classList.add('msg-emotion');

      // 流式输出后再朗读完整文本
      speakText(bubble.textContent || '');

      if (round >= 5) bookBtn.classList.remove('hidden');
      if (round >= 3) reportBtn.classList.remove('hidden');

      let pendingGameScenario = '';
      if (data.action === 'generate_image' && data.imagePrompt) {
        await handleImageGeneration(data.imagePrompt, data.scene || text);
      } else if (data.action === 'generate_video' && data.videoPrompt) {
        await handleVideoGeneration(data.videoPrompt, data.scene || text);
      } else if (data.action === 'mini_game' && data.gameScenario) {
        pendingGameScenario = data.gameScenario;
      } else if (data.action === 'finalize_book') {
        bookBtn.classList.remove('hidden');
        shouldAutoBook = true;
      }

      if (pendingGameScenario) {
        setBusy(false);
        const won = await handleMiniGame(pendingGameScenario);
        if (won) {
          const synthetic = await notifyMiniGameDone(pendingGameScenario);
          if (synthetic) {
            userInput.value = synthetic;
            await sendMessage();
          }
        }
        return;
      }
    } catch (e) {
      finalizeStreamingBubble(bubble);
      bubble.textContent = '⚠️ ' + (e.message || '出了点小问题，请再试一次！');
      bubble.style.background = '#ffebee';
      bubble.style.color = '#c62828';
    } finally {
      setBusy(false);
      if (shouldAutoBook) makeBook();
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

  // ── Mini game (AI-generated HTML in sandboxed iframe) ─────────────────────
  let gameOpen = false;
  let gameWonResolver = null;
  let gameLoadingTextTimer = null;

  const GAME_LOADING_LINES = [
    '✨ 调配游戏魔法粉…',
    '🧙 捏一个小关卡…',
    '🎨 上色…',
    '🌈 马上就好啦～',
  ];

  function startGameLoadingMessages() {
    let i = 0;
    miniGameLoadingText.textContent = GAME_LOADING_LINES[0];
    if (gameLoadingTextTimer) clearInterval(gameLoadingTextTimer);
    gameLoadingTextTimer = setInterval(() => {
      i = (i + 1) % GAME_LOADING_LINES.length;
      miniGameLoadingText.textContent = GAME_LOADING_LINES[i];
    }, 1100);
  }

  function stopGameLoadingMessages() {
    if (gameLoadingTextTimer) {
      clearInterval(gameLoadingTextTimer);
      gameLoadingTextTimer = null;
    }
  }

  function showGameModal() {
    miniGameModal.classList.remove('hidden');
    miniGameLoading.classList.remove('hidden');
    miniGameStage.classList.add('hidden');
    miniGameStage.innerHTML = '';
    miniGameWin.classList.add('hidden');
    miniGameSubtitle.textContent = '魔法师正在为你变出一个小游戏…';
    startGameLoadingMessages();
    gameOpen = true;
  }

  function hideGameModal() {
    miniGameModal.classList.add('hidden');
    miniGameStage.innerHTML = '';
    stopGameLoadingMessages();
    gameOpen = false;
  }

  function showGameError(msg) {
    stopGameLoadingMessages();
    miniGameLoading.classList.add('hidden');
    miniGameStage.classList.remove('hidden');
    miniGameStage.innerHTML = `<div class="game-error-msg">😅 ${escHtml(msg)}</div>`;
    miniGameSubtitle.textContent = '我们继续讲故事吧～';
  }

  async function handleMiniGame(scenario) {
    if (gameOpen) return false;

    // 暂停电话模式录音 / 输入 TTS（不要打断已经在播的旁白朗读）
    const wasCallMode = isCallMode;
    if (isCallMode) {
      try { if (callAudioEl) callAudioEl.pause(); } catch (_) {}
      setCallState('idle');
      callStatus.textContent = '小游戏暂停一下哦～';
    }

    showGameModal();

    // 1) 请求 AI 生成游戏 HTML
    let html = '';
    try {
      const res = await apiFetch('/api/mini-game', 'POST', { sessionId, scenario });
      html = String(res.html || '').trim();
    } catch (e) {
      showGameError('魔法有点累啦，我们继续讲故事～');
      await new Promise((r) => setTimeout(r, 1800));
      hideGameModal();
      if (wasCallMode && isCallMode) startCallRecording();
      return false;
    }

    if (!html) {
      showGameError('魔法有点累啦，我们继续讲故事～');
      await new Promise((r) => setTimeout(r, 1800));
      hideGameModal();
      if (wasCallMode && isCallMode) startCallRecording();
      return false;
    }

    // 2) 注入 iframe（沙箱 only allow-scripts，不给 same-origin）
    stopGameLoadingMessages();
    miniGameLoading.classList.add('hidden');
    miniGameStage.classList.remove('hidden');
    miniGameSubtitle.textContent = '快来帮一下小伙伴吧～';

    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('title', '魔法小游戏');
    iframe.srcdoc = html;
    miniGameStage.appendChild(iframe);

    // 3) 等待通关
    const won = await new Promise((resolve) => {
      gameWonResolver = resolve;
      // 兜底：60s 仍未通关，自动关闭并继续
      setTimeout(() => {
        if (gameWonResolver === resolve) {
          gameWonResolver = null;
          resolve(false);
        }
      }, 90000);
    });

    if (won) {
      miniGameWin.classList.remove('hidden');
      await new Promise((r) => setTimeout(r, 1100));
    }
    hideGameModal();

    if (wasCallMode && isCallMode) startCallRecording();
    return won;
  }

  // 从 iframe 接收通关消息
  window.addEventListener('message', (e) => {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type !== 'sm-game') return;
    if (e.data.event === 'win' && gameWonResolver) {
      const r = gameWonResolver;
      gameWonResolver = null;
      r(true);
    }
  });

  async function notifyMiniGameDone(scenario) {
    try {
      const res = await apiFetch('/api/mini-game/done', 'POST', { sessionId, scenario });
      return res.syntheticInput || '';
    } catch (e) {
      console.warn('mini-game/done 失败:', e.message);
      return '';
    }
  }

  // ── Make book ─────────────────────────────────────────────────────────────
  async function makeBook() {
    if (busy) return;

    if (cachedBook) {
      renderBook(cachedBook);
      bookModal.classList.remove('hidden');
      return;
    }

    setBusy(true);
    showToast('✨ 正在整理你的魔法小书…');

    try {
      const data = await apiFetch('/api/book', 'POST', { sessionId });
      cachedBook = data.book;
      renderBook(data.book);
      bookModal.classList.remove('hidden');
    } catch (e) {
      appendError('成书失败，请再试一次：' + e.message);
    } finally {
      setBusy(false);
      hideToast();
    }
  }

  function proxyImageUrl(url) {
    if (!url || !/^https?:\/\//i.test(url)) return url;
    return '/api/proxy-image?url=' + encodeURIComponent(url);
  }

  function renderBook(book) {
    bookTitle.textContent = `✨ ${book.title || '我的魔法小书'}`;
    bookPages.innerHTML = '';

    (book.pages || []).forEach((page, i) => {
      const div = document.createElement('div');
      div.className = 'book-page';

      let mediaHtml = '';
      if (page.imageUrl) {
        mediaHtml = `<img class="book-page-img" crossorigin="anonymous" src="${escHtml(proxyImageUrl(page.imageUrl))}" alt="第${i+1}页插图" />`;
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
    refreshAnimButton();
  }

  // ── Export book as a long image ──────────────────────────────────────────
  let html2canvasLoader = null;
  function loadHtml2Canvas() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    if (html2canvasLoader) return html2canvasLoader;
    html2canvasLoader = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.onload = () => resolve(window.html2canvas);
      s.onerror = () => {
        html2canvasLoader = null;
        reject(new Error('截图组件加载失败，请检查网络'));
      };
      document.head.appendChild(s);
    });
    return html2canvasLoader;
  }

  async function waitForBookImages() {
    const imgs = bookPages.querySelectorAll('img');
    await Promise.all(
      Array.from(imgs).map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        });
      })
    );
  }

  async function exportBookImage() {
    if (busy) return;
    const exportBtn = document.getElementById('exportImageBtn');
    const exportRoot = document.getElementById('bookExportRoot');
    if (!exportRoot) return;

    setBusy(true);
    if (exportBtn) {
      exportBtn.disabled = true;
      exportBtn.textContent = '🖼️ 生成中…';
    }
    showToast('🖼️ 正在生成长图…');

    const modalContent = exportRoot.closest('.modal-content');
    const prevModalStyle = modalContent ? modalContent.style.cssText : '';
    const prevRootStyle = exportRoot.style.cssText;
    if (modalContent) {
      modalContent.style.maxHeight = 'none';
      modalContent.style.overflow = 'visible';
    }
    exportRoot.style.background = '#fff';
    exportRoot.style.padding = '24px';
    exportRoot.style.borderRadius = '16px';

    try {
      await waitForBookImages();
      const html2canvas = await loadHtml2Canvas();
      const canvas = await html2canvas(exportRoot, {
        backgroundColor: '#fff',
        useCORS: true,
        scale: Math.min(2, window.devicePixelRatio || 1.5),
        scrollX: 0,
        scrollY: 0,
        windowWidth: exportRoot.scrollWidth,
        windowHeight: exportRoot.scrollHeight,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      const safeTitle = (bookTitle.textContent || '魔法小书').replace(/[\\/:*?"<>|]/g, '').trim();
      a.href = dataUrl;
      a.download = `${safeTitle || '魔法小书'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('✨ 长图已保存到下载~');
      setTimeout(hideToast, 1500);
    } catch (e) {
      appendError('长图生成失败：' + (e.message || e));
      hideToast();
    } finally {
      if (modalContent) modalContent.style.cssText = prevModalStyle;
      exportRoot.style.cssText = prevRootStyle;
      if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.textContent = '🖼️ 保存长图';
      }
      setBusy(false);
    }
  }

  // ── Book animation (multi-image to video) ───────────────────────────────
  const bookAnimArea   = document.getElementById('bookAnimArea');
  const bookAnimStatus = document.getElementById('bookAnimStatus');
  const bookAnimVideo  = document.getElementById('bookAnimVideo');
  const generateAnimBtn = document.getElementById('generateAnimBtn');

  function refreshAnimButton() {
    if (!generateAnimBtn) return;
    const hasBook = !!cachedBook;
    generateAnimBtn.disabled = !hasBook;
    generateAnimBtn.title = hasBook ? '把魔法小书变成动画' : '请先制作魔法小书';

    if (!bookAnimArea) return;
    if (bookVideoUrl) {
      bookAnimArea.classList.remove('hidden');
      bookAnimVideo.classList.remove('hidden');
      bookAnimVideo.src = bookVideoUrl;
      bookAnimStatus.textContent = '🎬 动画已生成';
      generateAnimBtn.textContent = '🎬 重新观看动画';
    } else {
      bookAnimArea.classList.add('hidden');
      bookAnimVideo.classList.add('hidden');
      bookAnimVideo.removeAttribute('src');
      bookAnimStatus.textContent = '';
      generateAnimBtn.textContent = '🎬 生成动画';
    }
  }

  function buildBookAnimPayload() {
    const pages = (cachedBook && cachedBook.pages) || [];
    const imageUrls = [];
    const texts = [];
    pages.forEach((p) => {
      if (p.imageUrl && /^https?:\/\//i.test(p.imageUrl)) {
        imageUrls.push(p.imageUrl);
        if (p.text) texts.push(String(p.text));
      }
    });
    const title = (cachedBook && cachedBook.title) || '魔法小书';
    const promptParts = [`故事《${title}》分镜动画。`];
    if (texts.length) promptParts.push(texts.join(' '));
    if (cachedBook && cachedBook.closing) promptParts.push(String(cachedBook.closing));
    return { imageUrls, prompt: promptParts.join(' ').slice(0, 1800) };
  }

  async function makeBookVideo() {
    if (busy || !cachedBook) return;

    if (bookVideoUrl) {
      bookAnimArea.classList.remove('hidden');
      bookAnimVideo.classList.remove('hidden');
      bookAnimVideo.src = bookVideoUrl;
      bookAnimVideo.play().catch(() => {});
      return;
    }

    const { imageUrls, prompt } = buildBookAnimPayload();
    if (!imageUrls.length) {
      appendError('魔法小书还没有插图，无法生成动画');
      return;
    }

    setBusy(true);
    generateAnimBtn.disabled = true;
    generateAnimBtn.textContent = '🎬 提交中…';
    bookAnimArea.classList.remove('hidden');
    bookAnimVideo.classList.add('hidden');
    bookAnimStatus.innerHTML = '<span class="loading-spinner"></span><span>动画施法中，最长约 5 分钟…</span>';

    try {
      const data = await apiFetch('/api/book-video', 'POST', {
        sessionId, imageUrls, prompt,
      });

      if (data.mode === 'cached' && data.videoUrl) {
        bookVideoUrl = data.videoUrl;
        refreshAnimButton();
        return;
      }
      if (!data.taskId) throw new Error('动画提交失败');

      // 5 分钟超时；每 10 秒轮询一次 ⇒ 最多 30 次
      await pollTask(
        '/api/book-video/',
        data.taskId,
        (result) => {
          if (result.status === 'done' && result.videoUrl) {
            bookVideoUrl = result.videoUrl;
            return true;
          }
          if (result.status === 'failed') {
            throw new Error('动画生成失败');
          }
          return false;
        },
        10000,
        30,
        { sessionId },
      );

      refreshAnimButton();
      bookAnimVideo.play().catch(() => {});
    } catch (e) {
      bookAnimStatus.textContent = '⚠️ ' + (e.message || '动画生成失败');
      generateAnimBtn.disabled = false;
      generateAnimBtn.textContent = '🎬 重试生成';
    } finally {
      setBusy(false);
      if (bookVideoUrl) generateAnimBtn.disabled = false;
    }
  }


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
      cachedBook = null;
      bookVideoUrl = null;
      refreshAnimButton();
      window.speechSynthesis && window.speechSynthesis.cancel();
      if (isRecording) stopRecording();
      hideIncomingCall();
      incomingShownThisSession = true;
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
      if (!isIOS()) userInput.focus();
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
    cachedBook = null;
    bookVideoUrl = null;
    refreshAnimButton();
    if (isRecording) stopRecording();
    if (isCallMode) stopCallMode();
    hideIncomingCall();
    incomingShownThisSession = false;
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
  function appendStreamingAssistantMsg() {
    const div = document.createElement('div');
    div.className = 'msg msg-assistant';
    div.innerHTML = `
      <div class="msg-avatar">🧙</div>
      <div>
        <div class="msg-bubble msg-streaming"><span class="stream-text"></span><span class="stream-cursor"></span></div>
      </div>`;
    chatMessages.appendChild(div);
    scrollBottom();
    return { msgEl: div, bubble: div.querySelector('.msg-bubble') };
  }

  function appendToBubble(bubble, text) {
    if (!bubble || !text) return;
    const span = bubble.querySelector('.stream-text');
    if (span) span.textContent = (span.textContent || '') + text;
    else bubble.textContent = (bubble.textContent || '') + text;
    scrollBottom();
  }

  function finalizeStreamingBubble(bubble) {
    if (!bubble) return;
    const cursor = bubble.querySelector('.stream-cursor');
    if (cursor) cursor.remove();
    bubble.classList.remove('msg-streaming');
    const span = bubble.querySelector('.stream-text');
    if (span) {
      bubble.textContent = span.textContent || '';
    }
  }

  function appendAssistantMsg(htmlContent, extraClass = '', autoSpeak = true) {
    const div = document.createElement('div');
    div.className = `msg msg-assistant ${extraClass}`.trim();
    div.innerHTML = `
      <div class="msg-avatar">🧙</div>
      <div>
        <div class="msg-bubble">${htmlContent}</div>
      </div>`;
    chatMessages.appendChild(div);
    scrollBottom();
    if (autoSpeak) speakText(htmlContent);
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
    } else {
      hideToast();
      if (!isCallMode && !isIOS()) userInput.focus();
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
   * 通用 SSE POST 客户端。返回 done 事件 payload；中途的 delta 通过 onDelta 回调。
   * @param {string} path
   * @param {object} body
   * @param {(text: string) => void} onDelta
   */
  async function streamSSE(path, body, onDelta) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); msg = j.error || msg; } catch (_) {}
      throw new Error(msg);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buf = '';
    let done = null;
    let errorMsg = null;

    while (true) {
      const { value, done: streamDone } = await reader.read();
      if (streamDone) break;
      buf += decoder.decode(value, { stream: true });

      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        let event = 'message';
        const dataLines = [];
        raw.split('\n').forEach((line) => {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        });
        if (!dataLines.length) continue;
        let payload;
        try { payload = JSON.parse(dataLines.join('\n')); } catch (_) { continue; }
        if (event === 'delta' && payload.text) {
          onDelta(payload.text);
        } else if (event === 'done') {
          done = payload;
        } else if (event === 'error') {
          errorMsg = payload.error || '出错了';
        }
      }
    }

    if (errorMsg) throw new Error(errorMsg);
    if (!done) throw new Error('未收到完整响应');
    return done;
  }

  function streamChat(body, onDelta) {
    return streamSSE('/api/chat-stream', body, onDelta);
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
  sendBtn.addEventListener('click', () => { unlockAudio(); sendMessage(); });

  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      unlockAudio();
      sendMessage();
    }
  });

  micBtn.addEventListener('click', () => {
    unlockAudio();
    if (isRecording) stopRecording();
    else startRecording();
  });

  ttsBtn.addEventListener('click', () => { unlockAudio(); toggleTTS(); });

  bookBtn.addEventListener('click', makeBook);
  reportBtn.addEventListener('click', makeReport);
  resetBtn.addEventListener('click', reset);

  const exportImageBtn = document.getElementById('exportImageBtn');
  if (exportImageBtn) exportImageBtn.addEventListener('click', exportBookImage);
  if (generateAnimBtn) generateAnimBtn.addEventListener('click', makeBookVideo);

  async function requestMicPermissionEarly() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    if (isIOS()) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        try {
          const ctx = new AudioCtx();
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }
          await ctx.close();
        } catch (_) {}
      }
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
    } catch (_) {}
  }

  document.querySelectorAll('.age-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      ageGroup = btn.dataset.age || '4-5';
      hideAgeModal();
      if (!isIOS()) userInput.focus();
      loadHistoryList();
      unlockAudio();
      requestMicPermissionEarly();
      await initSession();
    });
  });

  modalClose.addEventListener('click', () => bookModal.classList.add('hidden'));
  bookModal.addEventListener('click', (e) => {
    if (e.target === bookModal) bookModal.classList.add('hidden');
  });

  // Mini-game modal: 关闭按钮等价于"放弃通关"
  miniGameClose.addEventListener('click', () => {
    if (gameWonResolver) {
      const r = gameWonResolver;
      gameWonResolver = null;
      r(false);
    }
    hideGameModal();
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

  callBtn.addEventListener('click', () => { unlockAudio(); startCallMode(); });
  hangUpBtn.addEventListener('click', () => { unlockAudio(); stopCallMode(); });
  if (callAcceptBtn) callAcceptBtn.addEventListener('click', () => { unlockAudio(); acceptIncomingCall(); });
  if (callRejectBtn) callRejectBtn.addEventListener('click', () => { unlockAudio(); rejectIncomingCall(); });

  // ── Boot ──────────────────────────────────────────────────────────────────
  updatePhaseBar(1);
  initSpeechRecognition();
  refreshAnimButton();
  showAgeModal();
})();
