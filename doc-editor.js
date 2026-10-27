// Document-style editor for release bodies: a page you type on, with a formatting toolbar.
// It reads and writes the body block format of posts.json (see scripts/build-releases.js), so whatever
// is typed or pasted (Google Docs, Word, web pages) is reduced to paragraphs, headings, lists, quotes,
// bold, italic, links and images. New images stay as data URLs until the post is saved.
(function () {
  var BLOCK = /^(P|DIV|H[1-6]|UL|OL|LI|BLOCKQUOTE|FIGURE|FIGCAPTION|TABLE|THEAD|TBODY|TR|TD|TH|SECTION|ARTICLE|HEADER|FOOTER|ASIDE|PRE|HR)$/;
  var SITE_IMAGE = /^assets\/img\/[\w\/.-]+\.(jpe?g|png|webp|gif)$/i;
  var SAFE_HREF = /^(https?:\/\/|mailto:)\S+$/i;

  // ---------- Images: shrink to at most 1600px wide JPEG on a white background ----------
  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, 1600 / img.naturalWidth);
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('That file couldn’t be read as an image.')); };
      img.src = url;
    });
  }

  // ---------- DOM → blocks ----------
  function isBold(el) {
    var w = el.style && el.style.fontWeight;
    if (w === 'normal' || (+w && +w < 600)) return false;
    return el.tagName === 'B' || el.tagName === 'STRONG' || w === 'bold' || +w >= 600;
  }
  function isItalic(el) {
    return el.tagName === 'I' || el.tagName === 'EM' || (el.style && el.style.fontStyle === 'italic');
  }
  // text runs of one node; nested lists are left to the list reader, paragraphs inside become line breaks
  function inline(node, fmt, out) {
    if (node.nodeType === 3) {
      var t = node.nodeValue.replace(/[\s ]+/g, ' ');
      if (t) out.push({ text: t, b: fmt.b, i: fmt.i, href: fmt.href });
      return out;
    }
    if (node.nodeType !== 1 || node.hasAttribute('data-ui')) return out;
    var tag = node.tagName;
    if (tag === 'BR') { out.push({ text: '\n', b: fmt.b, i: fmt.i, href: fmt.href }); return out; }
    if (tag === 'UL' || tag === 'OL' || tag === 'FIGURE' || tag === 'IMG' || tag === 'SCRIPT' || tag === 'STYLE') return out;
    var f = { b: fmt.b || isBold(node), i: fmt.i || isItalic(node), href: fmt.href };
    if (tag === 'A' && SAFE_HREF.test(node.getAttribute('href') || '')) f.href = node.getAttribute('href');
    for (var c = node.firstChild; c; c = c.nextSibling) inline(c, f, out);
    if (BLOCK.test(tag) && node.nextSibling) out.push({ text: '\n', b: fmt.b, i: fmt.i, href: fmt.href });
    return out;
  }
  function runsOf(el) {
    var runs = [];
    for (var c = el.firstChild; c; c = c.nextSibling) inline(c, {}, runs);
    return runs;
  }
  var hasText = function (runs) { return runs.some(function (r) { return r.text.trim(); }); };
  function hasBlockChild(el) {
    for (var c = el.firstElementChild; c; c = c.nextElementSibling) {
      if (BLOCK.test(c.tagName) || c.tagName === 'IMG' || hasBlockChild(c)) return true;
    }
    return false;
  }
  function imageBlock(fig, img) {
    var src = img.getAttribute('src') || '';
    var cap = fig.tagName === 'FIGURE' && fig.querySelector('figcaption');
    var b = { type: 'image', alt: img.getAttribute('alt') || '', caption: cap ? cap.textContent.trim() : '' };
    if (img.hasAttribute('data-upload') && /^data:image\//.test(src)) b.upload = src;
    else if (SITE_IMAGE.test(src)) b.src = src;
    else return null; // pictures pasted from other sites aren't ours to republish
    return b;
  }
  function readBlocks(root) {
    var out = [];
    var pending = null;
    function flush() {
      if (pending && hasText(pending)) out.push({ type: 'p', runs: pending });
      pending = null;
    }
    function walk(parent) {
      for (var c = parent.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { if (c.nodeValue.trim() || pending) inline(c, {}, pending = pending || []); continue; }
        if (c.nodeType !== 1 || c.hasAttribute('data-ui')) continue;
        var tag = c.tagName;
        if (tag === 'FIGURE' || tag === 'IMG') {
          flush();
          var img = tag === 'IMG' ? c : c.querySelector('img');
          var b = img && imageBlock(c, img);
          if (b) out.push(b);
        } else if (/^H[1-6]$/.test(tag)) {
          flush();
          var hr = runsOf(c);
          if (hasText(hr)) out.push({ type: tag === 'H1' || tag === 'H2' ? 'h2' : 'h3', runs: hr });
        } else if (tag === 'UL' || tag === 'OL') {
          flush();
          var items = Array.prototype.map.call(c.querySelectorAll('li'), runsOf).filter(hasText);
          if (items.length) out.push({ type: tag.toLowerCase(), items: items });
        } else if (tag === 'BLOCKQUOTE') {
          flush();
          var qr = runsOf(c);
          if (hasText(qr)) out.push({ type: 'quote', runs: qr });
        } else if (hasBlockChild(c)) {
          // wrappers: Google Docs' <b id="docs-internal-guid…">, divs, tables
          flush();
          walk(c);
        } else if (BLOCK.test(tag)) {
          flush();
          var pr = runsOf(c);
          if (hasText(pr)) out.push({ type: 'p', runs: pr });
        } else {
          inline(c, {}, pending = pending || []);
        }
      }
    }
    walk(root);
    flush();
    return out;
  }

  // ---------- blocks → DOM ----------
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function appendRuns(parent, runs) {
    (runs || []).forEach(function (r) {
      var node = document.createDocumentFragment();
      String(r.text).split('\n').forEach(function (part, i) {
        if (i) node.appendChild(el('br'));
        if (part) node.appendChild(document.createTextNode(part));
      });
      if (r.b) { var s = el('strong'); s.appendChild(node); node = s; }
      if (r.i) { var m = el('em'); m.appendChild(node); node = m; }
      if (r.href && SAFE_HREF.test(r.href)) { var a = el('a'); a.setAttribute('href', r.href); a.appendChild(node); node = a; }
      parent.appendChild(node);
    });
    if (!parent.firstChild) parent.appendChild(el('br'));
    return parent;
  }
  function figureNode(src, alt, caption, isUpload) {
    var fig = el('figure', 'post-figure doc-figure');
    fig.contentEditable = 'false';
    var img = el('img');
    img.setAttribute('src', src);
    img.setAttribute('alt', alt || '');
    if (isUpload) img.setAttribute('data-upload', '');
    var cap = el('figcaption');
    cap.contentEditable = 'true';
    cap.setAttribute('data-placeholder', 'Add a caption (optional)');
    cap.textContent = caption || '';
    var tools = el('div', 'doc-figure__tools');
    tools.setAttribute('data-ui', '');
    tools.innerHTML = '<button type="button" data-fig="alt">Alt text</button><button type="button" data-fig="remove">Remove</button>';
    fig.appendChild(img);
    fig.appendChild(cap);
    fig.appendChild(tools);
    return fig;
  }
  function blockNode(b) {
    if (typeof b === 'string') b = { type: 'p', runs: [{ text: b }] };
    switch (b.type) {
      case 'h2': case 'h3': return appendRuns(el(b.type), b.runs);
      case 'quote': return appendRuns(el('blockquote', 'post-quote'), b.runs);
      case 'ul': case 'ol': {
        var list = el(b.type);
        (b.items || []).forEach(function (it) { list.appendChild(appendRuns(el('li'), it)); });
        return list;
      }
      case 'image': return figureNode(b.upload || b.src, b.alt, b.caption, !!b.upload);
      default: return appendRuns(el('p'), b.runs);
    }
  }

  // ---------- Toolbar icons (Lucide) ----------
  var ICONS = {
    bold: '<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>',
    italic: '<line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    ul: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
    ol: '<path d="M10 12h11"/><path d="M10 18h11"/><path d="M10 6h11"/><path d="M4 10h2"/><path d="M4 6h1v4"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
    quote: '<path d="M17 6H3"/><path d="M21 12H8"/><path d="M21 18H8"/><path d="M3 12v6"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/>'
  };
  function iconButton(cmd, label, key) {
    return '<button class="doc__btn" type="button" data-cmd="' + cmd + '" aria-label="' + label + '" title="' + label + (key ? ' (' + key + ')' : '') + '">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[cmd] + '</svg></button>';
  }

  // ---------- Editor ----------
  function create(host, options) {
    var opts = options || {};
    var mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';
    host.classList.add('doc');
    host.innerHTML =
      '<div class="doc__toolbar" role="toolbar" aria-label="Formatting">' +
        '<select class="doc__select" data-cmd="block" aria-label="Text style">' +
          '<option value="p">Paragraph</option><option value="h2">Heading</option><option value="h3">Subheading</option>' +
        '</select>' +
        '<span class="doc__sep"></span>' +
        iconButton('bold', 'Bold', mod + 'B') + iconButton('italic', 'Italic', mod + 'I') + iconButton('link', 'Link', mod + 'K') +
        '<span class="doc__sep"></span>' +
        iconButton('ul', 'Bulleted list') + iconButton('ol', 'Numbered list') + iconButton('quote', 'Quote') +
        '<span class="doc__sep"></span>' +
        iconButton('image', 'Insert image') +
        '<span class="doc__sep"></span>' +
        iconButton('undo', 'Undo', mod + 'Z') + iconButton('redo', 'Redo') +
        '<span class="doc__count small muted" aria-live="off"></span>' +
      '</div>' +
      '<div class="doc__page post-view__body" contenteditable="true" role="textbox" aria-multiline="true"' +
        ' aria-label="' + (opts.label || 'Body') + '" data-placeholder="' + (opts.placeholder || 'Start writing…') + '"></div>' +
      '<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden>';

    var toolbar = host.querySelector('.doc__toolbar');
    var page = host.querySelector('.doc__page');
    var picker = host.querySelector('input[type=file]');
    var blockSelect = toolbar.querySelector('[data-cmd=block]');
    var count = toolbar.querySelector('.doc__count');
    var saved = null; // last selection inside the page, so toolbar clicks act on it

    function exec(cmd, value) { document.execCommand(cmd, false, value); }
    function changed() {
      var blocks = readBlocks(page);
      var text = blocks.map(function (b) {
        if (b.type === 'image') return b.caption;
        return (b.items || [b.runs]).map(function (runs) { return runs.map(function (r) { return r.text; }).join(''); }).join(' ');
      }).join(' ');
      var words = (text.match(/\S+/g) || []).length;
      count.textContent = words + (words === 1 ? ' word' : ' words');
      page.classList.toggle('is-empty', !blocks.length);
      if (opts.onChange) opts.onChange();
    }
    function ensureParagraph() {
      if (!page.firstChild) page.appendChild(appendRuns(el('p'), []));
      // keep somewhere to type after a picture at the end
      if (page.lastElementChild && page.lastElementChild.tagName === 'FIGURE') page.appendChild(appendRuns(el('p'), []));
    }
    function inPage(node) { return node && (node === page || page.contains(node)); }
    function restore() {
      page.focus({ preventScroll: true });
      if (!saved) return;
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(saved);
    }
    function currentBlock() {
      var sel = window.getSelection();
      var n = sel.rangeCount ? sel.getRangeAt(0).startContainer : null;
      if (!inPage(n)) return null;
      while (n && n.parentNode !== page) n = n.parentNode;
      return n === page ? null : n;
    }
    function closest(tag) {
      var sel = window.getSelection();
      var n = sel.rangeCount ? sel.getRangeAt(0).startContainer : null;
      for (; n && n !== page; n = n.parentNode) if (n.nodeType === 1 && n.tagName === tag) return n;
      return null;
    }

    function updateState() {
      var sel = window.getSelection();
      if (!sel.rangeCount || !inPage(sel.getRangeAt(0).startContainer)) return;
      saved = sel.getRangeAt(0).cloneRange();
      var press = function (cmd, on) { var b = toolbar.querySelector('[data-cmd=' + cmd + ']'); b.setAttribute('aria-pressed', on ? 'true' : 'false'); };
      press('bold', document.queryCommandState('bold'));
      press('italic', document.queryCommandState('italic'));
      press('ul', !!closest('UL'));
      press('ol', !!closest('OL'));
      press('quote', !!closest('BLOCKQUOTE'));
      press('link', !!closest('A'));
      blockSelect.value = closest('H2') ? 'h2' : closest('H3') ? 'h3' : 'p';
    }
    document.addEventListener('selectionchange', updateState);

    function link() {
      var a = closest('A');
      var current = a ? a.getAttribute('href') : '';
      var url = window.prompt(a ? 'Edit the link (leave empty to remove it)' : 'Link to (https://…)', current || 'https://');
      if (url === null) return;
      url = url.trim();
      if (!url || url === 'https://') {
        if (a) { var r = document.createRange(); r.selectNodeContents(a); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); exec('unlink'); }
        return;
      }
      if (!/^(https?:\/\/|mailto:)/i.test(url)) url = (/@/.test(url) && !/\//.test(url) ? 'mailto:' : 'https://') + url;
      if (a) { a.setAttribute('href', url); changed(); return; }
      var sel = window.getSelection();
      if (sel.isCollapsed) {
        var link = el('a');
        link.setAttribute('href', url);
        link.textContent = url.replace(/^mailto:|^https?:\/\//, '');
        exec('insertHTML', link.outerHTML);
      } else {
        exec('createLink', url);
      }
    }

    function insertNodes(nodes) {
      var block = currentBlock();
      var empty = block && block.tagName === 'P' && !block.textContent.trim() && !block.querySelector('img');
      var ref = block ? block.nextSibling : null;
      nodes.forEach(function (n) { page.insertBefore(n, ref); });
      if (empty) block.parentNode.removeChild(block);
      ensureParagraph();
      // caret after the last inserted node
      var after = nodes[nodes.length - 1].nextSibling;
      if (after) {
        var r = document.createRange();
        r.setStart(after, 0);
        r.collapse(true);
        var s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
      }
      changed();
    }
    function insertImages(files) {
      var list = Array.prototype.filter.call(files, function (f) { return /^image\/(jpeg|png|webp)$/.test(f.type); });
      if (!list.length) { if (opts.onError) opts.onError('Images must be JPEG, PNG or WebP.'); return; }
      Promise.all(list.map(resizeImage)).then(function (urls) {
        insertNodes(urls.map(function (u) { return figureNode(u, '', '', true); }));
      }).catch(function (err) { if (opts.onError) opts.onError(err.message); });
    }

    toolbar.addEventListener('mousedown', function (e) {
      // keep the page's selection when a button is pressed (but let the select open)
      if (e.target.closest('button')) e.preventDefault();
    });
    toolbar.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-cmd]');
      if (!btn) return;
      var cmd = btn.getAttribute('data-cmd');
      restore();
      if (cmd === 'bold' || cmd === 'italic' || cmd === 'undo' || cmd === 'redo') exec(cmd);
      else if (cmd === 'link') link();
      else if (cmd === 'ul') exec('insertUnorderedList');
      else if (cmd === 'ol') exec('insertOrderedList');
      else if (cmd === 'quote') exec('formatBlock', closest('BLOCKQUOTE') ? 'p' : 'blockquote');
      else if (cmd === 'image') { picker.click(); return; }
      updateState();
    });
    blockSelect.addEventListener('change', function () {
      restore();
      exec('formatBlock', blockSelect.value);
      updateState();
    });
    picker.addEventListener('change', function () {
      restore();
      if (picker.files.length) insertImages(picker.files);
      picker.value = '';
    });

    page.addEventListener('input', changed);
    page.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); link(); }
      // a caption is one line
      if (e.key === 'Enter' && e.target.tagName === 'FIGCAPTION') e.preventDefault();
    });
    // paste keeps the structure (headings, lists, bold, links) and drops everything else
    page.addEventListener('paste', function (e) {
      var data = e.clipboardData;
      if (!data) return;
      e.preventDefault();
      if (data.files && data.files.length) { insertImages(data.files); return; }
      if (e.target.closest && e.target.closest('figcaption')) { exec('insertText', data.getData('text/plain').replace(/\s+/g, ' ')); return; }
      var html = data.getData('text/html');
      var blocks;
      if (html) blocks = readBlocks(new DOMParser().parseFromString(html, 'text/html').body);
      else blocks = data.getData('text/plain').split(/\r?\n\s*\r?\n/).map(function (t) { return { type: 'p', runs: [{ text: t.replace(/\r?\n/g, ' ') }] }; });
      blocks = blocks.filter(function (b) { return b.type !== 'image'; });
      if (!blocks.length) return;
      if (blocks.length === 1 && blocks[0].type === 'p') {
        exec('insertHTML', appendRuns(el('span'), blocks[0].runs).innerHTML);
      } else {
        exec('insertHTML', blocks.map(function (b) { return blockNode(b).outerHTML; }).join(''));
      }
    });
    page.addEventListener('dragover', function (e) {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') !== -1) e.preventDefault();
    });
    page.addEventListener('drop', function (e) {
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      var r = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
      if (r && inPage(r.startContainer)) { var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
      insertImages(e.dataTransfer.files);
    });
    page.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-fig]');
      if (!btn) return;
      var fig = btn.closest('figure');
      var img = fig.querySelector('img');
      if (btn.getAttribute('data-fig') === 'remove') {
        fig.parentNode.removeChild(fig);
        ensureParagraph();
      } else {
        var alt = window.prompt('Describe this image for people who can’t see it', img.getAttribute('alt') || '');
        if (alt !== null) img.setAttribute('alt', alt.trim());
      }
      changed();
    });

    document.execCommand('defaultParagraphSeparator', false, 'p');

    return {
      load: function (blocks) {
        page.innerHTML = '';
        (blocks || []).forEach(function (b) { page.appendChild(blockNode(b)); });
        ensureParagraph();
        saved = null;
        changed();
      },
      read: function () { return readBlocks(page); },
      isEmpty: function () { return !readBlocks(page).length; },
      // size of the images not yet uploaded, in base64 characters
      pendingUploadSize: function () {
        return Array.prototype.reduce.call(page.querySelectorAll('img[data-upload]'), function (n, img) { return n + img.getAttribute('src').length; }, 0);
      },
      focus: function () { page.focus({ preventScroll: true }); },
      setDisabled: function (on) {
        page.contentEditable = on ? 'false' : 'true';
        Array.prototype.forEach.call(toolbar.querySelectorAll('button, select'), function (b) { b.disabled = on; });
      }
    };
  }

  window.DocEditor = { create: create, resizeImage: resizeImage };
})();
