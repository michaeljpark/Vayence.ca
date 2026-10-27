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
  var newImage = null;  // data URL of a picked image, resized

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
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function openEditor(post) {
    editing = post || null;
    newImage = null;
    var p = post || { category: filter.value || 'Newsletter', date: today() };
    var f = form.elements;
    f.category.value = p.category;
    f.date.value = p.date || '';
    f.dateLabel.value = post ? p.dateLabel || '' : '';
    f.title.value = p.title || '';
    f.excerpt.value = p.excerpt || '';
    f.body.value = (p.body || []).join('\n\n');
    f.image.value = '';
    f.imageAlt.value = p.imageAlt || '';
    f.quoteText.value = p.quote ? p.quote.text : '';
    f.quoteCite.value = p.quote ? p.quote.cite : '';
    f.sourceName.value = p.source ? p.source.name : '';
    f.sourceUrl.value = p.source ? p.source.url : '';
    preview.src = p.image || '';
    preview.parentNode.hidden = !p.image;
    $('[data-editor-title]').textContent = post ? 'Edit post' : 'New post';
    $('[data-save]').textContent = post ? 'Save changes' : 'Publish';
    $('[data-delete]').hidden = !post;
    editorStatus.textContent = '';
    Array.prototype.slice.call(form.querySelectorAll('.is-invalid')).forEach(function (el) { el.classList.remove('is-invalid'); });
    admin.hidden = true;
    form.hidden = false;
    form.scrollIntoView({ behavior: 'instant', block: 'start' });
    f.title.focus({ preventScroll: true });
  }
  function closeEditor() {
    form.hidden = true;
    admin.hidden = false;
    renderList();
  }
  $('[data-cancel]').addEventListener('click', closeEditor);

  // shrink the picked image to at most 1600px wide JPEG before upload
  form.elements.image.addEventListener('change', function () {
    var file = form.elements.image.files[0];
    newImage = null;
    if (!file) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var scale = Math.min(1, 1600 / img.naturalWidth);
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      newImage = canvas.toDataURL('image/jpeg', 0.85);
      preview.src = newImage;
      preview.parentNode.hidden = false;
      URL.revokeObjectURL(url);
    };
    img.onerror = function () { editorStatus.textContent = 'That file couldn’t be read as an image.'; };
    img.src = url;
  });

  function busy(on) {
    Array.prototype.slice.call(form.querySelectorAll('button, input, select, textarea')).forEach(function (el) { el.disabled = on; });
  }
  function saved(data, message) {
    config.posts = data.posts;
    closeEditor();
    listStatus.textContent = message;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements;
    var required = [f.title, f.date, f.excerpt, f.body];
    var invalid = required.filter(function (el) { return !el.value.trim(); });
    required.forEach(function (el) { el.classList.toggle('is-invalid', invalid.indexOf(el) !== -1); });
    if (invalid.length) { editorStatus.textContent = 'Please fill in the required fields.'; invalid[0].focus(); return; }
    if (f.sourceUrl.value.trim() && !/^https?:\/\//i.test(f.sourceUrl.value.trim())) {
      f.sourceUrl.classList.add('is-invalid');
      editorStatus.textContent = 'The source link should start with https://';
      return;
    }

    var post = {
      slug: editing ? editing.slug : undefined,
      category: f.category.value,
      date: f.date.value,
      dateLabel: f.dateLabel.value,
      title: f.title.value,
      excerpt: f.excerpt.value,
      body: f.body.value.split(/\n\s*\n/).map(function (s) { return s.replace(/\s*\n\s*/g, ' ').trim(); }).filter(Boolean),
      imageAlt: f.imageAlt.value,
      quote: { text: f.quoteText.value, cite: f.quoteCite.value },
      source: { name: f.sourceName.value, url: f.sourceUrl.value }
    };
    busy(true);
    editorStatus.textContent = 'Saving…';
    api('POST', { action: 'save', post: post, image: newImage })
      .then(function (data) { saved(data, (editing ? 'Saved' : 'Published') + ' “' + post.title.trim() + '”. The site updates in about a minute.'); })
      .catch(function (err) { editorStatus.textContent = err.message; })
      .then(function () { busy(false); });
  });

  $('[data-delete]').addEventListener('click', function () {
    if (!editing || !window.confirm('Delete “' + editing.title + '”? This removes its page from the site.')) return;
    busy(true);
    editorStatus.textContent = 'Deleting…';
    var title = editing.title;
    api('POST', { action: 'delete', slug: editing.slug })
      .then(function (data) { saved(data, 'Deleted “' + title + '”. The site updates in about a minute.'); })
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
