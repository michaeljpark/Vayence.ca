// Releases admin API (Vercel function), used by admin.html.
//   GET  /api/posts                      → { clientId, admin, posts }   (public)
//   POST /api/posts { action: 'save', post, image? } | { action: 'delete', slug }
// Writes need a Google ID token for ADMIN_EMAIL. Each change is a single commit to GitHub:
// posts.json, the regenerated release pages, lists and sitemap, plus any uploaded image.
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
  const pages = {};
  for (const f of LIST_PAGES) pages[f] = await readFile(f, head);
  const releases = (await gh('/contents/releases?ref=' + head)).map((f) => f.path);
  return { head, tree, posts, pages, releases };
}
async function commit(snap, posts, image, message) {
  const files = build(posts, snap.pages);
  files[DATA] = JSON.stringify(posts, null, 2) + '\n';
  const entries = Object.keys(files).map((path) => ({ path, mode: '100644', type: 'blob', content: files[path] }));
  snap.releases.filter((p) => p.endsWith('.html') && !files[p])
    .forEach((path) => entries.push({ path, mode: '100644', type: 'blob', sha: null }));
  if (image) {
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

function slugify(title, date, taken) {
  const base = title.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 70).replace(/-$/, '') || 'post-' + date;
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = base + '-' + n;
  return slug;
}

// Builds the stored post from the editor's fields; fields the editor doesn't show (videos, links,
// imagePosition) carry over from the existing post.
function cleanPost(input, existing, taken) {
  const post = Object.assign({}, existing || {});
  post.title = str(input.title, 200);
  post.category = CATEGORIES.indexOf(input.category) !== -1 ? input.category : 'Newsletter';
  post.date = /^\d{4}-\d{2}-\d{2}$/.test(input.date) && !isNaN(Date.parse(input.date)) ? input.date : '';
  post.excerpt = str(input.excerpt, 400);
  post.body = (Array.isArray(input.body) ? input.body : []).map((p) => str(p, 5000)).filter(Boolean);
  if (!post.title || !post.date || !post.excerpt || !post.body.length) throw fail(400, 'Title, date, summary and body are required.');
  const [y, mo, d] = post.date.split('-').map(Number);
  post.dateLabel = str(input.dateLabel, 40) || MONTHS[mo - 1] + ' ' + d + ', ' + y;
  if (!existing) post.slug = slugify(post.title, post.date, taken);
  post.imageAlt = str(input.imageAlt, 300);
  if (!post.image) post.image = FALLBACK_IMAGE;

  const src = input.source || {};
  if (httpUrl(src.url)) {
    post.source = { name: str(src.name, 100) || new URL(src.url).hostname.replace(/^www\./, ''), url: httpUrl(src.url) };
    if (existing && existing.source && existing.source.cta && existing.source.url === post.source.url) post.source.cta = existing.source.cta;
  } else delete post.source;
  const q = input.quote || {};
  if (str(q.text, 1000)) post.quote = { text: str(q.text, 1000), cite: str(q.cite, 200) };
  else delete post.quote;

  // key order as in the hand-written posts, so diffs stay readable
  const order = ['slug', 'category', 'date', 'dateLabel', 'title', 'excerpt', 'image', 'imageAlt', 'imagePosition', 'body', 'quote', 'source', 'links', 'videos'];
  const sorted = {};
  order.concat(Object.keys(post)).forEach((k) => { if (post[k] !== undefined && !(k in sorted)) sorted[k] = post[k]; });
  return sorted;
}

function decodeImage(dataUrl, slug) {
  if (!dataUrl) return null;
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
  if (!m) throw fail(400, 'Images must be JPEG, PNG or WebP.');
  if (m[2].length > 4 * 1024 * 1024) throw fail(413, 'That image is too large. Try one under 3 MB.');
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  return { base64: m[2], path: 'assets/img/releases/' + slug + '-' + Date.now().toString(36) + '.' + ext };
}

// ---------- Handler ----------
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!process.env.GITHUB_TOKEN) throw fail(500, 'The site is missing its GITHUB_TOKEN setting.');
    if (req.method === 'GET') {
      const snap = await snapshot();
      return res.status(200).json({ clientId: CLIENT_ID, admin: ADMIN_EMAIL, posts: snap.posts });
    }
    if (req.method !== 'POST') throw fail(405, 'Method not allowed.');

    const email = await verifyAdmin(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const snap = await snapshot();
    let posts = snap.posts.slice();
    let image = null;
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
      image = decodeImage(body.image, post.slug);
      if (image) post.image = image.path;
      posts = existing ? posts.map((p) => (p === existing ? post : p)) : posts.concat(post);
      // newest first; posts with the same date keep their order
      posts = posts.map((p, i) => [p, i]).sort((a, b) => (b[0].date > a[0].date) - (b[0].date < a[0].date) || a[1] - b[1]).map((x) => x[0]);
      message = 'Releases: ' + (existing ? 'update' : 'add') + ' “' + post.title + '”';
    } else {
      throw fail(400, 'Unknown action.');
    }

    await commit(snap, posts, image, message + '\n\nEdited by ' + email + ' on the site admin page.');
    return res.status(200).json({ ok: true, posts });
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error(e);
    const message = status === 409 ? 'The site changed while you were editing. Reload and try again.'
      : status >= 500 && /^GitHub/.test(e.message) ? 'Saving to GitHub failed. Check the GITHUB_TOKEN setting.' : e.message;
    return res.status(status).json({ error: message });
  }
};
