/* Vextra game editor – sensor host. The Play frame is sandboxed (opaque origin), and browsers / WebView2 / WebKit refuse the microphone,
 * camera and speech recognition to such frames. So the editor owns the devices and streams plain data to the game:
 *   microphone → time-domain + frequency arrays, camera → small ImageBitmap frames, speech → recognised text.
 * Only the game frame this panel started (token + source) may ask, and nothing leaves the computer. */
(function () {
  const WHY = {
    NotAllowedError: (k) => 'The ' + k + ' was blocked. Allow it in the permission prompt, and on Windows turn on Settings → Privacy & security → ' + (k === 'camera' ? 'Camera' : 'Microphone') + ' → "Let desktop apps access your ' + k + '" (macOS: System Settings → Privacy & Security → ' + (k === 'camera' ? 'Camera' : 'Microphone') + ').',
    SecurityError: (k) => 'The ' + k + ' was blocked by the security settings of this window.',
    NotFoundError: (k) => 'No ' + k + ' was found – plug one in or check that it is enabled.',
    NotReadableError: (k) => 'The ' + k + ' is in use by another program (close it and try again).',
    OverconstrainedError: (k) => 'This ' + k + ' does not support the requested settings.',
  };
  const why = (e, k) => (WHY[e && e.name] ? WHY[e.name](k) : 'The ' + k + ' could not be started.') + (e && (e.name || e.message) ? '  [' + [e.name, e.message].filter(Boolean).join(': ') + ']' : '');

  class SenseHost {
    /** post(type, value, transfer) sends to the game; the owner calls handle(op) for messages from it */
    constructor(post) { this.post = post; this.mic = null; this.cam = null; this.sp = null; }
    async handle(d) {
      const ok = (v) => this.post('sense-ack', { id: d.id, ok: true, ...v }), bad = (e, k) => this.post('sense-ack', { id: d.id, ok: false, error: why(e, k), name: e && e.name });
      try {
        if (d.op === 'mic-start') { await this.micStart(); ok({ sr: this.mic.ctx.sampleRate, fft: this.mic.an.fftSize }); }
        else if (d.op === 'mic-stop') { this.micStop(); ok(); }
        else if (d.op === 'cam-start') { const r = await this.camStart(d.facing); ok(r); }
        else if (d.op === 'cam-stop') { this.camStop(); ok(); }
        else if (d.op === 'speech-start') { this.speechStart(d.lang, d.interim, ok, (m) => this.post('sense-ack', { id: d.id, ok: false, error: m })); }
        else if (d.op === 'speech-stop') { this.speechStop(); ok(); }
      } catch (e) { bad(e, /^cam/.test(d.op) ? 'camera' : 'microphone'); }
    }
    async micStart() {
      if (this.mic) return; if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) throw Object.assign(new Error('not available'), { name: 'NotFoundError' });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const AC = window.AudioContext || window.webkitAudioContext, ctx = new AC(); try { await ctx.resume(); } catch { /* resumes on the next click */ }
      const an = ctx.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0.3; ctx.createMediaStreamSource(stream).connect(an);
      const m = (this.mic = { stream, ctx, an, td: new Float32Array(an.fftSize), fd: new Uint8Array(an.frequencyBinCount), raf: 0, on: true });
      const loop = () => { if (!m.on) return; m.an.getFloatTimeDomainData(m.td); m.an.getByteFrequencyData(m.fd); this.post('mic', { td: m.td.slice(), fd: m.fd.slice() }); m.raf = requestAnimationFrame(loop); };
      loop();
    }
    micStop() { const m = this.mic; if (!m) return; m.on = false; cancelAnimationFrame(m.raf); try { m.stream.getTracks().forEach((t) => t.stop()); } catch { /* gone */ } try { m.ctx.close(); } catch { /* gone */ } this.mic = null; }
    async camStart(facing) {
      if (this.cam) return { w: this.cam.w, h: this.cam.h }; if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) throw Object.assign(new Error('not available'), { name: 'NotFoundError' });
      /* try the nicest request first, then simpler ones – many webcams reject width / height / facingMode constraints */
      let stream = null, err = null; for (const c of [{ facingMode: facing || 'user', width: { ideal: 640 }, height: { ideal: 480 } }, { width: { ideal: 640 }, height: { ideal: 480 } }, true]) { try { stream = await navigator.mediaDevices.getUserMedia({ video: c }); break; } catch (e) { err = err || e; if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError' || e.name === 'NotReadableError')) throw e; } }
      if (!stream) throw err;
      /* a real (tiny, almost invisible) on-screen element – some web engines stop decoding video that is off-screen or display:none */
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.autoplay = true; v.srcObject = stream; v.setAttribute('aria-hidden', 'true'); v.style.cssText = 'position:fixed;left:0;top:0;width:64px;height:48px;opacity:0.01;pointer-events:none;z-index:-1'; document.body.append(v); try { await v.play(); } catch { /* autoplay */ }
      await new Promise((res) => { if (v.readyState >= 2 && v.videoWidth) res(); else { v.onloadeddata = res; v.onplaying = res; setTimeout(res, 5000); } });
      if (!(v.readyState >= 2 && v.videoWidth)) { stream.getTracks().forEach((t) => t.stop()); v.remove(); throw Object.assign(new Error('the camera opened but sent no picture (another program may be using it, or the driver is busy)'), { name: 'NotReadableError' }); }
      const c = (this.cam = { stream, v, on: true, w: v.videoWidth, h: v.videoHeight, busy: false, t: 0 });
      const cv = document.createElement('canvas'), W = 480, H = Math.max(1, Math.round(W * c.h / c.w)); cv.width = W; cv.height = H; const cx = cv.getContext('2d');
      const loop = (t) => { if (!c.on) return; c.raf = requestAnimationFrame(loop); if (t - c.t < 33 || c.busy || v.readyState < 2) return; c.t = t; c.busy = true; cx.drawImage(v, 0, 0, W, H); createImageBitmap(cv).then((b) => { c.busy = false; if (!c.on) { b.close(); return; } this.post('cam', { bmp: b, w: c.w, h: c.h }, [b]); }).catch(() => { c.busy = false; }); };
      c.raf = requestAnimationFrame(loop); return { w: c.w, h: c.h };
    }
    camStop() { const c = this.cam; if (!c) return; c.on = false; cancelAnimationFrame(c.raf); try { c.stream.getTracks().forEach((t) => t.stop()); } catch { /* gone */ } c.v.remove(); this.cam = null; }
    /* Voice commands. 1) the web engine's own speech recognition (Chrome / Edge / Safari). Embedded engines such as the desktop app's WebView2 have the API but no speech
     * service behind it, so it fails with "network" even when you are online. 2) optional fallback: record short phrases and send them to a speech-to-text
     * service you set in Settings → Voice commands (OpenAI-compatible /audio/transcriptions: OpenAI Whisper, Groq, a local whisper server …). */
    speechStart(lang, interim, ok, bad) {
      this.speechStop(); const A = (VX.app && VX.app.settings) || {}, mode = A.speechMode || 'auto', url = String(A.speechUrl || '').trim(), SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const NO_ENGINE = 'The speech service of this window is not available. The desktop app\'s web engine has the speech API but no service behind it (that is what "network" means here – it is not your internet). Fix: Settings → Voice commands → add a speech-to-text service (for example OpenAI Whisper or a local whisper server), or open the exported game in Chrome / Edge. Meanwhile use the "say" entry or test keys.';
      const useService = () => { if (!url) return false; this.serviceStart(lang, url, A, ok, bad); return true; };
      if (mode === 'service') { if (!useService()) bad('Voice commands are set to "speech service", but no service address is set (Settings → Voice commands).'); return; }
      if (!SR) { if (mode !== 'browser' && useService()) return; return bad('Speech recognition is not built into this window. ' + (url ? '' : 'Settings → Voice commands lets you add a speech-to-text service. ') + 'You can still use the "say" entry or test keys, or play the game in Chrome / Edge / Safari.'); }
      const r = new SR(), h = (this.sp = { r, on: true, fails: 0, got: false }); r.lang = lang || 'en-US'; r.continuous = true; r.interimResults = !!interim;
      r.onresult = (e) => { h.got = true; h.fails = 0; for (let i = e.resultIndex; i < e.results.length; i++) { const x = e.results[i]; this.post('speech', { text: String(x[0].transcript || '').trim(), final: x.isFinal, conf: x[0].confidence }); } };
      r.onerror = (e) => { if (e.error === 'no-speech' || e.error === 'aborted') return;
        if (e.error === 'network' || e.error === 'service-not-allowed' || e.error === 'language-not-supported') { h.fails++; if (!h.got && h.fails >= 1) { h.on = false; try { r.abort(); } catch { /* idle */ } if (mode !== 'browser' && url) { this.sp = null; this.serviceStart(lang, url, A, () => this.post('speech-state', { state: 'listening', via: 'service' }), (m) => this.post('speech-state', { state: 'error', error: m })); return; } this.post('speech-state', { state: 'error', error: NO_ENGINE }); return; } if (h.fails < 3) return; h.on = false; this.post('speech-state', { state: 'error', error: 'the speech service stopped answering (check your internet connection)' }); return; }
        h.on = false; this.post('speech-state', { state: 'error', error: e.error === 'not-allowed' ? 'blocked – allow the microphone' : e.error }); };
      r.onend = () => { if (h.on) setTimeout(() => { try { r.start(); } catch { /* running */ } }, 250); }; r.onstart = () => this.post('speech-state', { state: 'listening' });
      try { r.start(); ok(); } catch (e) { bad('Speech recognition: ' + e.message); }
    }
    async serviceStart(lang, url, A, ok, bad) {
      let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch (e) { return bad(why(e, 'microphone')); }
      if (typeof MediaRecorder === 'undefined') { stream.getTracks().forEach((t) => t.stop()); return bad('This window cannot record audio (no MediaRecorder).'); }
      const AC = window.AudioContext || window.webkitAudioContext, ctx = new AC(); try { await ctx.resume(); } catch { /* later */ } const an = ctx.createAnalyser(); an.fftSize = 1024; ctx.createMediaStreamSource(stream).connect(an); const buf = new Float32Array(an.fftSize);
      const s = (this.sp = { svc: true, on: true, stream, ctx, rec: null, chunks: [], speaking: 0, quiet: 0, started: 0, busy: Promise.resolve() }); ok();
      const send = (blob) => { s.busy = s.busy.then(async () => { if (!s.on || blob.size < 600) return; try { const fd = new FormData(); fd.append('file', blob, 'speech.webm'); fd.append('model', A.speechModel || 'whisper-1'); fd.append('response_format', 'json'); const lg = String(lang || '').split('-')[0]; if (lg) fd.append('language', lg);
        const res = await fetch(url, { method: 'POST', headers: A.speechKey ? { authorization: 'Bearer ' + A.speechKey } : {}, body: fd }); if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 120)); const j = await res.json(); const text = String(j.text || '').trim(); if (text) this.post('speech', { text, final: true, conf: 1 });
      } catch (e) { this.post('speech-state', { state: 'error', error: 'speech service: ' + (e && e.message || e) + ' (check the address / key in Settings → Voice commands; the service must allow browser requests – CORS)' }); } }); };
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const begin = () => { s.chunks = []; const rec = (s.rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)); rec.ondataavailable = (e) => { if (e.data && e.data.size) s.chunks.push(e.data); }; rec.onstop = () => { const b = new Blob(s.chunks, { type: rec.mimeType || 'audio/webm' }); s.chunks = []; send(b); }; rec.start(); s.started = performance.now(); };
      this.post('speech-state', { state: 'listening', via: 'service' });
      s.timer = setInterval(() => { if (!s.on) return; an.getFloatTimeDomainData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]; const rms = Math.sqrt(sum / buf.length), now = performance.now(), loud = rms > 0.02;
        if (loud) { s.quiet = 0; if (!s.rec || s.rec.state === 'inactive') begin(); } else if (s.rec && s.rec.state === 'recording') { s.quiet += 50; if (s.quiet > 700) { s.rec.stop(); s.quiet = 0; } }
        if (s.rec && s.rec.state === 'recording' && now - s.started > 9000) { s.rec.stop(); } }, 50);
    }
    speechStop() { const s = this.sp; if (!s) return; s.on = false; try { s.r && s.r.abort(); } catch { /* idle */ } if (s.svc) { clearInterval(s.timer); try { s.rec && s.rec.state === 'recording' && s.rec.stop(); } catch { /* idle */ } try { s.stream.getTracks().forEach((t) => t.stop()); } catch { /* gone */ } try { s.ctx.close(); } catch { /* gone */ } } this.sp = null; }
    destroy() { this.micStop(); this.camStop(); this.speechStop(); }
  }
  VX.SenseHost = SenseHost;
})();
