// Builds the static release pages from assets/data/posts.js.
// Run after editing posts:  node scripts/build-releases.js
//   - releases/<slug>.html   one crawlable page per release, with its own metadata
//   - index.html, releases.html   the lists between <!-- build:... --> and <!-- /build -->
//   - sitemap.xml
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://www.vayence.ca/';
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);

const sandbox = { window: {} };
vm.runInNewContext(read('assets/data/posts.js'), sandbox);
const POSTS = sandbox.window.VAYENCE_POSTS;

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
    post.body.map((para) => '<p>' + esc(para) + '</p>').join('') +
    (post.quote ? '<figure class="quote"><blockquote class="quote__text">' + esc(post.quote.text) + '</blockquote>' +
      '<figcaption class="small quote__cite">' + esc(post.quote.cite) + '</figcaption></figure>' : '') +
  '</div>' +
  (post.videos ? '<div class="post-videos">' + post.videos.map((v) =>
    '<figure class="post-video"><div class="post-video__frame"><iframe src="' + v.embed + '&amp;title=0&amp;byline=0&amp;portrait=0" title="' + esc(v.title) + '" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen></iframe></div>' +
      '<figcaption><span>' + esc(v.title) + '</span><span class="muted">' + esc(v.duration || '') + '</span></figcaption></figure>'
  ).join('') + '</div>' : '') +
  ((post.source || post.links) ? '<ul class="post-sources">' +
    (post.source ? arrowLink(post.source.url, post.source.cta || ('Read on ' + post.source.name)) : '') +
    (post.links || []).map((l) => arrowLink(l.url, l.label)).join('') + '</ul>' : '') +
  (others.length ? '<div class="post-view__more"><h2 class="h3">More releases</h2><div class="post-list">' + others.map(postRow).join('') + '</div></div>' : '');

// ---------- Structured data ----------
const isoDuration = (d) => { const [m, s] = String(d).split(':').map(Number); return 'PT' + m + 'M' + s + 'S'; };
const ORG = { '@type': 'Organization', '@id': SITE + '#org', name: 'Vayence Inc', url: SITE, logo: SITE + 'assets/img/icon-512.png' };

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
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- generated by scripts/build-releases.js from assets/data/posts.js; edit there -->
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

fs.mkdirSync(path.join(ROOT, 'releases'), { recursive: true });
const keep = new Set();
POSTS.forEach((post) => {
  const others = POSTS.filter((p) => p !== post).slice(0, 3);
  write(href(post), postPage(post, others));
  keep.add(post.slug + '.html');
});
// drop pages for posts that were removed
fs.readdirSync(path.join(ROOT, 'releases')).forEach((f) => {
  if (f.endsWith('.html') && !keep.has(f)) fs.unlinkSync(path.join(ROOT, 'releases', f));
});

// ---------- Lists in index.html and releases.html ----------
// <!-- build:cards 3 -->  latest N cards      <!-- build:list Awards -->  rows for one category
function fill(file) {
  const src = read(file);
  const out = src.replace(/(<!-- build:(cards|list) ([^ ]+?)(?: "([^"]*)")? -->)[\s\S]*?(<!-- \/build -->)/g, (m, open, kind, arg, empty, close) => {
    let html;
    if (kind === 'cards') html = POSTS.slice(0, parseInt(arg, 10)).map(postCard).join('');
    else {
      const items = POSTS.filter((p) => p.category === arg);
      html = items.length ? items.map(postRow).join('') : '<p class="post-list__empty">' + esc(empty || 'Nothing here yet.') + '</p>';
    }
    return open + html + close;
  });
  if (out === src && !/<!-- build:/.test(src)) throw new Error('No build markers in ' + file);
  write(file, out);
}
fill('index.html');
fill('releases.html');

// ---------- Sitemap ----------
const latest = POSTS.map((p) => p.date).sort().pop();
const urls = [
  [''], ['products.html'], ['proactive.html'], ['releases.html', latest], ['about.html']
].concat(POSTS.map((p) => [href(p), p.date]));
write('sitemap.xml',
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(([u, d]) => '  <url><loc>' + SITE + u + '</loc>' + (d ? '<lastmod>' + d + '</lastmod>' : '') + '</url>').join('\n') +
  '\n</urlset>\n');

console.log('Built ' + POSTS.length + ' release pages, lists and sitemap.xml');
