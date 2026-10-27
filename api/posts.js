// Releases admin API (Vercel function), used by admin.html.
//   GET  /api/posts                      → { clientId, admin, posts, site }   (public)
//   POST /api/posts { action: 'save', post, image? } | { action: 'delete', slug }
//                 | { action: 'settings', site }   (page text: Releases headings, contact "I am a" options)
//        (image is a new cover as a data URL; new images inside the body come as body blocks)
// Writes need a Google ID token for ADMIN_EMAIL. Each change is a single commit to GitHub:
// posts.json, the regenerated release pages, lists and sitemap, plus any uploaded images.
// Vercel deploys that commit like any other push.
//
// Environment variables (Vercel → Settings → Environment Variables):
//   GOOGLE_CLIENT_ID   OAuth web client ID from Google Cloud
//   GITHUB_TOKEN       fine-grained token with Contents: read and write on the repo
//   ADMIN_EMAIL        optional, defaults to theproactiveproject@gmail.com
//   GITHUB_REPO        optional, defaults to michaeljpark/Vayence.ca
//   GITHUB_BRANCH      optional, defaults to main
const { build, LIST_PAGES } = require('../scripts/build-releases.js');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'theproactiveproject@gmail.com').toLowerCase();
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const REPO = process.env.GITHUB_REPO || 'michaeljpark/Vayence.ca';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const DATA = 'assets/data/posts.json';
const SITE_DATA = 'assets/data/site.json';
const CATEGORIES = ['Awards', 'Updates', 'Newsletter'];
const FALLBACK_IMAGE = 'assets/img/og-image.jpg';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// ---------- Google sign-in ----------
async function verifyAdmin(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) throw fail(401, 'Please sign in.');
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(m[1]));
  if (!r.ok) throw fail(401, 'Your sign-in has expired. Please sign in again.');
  const t = await r.json();
  const issuer = t.iss === 'accounts.google.com' || t.iss === 'https://accounts.google.com';
  const verified = t.email_verified === true || t.email_verified === 'true';
  if (!CLIENT_ID || t.aud !== CLIENT_ID || !issuer || Number(t.exp) * 1000 < Date.now()) {
    throw fail(401, 'Your sign-in has expired. Please sign in again.');
  }
  if (!verified || String(t.email).toLowerCase() !== ADMIN_EMAIL) throw fail(403, 'This Google account can’t edit releases.');
  return t.email;
}

// ---------- GitHub ----------
async function gh(path, options) {
  const opts = options || {};
  const r = await fetch('https://api.github.com/repos/' + REPO + path, {
    method: opts.method || 'GET',
    headers: {
      Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'vayence-admin',
      'Content-Type': 'application/json'
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (!r.ok) {
    const e = fail(502, 'GitHub ' + r.status + ' on ' + path + ': ' + (await r.text()).slice(0, 300));
    e.github = r.status;
    throw e;
  }
  return r.json();
}
async function readFile(path, ref) {
  const f = await gh('/contents/' + path + '?ref=' + ref);
  return Buffer.from(f.content, 'base64').toString('utf8');
}
async function snapshot() {
  const head = (await gh('/git/ref/heads/' + BRANCH)).object.sha;
  const tree = (await gh('/git/commits/' + head)).tree.sha;
  const posts = JSON.parse(await readFile(DATA, head));
  const site = JSON.parse(await readFile(SITE_DATA, head));
  const pages = {};
  for (const f of LIST_PAGES) pages[f] = await readFile(f, head);
  const releases = (await gh('/contents/releases?ref=' + head)).map((f) => f.path);
  return { head, tree, posts, site, pages, releases };
}
async function commit(snap, posts, site, images, message) {
  const files = build(posts, snap.pages, site);
  files[DATA] = JSON.stringify(posts, null, 2) + '\n';
  files[SITE_DATA] = JSON.stringify(site, null, 2) + '\n';
  const entries = Object.keys(files).map((path) => ({ path, mode: '100644', type: 'blob', content: files[path] }));
  snap.releases.filter((p) => p.endsWith('.html') && !files[p])
    .forEach((path) => entries.push({ path, mode: '100644', type: 'blob', sha: null }));
  for (const image of images) {
    const blob = await gh('/git/blobs', { method: 'POST', body: { content: image.base64, encoding: 'base64' } });
    entries.push({ path: image.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const tree = await gh('/git/trees', { method: 'POST', body: { base_tree: snap.tree, tree: entries } });
  const c = await gh('/git/commits', { method: 'POST', body: { message, tree: tree.sha, parents: [snap.head] } });
  // not forced: if someone pushed meanwhile this fails and the editor asks to try again
  try {
    await gh('/git/refs/heads/' + BRANCH, { method: 'PATCH', body: { sha: c.sha, force: false } });
  } catch (e) {
    throw e.github === 422 ? fail(409, 'Branch moved') : e;
  }
}

// ---------- Post input ----------
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const httpUrl = (v) => { const s = str(v, 500); return /^https?:\/\/\S+$/i.test(s) ? s : ''; };

// Vimeo / YouTube page or player links → the player URL the post page embeds
function embedUrl(raw) {
  const s = str(raw, 500);
  let m = /^https:\/\/player\.vimeo\.com\/video\/(\d+)(?:\?(?:.*&)?h=(\w+))?/.exec(s) ||
    /^https?:\/\/(?:www\.)?vimeo\.com\/(?:(?:showcase|channels)\/\w+\/(?:video\/)?)?(\d+)(?:\/(\w+))?/.exec(s);
  if (m) return 'https://player.vimeo.com/video/' + m[1] + (m[2] ? '?h=' + m[2] : '');
  m = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/|youtube-nocookie\.com\/embed\/)([\w-]{11})/.exec(s);
  return m ? 'https://www.youtube-nocookie.com/embed/' + m[1] : '';
}

function slugify(title, date, taken) {
  const base = title.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 70).replace(/-$/, '') || 'post-' + date;
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = base + '-' + n;
  return slug;
}

// Body blocks from the editor (see scripts/build-releases.js for the format). Plain paragraphs are
// stored as strings, like the hand-written posts. New images arrive as { type: 'image', upload: dataURL }.
function cleanRuns(runs) {
  const out = [];
  (Array.isArray(runs) ? runs : []).slice(0, 500).forEach((r) => {
    if (!r || typeof r.text !== 'string' || !r.text) return;
    const run = { text: r.text.slice(0, 10000) };
    if (r.b) run.b = true;
    if (r.i) run.i = true;
    const href = typeof r.href === 'string' ? r.href.trim() : '';
    if (/^(https?:\/\/|mailto:)\S+$/i.test(href)) run.href = href.slice(0, 500);
    const last = out[out.length - 1];
    if (last && !last.b === !run.b && !last.i === !run.i && last.href === run.href) last.text += run.text;
    else out.push(run);
  });
  // trim the ends; drop blocks that are only whitespace
  if (out.length) {
    out[0].text = out[0].text.replace(/^\s+/, '');
    out[out.length - 1].text = out[out.length - 1].text.replace(/\s+$/, '');
  }
  return out.filter((r) => r.text);
}
const plain = (runs) => runs.length === 1 && !runs[0].b && !runs[0].i && !runs[0].href && !/\n/.test(runs[0].text);

function cleanBody(body) {
  const out = [];
  (Array.isArray(body) ? body : []).slice(0, 300).forEach((b) => {
    if (typeof b === 'string') { if (b.trim()) out.push(b.trim().slice(0, 10000)); return; }
    if (!b || typeof b !== 'object') return;
    if (b.type === 'image') {
      const img = { type: 'image', src: '', alt: str(b.alt, 300), caption: str(b.caption, 300) };
      if (b.upload) img.upload = String(b.upload);
      else if (/^assets\/img\/[\w\/.-]+\.(jpe?g|png|webp|gif)$/i.test(b.src || '') && !/\.\./.test(b.src)) img.src = b.src;
      else return;
      if (!img.caption) delete img.caption;
      out.push(img);
    } else if (b.type === 'ul' || b.type === 'ol') {
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 200).map(cleanRuns).filter((r) => r.length);
      if (items.length) out.push({ type: b.type, items });
    } else {
      const runs = cleanRuns(b.runs);
      if (!runs.length) return;
      const type = ['h2', 'h3', 'quote'].indexOf(b.type) !== -1 ? b.type : 'p';
      out.push(type === 'p' && plain(runs) ? runs[0].text : { type, runs });
    }
  });
  return out;
}

// Builds the stored post from the editor's fields; fields the editor doesn't show (videos, links,
// imagePosition) carry over from the existing post.
function cleanPost(input, existing, taken) {
  const post = Object.assign({}, existing || {});
  post.title = str(input.title, 200);
  post.category = CATEGORIES.indexOf(input.category) !== -1 ? input.category : 'Newsletter';
  post.date = /^\d{4}-\d{2}-\d{2}$/.test(input.date) && !isNaN(Date.parse(input.date)) ? input.date : '';
  post.excerpt = str(input.excerpt, 400);
  post.body = cleanBody(input.body);
  if (!post.title || !post.date || !post.excerpt || !post.body.length) throw fail(400, 'Title, date, summary and body are required.');
  const [y, mo, d] = post.date.split('-').map(Number);
  post.dateLabel = str(input.dateLabel, 40) || MONTHS[mo - 1] + ' ' + d + ', ' + y;
  if (!existing) post.slug = slugify(post.title, post.date, taken);
  post.imageAlt = str(input.imageAlt, 300);
  if (!post.image) post.image = FALLBACK_IMAGE;

  const src = input.source || {};
  if (httpUrl(src.url)) {
    const prev = (existing && existing.source) || {};
    post.source = { name: str(src.name, 100) || new URL(src.url).hostname.replace(/^www\./, '') };
    // a custom button label ("Watch the series on Vimeo") stays while the link does
    if (prev.cta && prev.url === httpUrl(src.url)) post.source.cta = prev.cta;
    post.source.url = httpUrl(src.url);
  } else delete post.source;
  if (Array.isArray(input.links)) {
    const links = input.links.slice(0, 20).map((l) => {
      const url = httpUrl(l && l.url);
      if (!url) throw fail(400, 'Each link needs a web address starting with https:// (“' + str(l && l.label, 60) + '”).');
      return { label: str(l.label, 200) || new URL(url).hostname.replace(/^www\./, ''), url };
    });
    if (links.length) post.links = links;
    else delete post.links;
  }
  if (Array.isArray(input.videos)) {
    const old = (existing && existing.videos) || [];
    const videos = input.videos.slice(0, 12).map((v) => {
      const embed = embedUrl(v && (v.url || v.embed));
      if (!embed) throw fail(400, 'Videos must be Vimeo or YouTube links (“' + str(v && v.title, 60) + '”).');
      const prev = old.find((o) => o.embed === embed) || {};
      const video = { title: str(v.title, 200) || prev.title || 'Video' };
      const duration = str(v.duration, 10);
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(duration)) video.duration = duration;
      if (prev.uploaded) video.uploaded = prev.uploaded;
      video.embed = embed;
      if (prev.thumbnail) video.thumbnail = prev.thumbnail;
      return video;
    });
    if (videos.length) post.videos = videos;
    else delete post.videos;
  }
  const q = input.quote || {};
  if (str(q.text, 1000)) post.quote = { text: str(q.text, 1000), cite: str(q.cite, 200) };
  else delete post.quote;

  // keep an existing post's key order (and the usual order for new ones), so diffs stay readable
  const order = ['slug', 'category', 'date', 'dateLabel', 'title', 'excerpt', 'image', 'imageAlt', 'imagePosition', 'body', 'quote', 'source', 'links', 'videos'];
  const sorted = {};
  Object.keys(existing || {}).concat(order, Object.keys(post))
    .forEach((k) => { if (post[k] !== undefined && !(k in sorted)) sorted[k] = post[k]; });
  return sorted;
}

function decodeImage(dataUrl, slug, n) {
  if (!dataUrl) return null;
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
  if (!m) throw fail(400, 'Images must be JPEG, PNG or WebP.');
  if (m[2].length > 4 * 1024 * 1024) throw fail(413, 'That image is too large. Try one under 3 MB.');
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  return { base64: m[2], path: 'assets/img/releases/' + slug + '-' + Date.now().toString(36) + n + '.' + ext };
}

// Page text from the admin's "Page text" panel; every field but the grey half of the intro is
// required, so no heading can go blank
function cleanSite(input, current) {
  const site = JSON.parse(JSON.stringify(current));
  const r = (input && input.releases) || {};
  const need = (v, max, label) => { const s = str(v, max); if (!s) throw fail(400, label + ' can’t be empty.'); return s; };
  site.releases.title = need(r.title, 60, 'The page title');
  site.releases.lead = need(r.lead, 200, 'The intro');
  site.releases.leadMuted = str(r.leadMuted, 300);
  CATEGORIES.forEach((c) => {
    const sec = (r.sections && r.sections[c]) || {};
    site.releases.sections[c] = {
      heading: need(sec.heading, 120, 'The ' + c + ' heading'),
      empty: need(sec.empty, 200, 'The ' + c + ' “no posts” text')
    };
  });
  const roles = ((input && input.contact && input.contact.roles) || []).map((x) => str(x, 80)).filter(Boolean).slice(0, 15);
  if (!roles.length) throw fail(400, 'Add at least one “I am a” option.');
  site.contact = Object.assign({}, site.contact, { roles });
  return site;
}

// ---------- Handler ----------
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    // names only, never values
    const missing = ['GITHUB_TOKEN', 'GOOGLE_CLIENT_ID'].filter((k) => !(process.env[k] || '').trim());
    if (missing.length) throw fail(500, 'The site is missing these settings: ' + missing.join(', ') + '.');
    if (req.method === 'GET') {
      const snap = await snapshot();
      return res.status(200).json({ clientId: CLIENT_ID, admin: ADMIN_EMAIL, posts: snap.posts, site: snap.site });
    }
    if (req.method !== 'POST') throw fail(405, 'Method not allowed.');

    const email = await verifyAdmin(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const snap = await snapshot();
    let posts = snap.posts.slice();
    let site = snap.site;
    const images = [];
    let message;

    if (body.action === 'delete') {
      const gone = posts.find((p) => p.slug === body.slug);
      if (!gone) throw fail(404, 'That post no longer exists.');
      posts = posts.filter((p) => p !== gone);
      message = 'Releases: delete “' + gone.title + '”';
    } else if (body.action === 'save') {
      const input = body.post || {};
      const existing = input.slug ? posts.find((p) => p.slug === input.slug) : null;
      if (input.slug && !existing) throw fail(404, 'That post no longer exists.');
      const post = cleanPost(input, existing, new Set(posts.map((p) => p.slug)));
      const cover = decodeImage(body.image, post.slug, 'c');
      if (cover) { images.push(cover); post.image = cover.path; }
      post.body.forEach((b, i) => {
        if (b.type !== 'image' || !b.upload) return;
        const img = decodeImage(b.upload, post.slug, i);
        images.push(img);
        b.src = img.path;
        delete b.upload;
      });
      // no cover picked: use the first picture in the body
      const firstPicture = post.body.find((b) => b.type === 'image');
      if (post.image === FALLBACK_IMAGE && firstPicture) {
        post.image = firstPicture.src;
        if (!post.imageAlt) post.imageAlt = firstPicture.alt;
      }
      posts = existing ? posts.map((p) => (p === existing ? post : p)) : posts.concat(post);
      // newest first; posts with the same date keep their order
      posts = posts.map((p, i) => [p, i]).sort((a, b) => (b[0].date > a[0].date) - (b[0].date < a[0].date) || a[1] - b[1]).map((x) => x[0]);
      message = 'Releases: ' + (existing ? 'update' : 'add') + ' “' + post.title + '”';
    } else if (body.action === 'settings') {
      site = cleanSite(body.site, snap.site);
      message = 'Site text: update Releases page and contact options';
    } else {
      throw fail(400, 'Unknown action.');
    }

    await commit(snap, posts, site, images, message + '\n\nEdited by ' + email + ' on the site admin page.');
    return res.status(200).json({ ok: true, posts, site });
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error(e);
    const message = status === 409 ? 'The site changed while you were editing. Reload and try again.'
      : status >= 500 && /^GitHub/.test(e.message) ? 'Saving to GitHub failed. Check the GITHUB_TOKEN setting.' : e.message;
    return res.status(status).json({ error: message });
  }
};
