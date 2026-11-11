/* Vextra blocks – Bluetooth (5). Talks to Bluetooth Low Energy (BLE) devices through the Web Bluetooth API: heart-rate belts, sensors, LEDs, toys, micro:bit …
 * The browser always shows its own device picker, so Connect has to be triggered by a click / key / touch. Unsupported browsers (Safari, Firefox) send "error". */
(function () {
  const VXRT = window.VXRT, U = VXRT.util, B = VXRT.registerBlock, P = VXRT.P;
  const fail = (n, g, e) => { const m = (e && e.message) || String(e); g.send(n, 'error', m); try { g.log('warn', '[bluetooth] ' + m); } catch { /* no log */ } };
  const BT = () => (typeof navigator !== 'undefined' ? navigator.bluetooth : null);
  /** Shared connection table per game: key (the "Device name" you type on every Bluetooth block) -> { dev, server, chars }. */
  const table = (g) => (g._bt || (g._bt = {}));
  const keyOf = (n) => String(n.p.device || 'device1').trim() || 'device1';
  /** Short names (battery, heart_rate …) pass through; 4-hex-digit ids become numbers; full UUIDs stay text. */
  const uuid = (s) => { s = String(s || '').trim().toLowerCase(); return /^(0x)?[0-9a-f]{4}$/.test(s) ? parseInt(s.replace('0x', ''), 16) : s; };
  const bytes = (dv) => Array.from(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength));
  /** Turns raw bytes into what the player asked for. */
  const decode = (dv, fmt) => {
    const b = bytes(dv);
    switch (fmt) {
      case 'text': return new TextDecoder().decode(dv);
      case 'u8': return dv.byteLength >= 1 ? dv.getUint8(0) : 0;
      case 'u16': return dv.byteLength >= 2 ? dv.getUint16(0, true) : 0;
      case 'i16': return dv.byteLength >= 2 ? dv.getInt16(0, true) : 0;
      case 'f32': return dv.byteLength >= 4 ? Math.round(dv.getFloat32(0, true) * 1000) / 1000 : 0;
      case 'heart': { const w16 = b[0] & 1; return w16 ? dv.getUint16(1, true) : b[1] || 0; }
      case 'hex': return b.map((x) => x.toString(16).padStart(2, '0')).join(' ');
      default: return b.join(', ');
    }
  };
  const encode = (v, fmt) => {
    if (fmt === 'text') return new TextEncoder().encode(U.str(v));
    if (fmt === 'u8') return Uint8Array.of(U.num(v) & 255);
    if (fmt === 'u16') { const a = new DataView(new ArrayBuffer(2)); a.setUint16(0, U.num(v) & 65535, true); return new Uint8Array(a.buffer); }
    const list = Array.isArray(v) ? v : String(v ?? '').split(/[\s,;]+/).filter(Boolean);
    return Uint8Array.from(list.map((x) => { const s = String(x); return (fmt === 'hex' ? parseInt(s, 16) : U.num(s)) & 255; }));
  };
  const FMT_IN = [['bytes', 'Bytes (1, 2, 3)'], ['text', 'Text'], ['u8', 'Number 0–255'], ['u16', 'Number 0–65535'], ['hex', 'Hex bytes (0a ff)']];
  const FMT_OUT = [['bytes', 'Bytes (1, 2, 3)'], ['u8', 'Number 0–255'], ['u16', 'Number 0–65535'], ['i16', 'Signed number'], ['f32', 'Decimal number'], ['text', 'Text'], ['heart', 'Heart rate (bpm)'], ['hex', 'Hex bytes']];
  const DEV = P.text('device', 'Device name', 'device1', { hint: 'Any name – use the same on blocks that share a device' });
  const SVC = P.text('service', 'Service', 'battery_service', { hint: 'battery_service · heart_rate · 0xFFE0 · full UUID' });
  const CHR = P.text('char', 'Characteristic', 'battery_level', { hint: 'battery_level · heart_rate_measurement · 0xFFE1 …' });
  const chr = async (n, g) => {
    const c = table(g)[keyOf(n)]; if (!c || !c.server || !c.server.connected) throw new Error('Not connected – use Bluetooth Connect first (device "' + keyOf(n) + '")');
    const ck = n.p.service + '|' + n.p.char; if (c.chars[ck]) return c.chars[ck];
    const s = await c.server.getPrimaryService(uuid(n.p.service)); return (c.chars[ck] = await s.getCharacteristic(uuid(n.p.char)));
  };

  B({ id: 'bluetoothConnect', cat: 'mobile', label: 'Bluetooth Connect', desc: 'Connects to a Bluetooth Low Energy device. The browser shows its device picker (so trigger this from a click, key or touch – not "Always"). List the services you will use (one per line, e.g. battery_service / heart_rate); optionally filter by name prefix. "connected" sends the device name, "disconnected" fires when it drops or you send "disconnect". "name" also gets the device name. Works in Chrome, Edge, Opera and Android; not in Safari / iOS or Firefox – those send "error".',
    inputs: ['connect', 'disconnect'], outputs: ['connected', 'disconnected', 'name', 'error'],
    params: [DEV, P.area('services', 'Services (one per line)', 'battery_service', { hint: 'battery_service · heart_rate · 0xFFE0' }), P.text('prefix', 'Name starts with', '', { hint: 'Empty = show every device' })],
    init(n, g) { n.cleanups.push(() => { const c = table(g)[keyOf(n)]; if (c && c.dev && c.dev.gatt && c.dev.gatt.connected) { try { c.dev.gatt.disconnect(); } catch { /* gone */ } } delete table(g)[keyOf(n)]; }); },
    async onInput(n, port, v, g) {
      const key = keyOf(n);
      if (port === 'disconnect') { const c = table(g)[key]; if (c && c.dev && c.dev.gatt) c.dev.gatt.disconnect(); return; }
      try {
        const bt = BT(); if (!bt) throw new Error('Bluetooth is not available here (needs Chrome, Edge or Android, over https or localhost)');
        const svc = String(n.p.services || '').split(/[\n,]+/).map((s) => s.trim()).filter(Boolean).map(uuid);
        const opt = { optionalServices: svc }; if (String(n.p.prefix || '').trim()) opt.filters = [{ namePrefix: String(n.p.prefix).trim() }]; else opt.acceptAllDevices = true;
        const dev = await bt.requestDevice(opt), server = await dev.gatt.connect();
        table(g)[key] = { dev, server, chars: {} };
        dev.addEventListener('gattserverdisconnected', () => { delete table(g)[key]; g.send(n, 'disconnected', dev.name || dev.id); });
        g.send(n, 'name', dev.name || dev.id); g.send(n, 'connected', dev.name || dev.id);
      } catch (e) { fail(n, g, e); }
    } });

  B({ id: 'bluetoothRead', cat: 'mobile', label: 'Bluetooth Read', desc: 'Reads one value from a connected device (battery level, a sensor …). Pick how the bytes become a result: a number, text, decimal, heart rate, or the raw bytes. "out" gets the result; "bytes" always gets the raw byte list.',
    inputs: ['in'], outputs: ['out', 'bytes', 'error'], params: [DEV, SVC, CHR, P.sel('format', 'Result as', FMT_OUT, 'u8')],
    async onInput(n, port, v, g) { try { const dv = await (await chr(n, g)).readValue(); g.send(n, 'bytes', bytes(dv)); g.send(n, 'out', decode(dv, n.p.format)); } catch (e) { fail(n, g, e); } } });

  B({ id: 'bluetoothWrite', cat: 'mobile', label: 'Bluetooth Write', desc: 'Sends the incoming value to a connected device (switch an LED, set a motor speed …). Choose how it is packed: bytes, text, a number or hex bytes. "done" fires when the device accepted it.',
    inputs: ['in'], outputs: ['done', 'error'], params: [DEV, SVC, CHR, P.sel('format', 'Send as', FMT_IN, 'u8'), P.bool('noResponse', 'Without response (faster)', false)],
    async onInput(n, port, v, g) { try { const c = await chr(n, g), d = encode(v, n.p.format); if (n.p.noResponse && c.writeValueWithoutResponse) await c.writeValueWithoutResponse(d); else await c.writeValue(d); g.send(n, 'done', v); } catch (e) { fail(n, g, e); } } });

  B({ id: 'bluetoothNotify', cat: 'mobile', label: 'Bluetooth Notify', desc: 'Listens for values the device pushes by itself (heart rate, button presses, sensor streams). Send "start" to subscribe, "stop" to unsubscribe (or tick Auto start). Every update goes to "out" in the chosen format, raw bytes to "bytes".',
    inputs: ['start', 'stop'], outputs: ['out', 'bytes', 'started', 'error'], params: [DEV, P.text('service', 'Service', 'heart_rate'), P.text('char', 'Characteristic', 'heart_rate_measurement'), P.sel('format', 'Result as', FMT_OUT, 'heart'), P.bool('auto', 'Auto start when connected', false)],
    init(n, g) { n.st.fn = (e) => { const dv = e.target.value; g.send(n, 'bytes', bytes(dv)); g.send(n, 'out', decode(dv, n.p.format)); }; n.cleanups.push(() => { if (n.st.c) { try { n.st.c.removeEventListener('characteristicvaluechanged', n.st.fn); n.st.c.stopNotifications(); } catch { /* gone */ } } }); },
    update(n, dt, g) { const k = table(g)[keyOf(n)]; if (n.st.c && !(k && k.server && k.server.connected)) n.st.c = null; if (n.p.auto && !n.st.c && !n.st.busy) { const c = table(g)[keyOf(n)]; if (c && c.server && c.server.connected) this.onInput(n, 'start', null, g); } },
    async onInput(n, port, v, g) {
      n.st.busy = true;
      try {
        if (port === 'stop') { if (n.st.c) { n.st.c.removeEventListener('characteristicvaluechanged', n.st.fn); await n.st.c.stopNotifications(); n.st.c = null; } return; }
        if (n.st.c) return;
        const c = await chr(n, g); await c.startNotifications(); c.addEventListener('characteristicvaluechanged', n.st.fn); n.st.c = c; g.send(n, 'started', true);
      } catch (e) { fail(n, g, e); } finally { n.st.busy = false; }
    } });
})();
