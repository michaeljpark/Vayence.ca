// Builds the static release pages from assets/data/posts.json (newest first) and fills in the
// editable page text from assets/data/site.json.
// The admin page (admin.html → api/posts.js) runs this on every save; after editing the JSON by hand run:
//   node scripts/build-releases.js
// It writes:
//   - releases/<slug>.html   one crawlable page per release, with its own metadata
//   - index.html, releases.html, about.html   whatever sits between <!-- build:... --> and <!-- /build -->
//   - sitemap.xml
// site.json: releases { title, lead, leadMuted, sections { Awards|Updates|Newsletter: { heading, empty } } },
//   contact { roles [the "I am a" options] }
// Post fields: slug, category ('Awards' | 'Updates' | 'Newsletter'), date (YYYY-MM-DD), dateLabel,
//   title, excerpt, body [blocks], image, imageAlt, imagePosition?
//   A body block is a plain paragraph string, or one of
//     { type: 'p' | 'h2' | 'h3' | 'quote', runs }   { type: 'ul' | 'ol', items: [runs] }
//     { type: 'image', src, alt, caption }
//   where runs = [{ text, b?, i?, href? }] (bold, italic, link)
//   Optional: source {name, url, cta?}, links [{label, url}], quote {text, cite},
//   videos [{title, embed, duration, uploaded, thumbnail}]
const fs = require('fs');
const path = require('path');

const SITE = 'https://www.vayence.ca/';
const LIST_PAGES = ['index.html', 'releases.html', 'about.html'];

// ---------- Markup (shared by the lists and the post pages) ----------
const ICONS = {
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>'
};
const icon = (name) =>
  '<svg class="i" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const href = (p) => 'releases/' + p.slug + '.html';
const when = (p) => esc(p.dateLabel || '');
const img = (p, attrs) =>
  '<img src="' + p.image + '" alt="' + esc(p.imageAlt || '') + '"' + (attrs || '') +
  (p.imagePosition ? ' style="object-position:' + esc(p.imagePosition) + '"' : '') + '>';
// ---------- Post body (written in the admin editor) ----------
const SAFE_HREF = /^(https?:\/\/|mailto:)\S+$/i;
const SAFE_SRC = /^assets\/img\/[\w\/.-]+\.(jpe?g|png|webp|gif)$/i;
const runsHtml = (runs) => (Array.isArray(runs) ? runs : []).map((r) => {
  let h = esc(r.text).replace(/\n/g, '<br>');
  if (r.b) h = '<strong>' + h + '</strong>';
  if (r.i) h = '<em>' + h + '</em>';
  if (r.href && SAFE_HREF.test(r.href)) {
    h = '<a href="' + esc(r.href) + '"' + (/^https?:/i.test(r.href) ? ' target="_blank" rel="noopener"' : '') + '>' + h + '</a>';
  }
  return h;
}).join('');
function blockHtml(b) {
  if (typeof b === 'string') return '<p>' + esc(b) + '</p>';
  switch (b.type) {
    case 'h2': case 'h3': return '<' + b.type + '>' + runsHtml(b.runs) + '</' + b.type + '>';
    case 'ul': case 'ol': return '<' + b.type + '>' + (b.items || []).map((it) => '<li>' + runsHtml(it) + '</li>').join('') + '</' + b.type + '>';
    case 'quote': return '<blockquote class="post-quote">' + runsHtml(b.runs) + '</blockquote>';
    case 'image':
      if (!SAFE_SRC.test(b.src || '') || /\.\./.test(b.src)) return '';
      return '<figure class="post-figure"><img src="' + esc(b.src) + '" alt="' + esc(b.alt || '') + '" loading="lazy">' +
        (b.caption ? '<figcaption>' + esc(b.caption) + '</figcaption>' : '') + '</figure>';
    default: return '<p>' + runsHtml(b.runs) + '</p>';
  }
}

const arrowLink = (url, label) =>
  '<li><a class="text-link" href="' + url + '" target="_blank" rel="noopener">' + esc(label) + '<img src="assets/icons/arrow-ink.svg" width="16" height="16" alt=""></a></li>';

const postCard = (p) =>
  '<a class="post-card" href="' + href(p) + '">' +
    '<figure class="post-card__media">' + img(p, ' loading="lazy"') + '</figure>' +
    '<div class="post-card__body">' +
      '<p class="post-card__meta"><span class="tag">' + esc(p.category) + '</span><span>' + when(p) + '</span></p>' +
      '<h3 class="post-card__title">' + esc(p.title) + '</h3>' +
      '<p class="post-card__excerpt">' + esc(p.excerpt) + '</p>' +
      '<span class="post-card__more">Read more' + icon('arrow-right') + '</span>' +
    '</div></a>';

// one row per release: meta | title + excerpt | thumbnail (decorative; the title carries the link text)
const postRow = (p) =>
  '<a class="post-row" href="' + href(p) + '">' +
    '<p class="post-row__meta"><span class="tag">' + esc(p.category) + '</span><span>' + when(p) + '</span></p>' +
    '<div class="post-row__text"><h2 class="post-row__title">' + esc(p.title) + '</h2>' +
      '<p class="post-row__excerpt">' + esc(p.excerpt) + '</p></div>' +
    '<figure class="post-row__media">' + img({ image: p.image, imagePosition: p.imagePosition }, ' loading="lazy"') + '</figure>' +
  '</a>';

const postView = (post, others) =>
  '<a class="post-view__back" href="releases.html#' + post.category.toLowerCase() + '">' + icon('arrow-left') + 'Back to ' + esc(post.category) + '</a>' +
  '<header class="post-view__head">' +
    '<p class="post-card__meta"><span class="tag">' + esc(post.category) + '</span><time datetime="' + post.date + '">' + when(post) + '</time></p>' +
    '<h1 class="post-view__title">' + esc(post.title) + '</h1>' +
    '<p class="statement">' + esc(post.excerpt) + '</p>' +
  '</header>' +
  '<figure class="post-view__media">' + img(post, ' fetchpriority="high"') + '</figure>' +
  '<div class="post-view__body">' +
    post.body.map(blockHtml).join('') +
    (post.quote ? '<figure class="quote"><blockquote class="quote__text">' + esc(post.quote.text) + '</blockquote>' +
      '<figcaption class="small quote__cite">' + esc(post.quote.cite) + '</figcaption></figure>' : '') +
  '</div>' +
  (post.videos ? '<div class="post-videos">' + post.videos.map((v) =>
    '<figure class="post-video"><div class="post-video__frame"><iframe src="' + esc(v.embed) + (v.embed.indexOf('?') === -1 ? '?' : '&amp;') +
      (/vimeo\.com/.test(v.embed) ? 'title=0&amp;byline=0&amp;portrait=0' : 'rel=0') + '" title="' + esc(v.title) + '" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen></iframe></div>' +
      '<figcaption><span>' + esc(v.title) + '</span><span class="muted">' + esc(v.duration || '') + '</span></figcaption></figure>'
  ).join('') + '</div>' : '') +
  ((post.source || post.links) ? '<ul class="post-sources">' +
    (post.source ? arrowLink(post.source.url, post.source.cta || ('Read on ' + post.source.name)) : '') +
    (post.links || []).map((l) => arrowLink(l.url, l.label)).join('') + '</ul>' : '') +
  // every release links to the product it's about, with descriptive link text
  '<p class="post-view__product"><a class="text-link" href="proactive.html">Learn about ProActive, the deep pressure vest for autism and sensory overload' +
    '<img src="assets/icons/arrow-ink.svg" width="16" height="16" alt=""></a></p>' +
  (others.length ? '<div class="post-view__more"><h2 class="h3">More releases</h2><div class="post-list">' + others.map(postRow).join('') + '</div></div>' : '');

// ---------- Structured data ----------
const isoDuration = (d) => { const [m, s] = String(d).split(':').map(Number); return 'PT' + m + 'M' + s + 'S'; };
const ORG = {
  '@type': 'Organization', '@id': SITE + '#org', name: 'Vayence Inc', alternateName: 'Vayence', url: SITE, logo: SITE + 'assets/img/icon-512.png',
  address: { '@type': 'PostalAddress', addressLocality: 'Toronto', addressRegion: 'ON', addressCountry: 'CA' }
};
const PRODUCT = {
  '@type': 'Thing', name: 'ProActive', url: SITE + 'proactive.html',
  description: 'A self-inflating deep pressure vest for autistic people and others with sensory sensitivities, in development by Vayence Inc in Toronto.'
};
const KEYWORDS = ['ProActive', 'Vayence Inc', 'Toronto', 'autism', 'sensory overload', 'deep pressure vest', 'assistive technology', 'medical technology'];

function postLd(post) {
  const url = SITE + href(post);
  const graph = [
    {
      '@type': 'NewsArticle',
      '@id': url + '#article',
      headline: post.title,
      description: post.excerpt,
      image: [SITE + post.image],
      datePublished: post.date,
      articleSection: post.category,
      inLanguage: 'en-CA',
      about: PRODUCT,
      keywords: [post.category].concat(KEYWORDS).join(', '),
      isPartOf: { '@type': 'WebSite', '@id': SITE + '#website', name: 'Vayence Inc', url: SITE },
      mainEntityOfPage: url,
      author: ORG,
      publisher: ORG
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Releases', item: SITE + 'releases.html' },
        { '@type': 'ListItem', position: 3, name: post.title, item: url }
      ]
    }
  ];
  (post.videos || []).forEach((v) => {
    if (!v.thumbnail || !v.uploaded) return;
    graph.push({
      '@type': 'VideoObject',
      name: v.title,
      description: v.title + ' — ' + post.excerpt,
      thumbnailUrl: v.thumbnail,
      uploadDate: v.uploaded,
      duration: isoDuration(v.duration),
      embedUrl: v.embed
    });
  });
  // keep "</script>" out of the inline JSON
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

// ---------- Post page ----------
function postPage(post, others) {
  const url = SITE + href(post);
  return `<!doctype html>
<html lang="en-CA">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- generated by scripts/build-releases.js from assets/data/posts.json; edit there -->
  <base href="../">
  <title>${esc(post.title)} — Vayence Inc</title>
  <meta name="description" content="${esc(post.excerpt)}">
  <meta name="robots" content="max-image-preview:large">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Vayence Inc">
  <meta property="og:locale" content="en_CA">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${esc(post.title)}">
  <meta property="og:description" content="${esc(post.excerpt)}">
  <meta property="og:image" content="${SITE + post.image}">
  <meta property="og:image:alt" content="${esc(post.imageAlt || '')}">
  <meta property="article:published_time" content="${post.date}">
  <meta property="article:section" content="${esc(post.category)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#ffffff">
  <link rel="icon" href="favicon.ico" sizes="any">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="apple-touch-icon.png">
  <link rel="manifest" href="site.webmanifest">
  <script type="application/ld+json">${postLd(post)}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body data-page="releases">
  <div class="page">

    <!-- Header and footer are rendered by main.js from one site map -->
    <header class="header" id="top" data-site-header></header>

    <main class="subpage">
      <section class="section section--white">
        <article class="post-view">${postView(post, others)}</article>
      </section>
    </main>

    <footer class="footer" data-site-footer></footer>

  </div>
  <script src="main.js"></script>
</body>
</html>
`;
}

// <!-- build:cards 3 -->        the latest N cards
// <!-- build:list Awards -->    rows for one category (or its "empty" text from site.json)
// <!-- build:text a.b.c -->     a string from site.json
// <!-- build:roles -->          the contact form's "I am a" options
const lookup = (obj, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
function fillLists(src, POSTS, site) {
  if (!/<!-- build:/.test(src)) throw new Error('No build markers found');
  return src.replace(/(<!-- build:(cards|list|text|roles)(?: ([^ ]+?))? -->)[\s\S]*?(<!-- \/build -->)/g, (m, open, kind, arg, close) => {
    let html;
    if (kind === 'cards') html = POSTS.slice(0, parseInt(arg, 10)).map(postCard).join('');
    else if (kind === 'list') {
      const items = POSTS.filter((p) => p.category === arg);
      const empty = lookup(site, 'releases.sections.' + arg + '.empty') || 'Nothing here yet.';
      html = items.length ? items.map(postRow).join('') : '<p class="post-list__empty">' + esc(empty) + '</p>';
    } else if (kind === 'text') {
      const value = lookup(site, arg);
      if (typeof value !== 'string') throw new Error('site.json has no text for ' + arg);
      html = esc(value);
    } else {
      html = (lookup(site, 'contact.roles') || []).map((r) => '<option>' + esc(r) + '</option>').join('');
    }
    return open + html + close;
  });
}

function sitemap(POSTS) {
  const latest = POSTS.map((p) => p.date).sort().pop();
  const urls = [
    [''], ['products.html'], ['proactive.html'], ['releases.html', latest], ['about.html']
  ].concat(POSTS.map((p) => [href(p), p.date]));
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(([u, d]) => '  <url><loc>' + SITE + u + '</loc>' + (d ? '<lastmod>' + d + '</lastmod>' : '') + '</url>').join('\n') +
    '\n</urlset>\n';
}

// posts: the release list; pages: the current html of LIST_PAGES; site: site.json.
// Returns every generated file as { path: content }; release pages not in it are stale.
function build(posts, pages, site) {
  const files = {};
  posts.forEach((post) => {
    files[href(post)] = postPage(post, posts.filter((p) => p !== post).slice(0, 3));
  });
  LIST_PAGES.forEach((f) => { files[f] = fillLists(pages[f], posts, site); });
  files['sitemap.xml'] = sitemap(posts);
  return files;
}

module.exports = { build, LIST_PAGES };

if (require.main === module) {
  const ROOT = path.join(__dirname, '..');
  const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const posts = JSON.parse(read('assets/data/posts.json'));
  const site = JSON.parse(read('assets/data/site.json'));
  const pages = {};
  LIST_PAGES.forEach((f) => { pages[f] = read(f); });
  const files = build(posts, pages, site);
  fs.mkdirSync(path.join(ROOT, 'releases'), { recursive: true });
  Object.keys(files).forEach((f) => fs.writeFileSync(path.join(ROOT, f), files[f]));
  // drop pages for posts that were removed
  fs.readdirSync(path.join(ROOT, 'releases')).forEach((f) => {
    if (f.endsWith('.html') && !files['releases/' + f]) fs.unlinkSync(path.join(ROOT, 'releases', f));
  });
  console.log('Built ' + posts.length + ' release pages, lists and sitemap.xml');
}
