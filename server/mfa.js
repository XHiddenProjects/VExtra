'use strict';
/* Two-step sign-in for Vextra accounts: authenticator-app codes (TOTP, RFC 6238), one-time recovery codes and
   security keys / passkeys (WebAuthn, attestation "none", ES256 + RS256 not needed: keys using ES256 are accepted). Dependency-free. */
const crypto = require('crypto');

/* ---------- base32 + TOTP ---------- */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32enc = (buf) => { let bits = '', out = ''; for (const b of buf) bits += b.toString(2).padStart(8, '0'); for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]; return out; };
const b32dec = (s) => { let bits = ''; for (const c of String(s).toUpperCase().replace(/[^A-Z2-7]/g, '')) bits += B32.indexOf(c).toString(2).padStart(5, '0'); const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); };
const newSecret = () => b32enc(crypto.randomBytes(20));
function hotp(secret, counter) { const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(counter)); const h = crypto.createHmac('sha1', b32dec(secret)).update(buf).digest(); const o = h[19] & 15; return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0'); }
/** returns the matched time step (so one code cannot be used twice) or -1 */
function checkTotp(secret, code, lastStep = -1, now = Date.now()) {
  code = String(code || '').replace(/\s/g, ''); if (!/^\d{6}$/.test(code)) return -1; const step = Math.floor(now / 30000);
  for (const d of [0, -1, 1]) { const s = step + d; if (s <= lastStep) continue; const a = Buffer.from(hotp(secret, s)), b = Buffer.from(code); if (crypto.timingSafeEqual(a, b)) return s; } return -1;
}
const otpUri = (user, secret) => `otpauth://totp/Vextra:${encodeURIComponent(user)}?secret=${secret}&issuer=Vextra&algorithm=SHA1&digits=6&period=30`;
const newRecovery = (n = 8) => Array.from({ length: n }, () => { const r = crypto.randomBytes(5).toString('hex'); return r.slice(0, 5) + '-' + r.slice(5); });
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

/* ---------- minimal CBOR (enough for WebAuthn attestation objects and COSE keys) ---------- */
function cbor(buf, o = { i: 0 }) {
  const rd = () => { const b = buf[o.i++]; const mt = b >> 5; let ai = b & 31; let v = ai;
    if (ai === 24) v = buf[o.i++]; else if (ai === 25) { v = buf.readUInt16BE(o.i); o.i += 2; } else if (ai === 26) { v = buf.readUInt32BE(o.i); o.i += 4; } else if (ai === 27) { v = Number(buf.readBigUInt64BE(o.i)); o.i += 8; } else if (ai > 27) throw new Error('bad cbor'); return [mt, v]; };
  const [mt, v] = rd();
  switch (mt) { case 0: return v; case 1: return -1 - v; case 2: { const r = buf.subarray(o.i, o.i + v); o.i += v; return Buffer.from(r); } case 3: { const r = buf.toString('utf8', o.i, o.i + v); o.i += v; return r; }
    case 4: return Array.from({ length: v }, () => cbor(buf, o)); case 5: { const m = new Map(); for (let k = 0; k < v; k++) { const key = cbor(buf, o); m.set(key, cbor(buf, o)); } return m; } default: throw new Error('unsupported cbor'); }
}
const b64u = (b) => Buffer.from(b).toString('base64url');
const fromB64u = (s) => Buffer.from(String(s), 'base64url');

/** Verifies a registration; returns { id, pub (SPKI DER base64), counter } or throws */
function verifyRegistration({ attestationObject, clientDataJSON, credentialId }, { challenge, origin, rpId }) {
  const cd = JSON.parse(fromB64u(clientDataJSON).toString('utf8')); if (cd.type !== 'webauthn.create') throw new Error('Wrong request type'); if (cd.challenge !== challenge) throw new Error('Challenge mismatch'); if (cd.origin !== origin) throw new Error('Origin mismatch');
  const att = cbor(fromB64u(attestationObject)); const auth = att.get('authData'); if (!Buffer.isBuffer(auth) || auth.length < 55) throw new Error('Bad authenticator data');
  if (!auth.subarray(0, 32).equals(crypto.createHash('sha256').update(rpId).digest())) throw new Error('Relying party mismatch'); if (!(auth[32] & 1)) throw new Error('User presence missing'); if (!(auth[32] & 64)) throw new Error('No credential data');
  const idLen = auth.readUInt16BE(53), id = auth.subarray(55, 55 + idLen); const cose = cbor(auth.subarray(55 + idLen)); if (cose.get(3) !== -7 || cose.get(1) !== 2 || cose.get(-1) !== 1) throw new Error('Only ES256 (P-256) keys are supported');
  const jwk = { kty: 'EC', crv: 'P-256', x: b64u(cose.get(-2)), y: b64u(cose.get(-3)) }; const pub = crypto.createPublicKey({ key: jwk, format: 'jwk' }).export({ type: 'spki', format: 'der' }).toString('base64');
  if (credentialId && b64u(id) !== credentialId) throw new Error('Credential id mismatch'); return { id: b64u(id), pub, counter: auth.readUInt32BE(33) };
}
/** Verifies a sign-in assertion against a stored key; returns the new counter or throws */
function verifyAssertion({ authenticatorData, clientDataJSON, signature }, key, { challenge, origin, rpId }) {
  const cdRaw = fromB64u(clientDataJSON), cd = JSON.parse(cdRaw.toString('utf8')); if (cd.type !== 'webauthn.get') throw new Error('Wrong request type'); if (cd.challenge !== challenge) throw new Error('Challenge mismatch'); if (cd.origin !== origin) throw new Error('Origin mismatch');
  const ad = fromB64u(authenticatorData); if (ad.length < 37 || !ad.subarray(0, 32).equals(crypto.createHash('sha256').update(rpId).digest())) throw new Error('Relying party mismatch'); if (!(ad[32] & 1)) throw new Error('User presence missing');
  const data = Buffer.concat([ad, crypto.createHash('sha256').update(cdRaw).digest()]); const pk = crypto.createPublicKey({ key: Buffer.from(key.pub, 'base64'), format: 'der', type: 'spki' });
  if (!crypto.verify('sha256', data, pk, fromB64u(signature))) throw new Error('Signature check failed'); const counter = ad.readUInt32BE(33); if (counter !== 0 && key.counter && counter <= key.counter) throw new Error('This key looks cloned (counter went backwards)'); return counter;
}
module.exports = { newSecret, checkTotp, otpUri, newRecovery, sha, verifyRegistration, verifyAssertion, b64u };
