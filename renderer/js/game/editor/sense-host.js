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
  const why = (e, k) => (WHY[e && e.name] ? WHY[e.name](k) : 'The ' + k + ' could not be started: ' + ((e && (e.message || e.name)) || e));

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
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing || 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.srcObject = stream; v.style.cssText = 'position:fixed;left:-9999px;width:2px;height:2px'; document.body.append(v); try { await v.play(); } catch { /* autoplay */ }
      await new Promise((res) => { if (v.readyState >= 2) res(); else { v.onloadeddata = res; setTimeout(res, 3000); } });
      const c = (this.cam = { stream, v, on: true, w: v.videoWidth || 640, h: v.videoHeight || 480, busy: false, t: 0 });
      const cv = document.createElement('canvas'), W = 480, H = Math.max(1, Math.round(W * c.h / c.w)); cv.width = W; cv.height = H; const cx = cv.getContext('2d');
      const loop = (t) => { if (!c.on) return; c.raf = requestAnimationFrame(loop); if (t - c.t < 33 || c.busy || v.readyState < 2) return; c.t = t; c.busy = true; cx.drawImage(v, 0, 0, W, H); createImageBitmap(cv).then((b) => { c.busy = false; if (!c.on) { b.close(); return; } this.post('cam', { bmp: b, w: c.w, h: c.h }, [b]); }).catch(() => { c.busy = false; }); };
      c.raf = requestAnimationFrame(loop); return { w: c.w, h: c.h };
    }
    camStop() { const c = this.cam; if (!c) return; c.on = false; cancelAnimationFrame(c.raf); try { c.stream.getTracks().forEach((t) => t.stop()); } catch { /* gone */ } c.v.remove(); this.cam = null; }
    speechStart(lang, interim, ok, bad) {
      this.speechStop(); const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return bad('Speech recognition is not built into this window (the desktop app\'s web engine has none). Use the "say" entry or Test keys, or play the game in Chrome / Edge / Safari.');
      const r = new SR(), h = (this.sp = { r, on: true }); r.lang = lang || 'en-US'; r.continuous = true; r.interimResults = !!interim;
      r.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) { const x = e.results[i]; this.post('speech', { text: String(x[0].transcript || '').trim(), final: x.isFinal, conf: x[0].confidence }); } };
      r.onerror = (e) => { if (e.error === 'no-speech' || e.error === 'aborted') return; if (e.error !== 'network') h.on = false; this.post('speech-state', { state: 'error', error: e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'blocked – allow the microphone / speech service' : e.error === 'network' ? 'needs an internet connection (the browser sends speech to its recognition service)' : e.error }); };
      r.onend = () => { if (h.on) setTimeout(() => { try { r.start(); } catch { /* running */ } }, 250); }; r.onstart = () => this.post('speech-state', { state: 'listening' });
      try { r.start(); ok(); } catch (e) { bad('Speech recognition: ' + e.message); }
    }
    speechStop() { const s = this.sp; if (!s) return; s.on = false; try { s.r.abort(); } catch { /* idle */ } this.sp = null; }
    destroy() { this.micStop(); this.camStop(); this.speechStop(); }
  }
  VX.SenseHost = SenseHost;
})();
