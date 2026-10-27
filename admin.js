// Releases editor: Google sign-in, then list / create / edit / delete posts through /api/posts.
(function () {
  var TOKEN_KEY = 'vayence-admin-token';
  var API = 'api/posts';
  var $ = function (sel) { return document.querySelector(sel); };

  var signin = $('[data-admin-signin]');
  var signinStatus = $('[data-signin-status]');
  var admin = $('[data-admin]');
  var list = $('[data-admin-list]');
  var listStatus = $('[data-list-status]');
  var filter = $('[data-filter]');
  var form = $('[data-editor]');
  var editorStatus = $('[data-editor-status]');
  var preview = $('[data-preview]');

  var config = null;    // { clientId, admin, posts }
  var token = null;
  var editing = null;   // post being edited, or null for a new one
  var newImage = null;  // data URL of a new cover image, resized

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function claims(jwt) {
    try {
      var part = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(part))));
    } catch (e) { return null; }
  }
  function store(value) {
    try { if (value) sessionStorage.setItem(TOKEN_KEY, value); else sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }
  function stored() {
    try { return sessionStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }

  function api(method, body) {
    return fetch(API, {
      method: method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) {
          if (r.status === 401) signOut('Your sign-in has expired. Please sign in again.');
          throw new Error(data.error || 'Something went wrong (' + r.status + ').');
        }
        return data;
      });
    });
  }

  // ---------- Sign-in ----------
  function useToken(credential) {
    var c = claims(credential);
    if (!c || c.exp * 1000 < Date.now()) return false;
    if (String(c.email).toLowerCase() !== config.admin) {
      signinStatus.textContent = c.email + ' can’t edit releases. Sign in with ' + config.admin + '.';
      return false;
    }
    token = credential;
    store(credential);
    $('[data-admin-email]').textContent = c.email;
    signin.hidden = true;
    admin.hidden = false;
    renderList();
    return true;
  }
  function signOut(message) {
    token = null;
    store(null);
    if (window.google && google.accounts) google.accounts.id.disableAutoSelect();
    admin.hidden = true;
    form.hidden = true;
    signin.hidden = false;
    signinStatus.textContent = message || '';
    startGoogle();
  }
  function startGoogle() {
    if (!config || !(window.google && google.accounts && google.accounts.id)) return;
    google.accounts.id.initialize({
      client_id: config.clientId,
      login_hint: config.admin,
      callback: function (response) { useToken(response.credential); }
    });
    google.accounts.id.renderButton($('[data-google-button]'), { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular' });
  }
  window.onGoogleLibraryLoad = startGoogle;

  // ---------- List ----------
  function renderList() {
    var cat = filter.value;
    var posts = config.posts.filter(function (p) { return !cat || p.category === cat; });
    list.innerHTML = posts.length ? posts.map(function (p) {
      return '<button class="post-row admin-row" type="button" data-slug="' + esc(p.slug) + '">' +
        '<span class="post-row__meta"><span class="tag">' + esc(p.category) + '</span><span>' + esc(p.dateLabel) + '</span></span>' +
        '<span class="post-row__text"><span class="post-row__title">' + esc(p.title) + '</span>' +
          '<span class="post-row__excerpt">' + esc(p.excerpt) + '</span></span>' +
        '<span class="post-row__media"><img src="' + esc(p.image) + '" alt="" loading="lazy"></span>' +
      '</button>';
    }).join('') : '<p class="post-list__empty">No ' + (cat ? cat.toLowerCase() + ' ' : '') + 'posts yet.</p>';
  }
  filter.addEventListener('change', renderList);
  list.addEventListener('click', function (e) {
    var row = e.target.closest('[data-slug]');
    if (row) openEditor(config.posts.filter(function (p) { return p.slug === row.getAttribute('data-slug'); })[0]);
  });
  $('[data-new]').addEventListener('click', function () { openEditor(null); });
  $('[data-sign-out]').addEventListener('click', function () { signOut(); });

  // ---------- Editor ----------
  var DRAFT_KEY = 'vayence-admin-draft:';
  var draftStatus = $('[data-draft-status]');
  var draftTimer = null;
  var doc = DocEditor.create($('[data-doc]'), {
    label: 'Post body',
    placeholder: 'Start writing… Paste from Google Docs, or drop images here.',
    onChange: function () { scheduleDraft(); },
    onError: function (message) { editorStatus.textContent = message; }
  });

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function grow(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  ['title', 'excerpt'].forEach(function (name) {
    form.elements[name].addEventListener('input', function () { grow(form.elements[name]); });
  });
  form.elements.title.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); form.elements.excerpt.focus(); }
  });

  // what the form holds, in the shape the API takes
  function collect() {
    var f = form.elements;
    return {
      slug: editing ? editing.slug : undefined,
      category: f.category.value,
      date: f.date.value,
      dateLabel: f.dateLabel.value,
      title: f.title.value,
      excerpt: f.excerpt.value,
      body: doc.read(),
      imageAlt: f.imageAlt.value,
      quote: { text: f.quoteText.value, cite: f.quoteCite.value },
      source: { name: f.sourceName.value, url: f.sourceUrl.value },
      links: lines(f.links.value).map(function (p) { return { label: p[0], url: p[1] || '' }; }),
      videos: lines(f.videos.value).map(function (p) { return { title: p[0], url: p[1] || '', duration: p[2] || '' }; })
    };
  }
  // "a | b | c" per line ⇄ arrays
  function lines(text) {
    return text.split('\n').map(function (l) { return l.split('|').map(function (s) { return s.trim(); }); })
      .filter(function (p) { return p.join(''); });
  }
  function unlines(rows) { return rows.map(function (r) { return r.filter(Boolean).join(' | '); }).join('\n'); }
  function fill(p) {
    var f = form.elements;
    f.category.value = p.category || 'Newsletter';
    f.date.value = p.date || '';
    f.dateLabel.value = p.dateLabel || '';
    f.title.value = p.title || '';
    f.excerpt.value = p.excerpt || '';
    f.image.value = '';
    f.imageAlt.value = p.imageAlt || '';
    f.quoteText.value = p.quote ? p.quote.text : '';
    f.quoteCite.value = p.quote ? p.quote.cite : '';
    f.sourceName.value = p.source ? p.source.name : '';
    f.sourceUrl.value = p.source ? p.source.url : '';
    f.links.value = unlines((p.links || []).map(function (l) { return [l.label, l.url]; }));
    // drafts hold `url`, stored posts hold `embed`
    f.videos.value = unlines((p.videos || []).map(function (v) { return [v.title, v.url || v.embed, v.duration]; }));
    doc.load(p.body || []);
    grow(f.title);
    grow(f.excerpt);
  }
  function showCover(src) {
    preview.src = src || '';
    preview.parentNode.hidden = !src;
  }

  // unsaved work is kept on this device until it's published (pictures included, while they fit)
  function draftKey() { return DRAFT_KEY + (editing ? editing.slug : 'new'); }
  function scheduleDraft() {
    if (form.hidden) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(function () {
      var data = { at: Date.now(), post: collect(), cover: newImage };
      try {
        localStorage.setItem(draftKey(), JSON.stringify(data));
        draftStatus.textContent = 'Draft saved on this device';
      } catch (e) {
        try {
          data.post.body = data.post.body.filter(function (b) { return !b.upload; });
          data.cover = null;
          localStorage.setItem(draftKey(), JSON.stringify(data));
          draftStatus.textContent = 'Draft saved on this device, without the new pictures';
        } catch (e2) {
          draftStatus.textContent = '';
        }
      }
    }, 600);
  }
  function readDraft(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function clearDraft(key) {
    clearTimeout(draftTimer);
    try { localStorage.removeItem(key); } catch (e) {}
  }
  form.addEventListener('input', scheduleDraft);
  form.addEventListener('change', scheduleDraft);
  draftStatus.addEventListener('click', function (e) {
    if (!e.target.closest('[data-discard]')) return;
    clearDraft(draftKey());
    newImage = null;
    fill(editing || { category: filter.value || 'Newsletter', date: today() });
    showCover(editing && editing.image);
    draftStatus.textContent = '';
  });

  function openEditor(post) {
    editing = post || null;
    newImage = null;
    var draft = readDraft(draftKey());
    fill(draft ? draft.post : post || { category: filter.value || 'Newsletter', date: today() });
    if (draft && draft.cover) newImage = draft.cover;
    showCover(newImage || (post && post.image));
    draftStatus.innerHTML = draft
      ? 'Restored unsaved changes from ' + esc(new Date(draft.at).toLocaleString()) + ' · <button class="admin__link" type="button" data-discard>Discard</button>'
      : '';
    $('[data-editor-title]').textContent = post ? 'Edit ' + post.category.toLowerCase() + ' post' : 'New post';
    $('[data-save]').textContent = post ? 'Save changes' : 'Publish';
    $('[data-delete]').hidden = !post;
    editorStatus.textContent = '';
    Array.prototype.slice.call(form.querySelectorAll('.is-invalid')).forEach(function (el) { el.classList.remove('is-invalid'); });
    admin.hidden = true;
    form.hidden = false;
    grow(form.elements.title);
    grow(form.elements.excerpt);
    form.scrollIntoView({ behavior: 'instant', block: 'start' });
    (post ? doc : form.elements.title).focus({ preventScroll: true });
  }
  function closeEditor() {
    form.hidden = true;
    admin.hidden = false;
    renderList();
  }
  $('[data-cancel]').addEventListener('click', closeEditor);

  form.elements.image.addEventListener('change', function () {
    var file = form.elements.image.files[0];
    if (!file) return;
    DocEditor.resizeImage(file).then(function (url) {
      newImage = url;
      showCover(url);
      scheduleDraft();
    }).catch(function (err) { editorStatus.textContent = err.message; });
  });

  function busy(on) {
    Array.prototype.slice.call(form.querySelectorAll('button, input, select, textarea')).forEach(function (el) { el.disabled = on; });
    doc.setDisabled(on);
  }
  function saved(data, key, message) {
    clearDraft(key);
    draftStatus.textContent = '';
    config.posts = data.posts;
    closeEditor();
    listStatus.textContent = message;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements;
    var post = collect();
    var missing = [];
    if (!post.title.trim()) missing.push(f.title);
    if (!post.excerpt.trim()) missing.push(f.excerpt);
    if (!post.date) missing.push(f.date);
    [f.title, f.excerpt, f.date].forEach(function (el) { el.classList.toggle('is-invalid', missing.indexOf(el) !== -1); });
    if (missing.length) { editorStatus.textContent = 'Add a title, a summary and a date.'; missing[0].focus(); return; }
    if (!post.body.length) { editorStatus.textContent = 'The post needs some text.'; doc.focus(); return; }
    if (f.sourceUrl.value.trim() && !/^https?:\/\//i.test(f.sourceUrl.value.trim())) {
      f.sourceUrl.classList.add('is-invalid');
      editorStatus.textContent = 'The source link should start with https://';
      return;
    }
    // the site takes about 4.5 MB per save
    if (doc.pendingUploadSize() + (newImage ? newImage.length : 0) > 4 * 1024 * 1024) {
      editorStatus.textContent = 'Too many new pictures for one save. Publish with fewer, then add the rest in a second save.';
      return;
    }
    var key = draftKey();
    var isNew = !editing;
    busy(true);
    editorStatus.textContent = 'Saving…';
    api('POST', { action: 'save', post: post, image: newImage })
      .then(function (data) { saved(data, key, (isNew ? 'Published' : 'Saved') + ' “' + post.title.trim() + '”. The site updates in about a minute.'); })
      .catch(function (err) { editorStatus.textContent = err.message; })
      .then(function () { busy(false); });
  });

  $('[data-delete]').addEventListener('click', function () {
    if (!editing || !window.confirm('Delete “' + editing.title + '”? This removes its page from the site.')) return;
    var key = draftKey();
    var title = editing.title;
    busy(true);
    editorStatus.textContent = 'Deleting…';
    api('POST', { action: 'delete', slug: editing.slug })
      .then(function (data) { saved(data, key, 'Deleted “' + title + '”. The site updates in about a minute.'); })
      .catch(function (err) { editorStatus.textContent = err.message; })
      .then(function () { busy(false); });
  });

  // ---------- Start ----------
  api('GET').then(function (data) {
    config = data;
    config.admin = String(data.admin).toLowerCase();
    if (!config.clientId) { signinStatus.textContent = 'Google sign-in isn’t set up yet (GOOGLE_CLIENT_ID is missing).'; return; }
    var previous = stored();
    if (!(previous && useToken(previous))) startGoogle();
  }).catch(function (err) {
    // no API at all (local preview, GitHub Pages) vs. the API reporting a setup problem
    signinStatus.textContent = /\(404\)|fetch/i.test(err.message)
      ? 'The editor only works on the live site, where the /api/posts service runs.' : err.message;
  });
})();
