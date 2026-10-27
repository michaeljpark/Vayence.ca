(function () {
  var CONTACT_EMAIL = 'theproactiveproject@gmail.com';
  var page = document.body.getAttribute('data-page') || 'home';

  // ---------- Icons (Lucide, inlined so they take currentColor) ----------
  var ICONS = {
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>'
  };
  function icon(name, cls) {
    return '<svg class="i' + (cls ? ' ' + cls : '') + '" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- Site map: one source for the header menus and the footer ----------
  var NAV = [
    {
      id: 'products', label: 'Products', href: 'products.html',
      blurb: 'Health technology by Vayence Inc. ProActive is our flagship product.',
      items: [
        ['ProActive', 'Self-inflating vest for sensory regulation', 'proactive.html'],
        ['How ProActive works', 'Monitor, relief and tracking', 'proactive.html#how'],
        ['Design', 'Four decisions behind the vest', 'proactive.html#design']
      ]
    },
    {
      id: 'releases', label: 'Releases', href: 'releases.html',
      blurb: 'News, awards and updates from Vayence Inc.',
      items: [
        ['Awards', 'Recognition for ProActive', 'releases.html#awards'],
        ['Updates', 'Product and company news', 'releases.html#updates'],
        ['Newsletter', 'Issues sent to subscribers', 'releases.html#newsletter']
      ]
    },
    {
      id: 'about', label: 'About us', href: 'about.html',
      blurb: 'A Canadian health-technology company founded by two industrial designers.',
      items: [
        ['Mission', 'Why Vayence Inc exists', 'about.html#mission'],
        ['Team', 'The founders behind ProActive', 'about.html#team'],
        ['Contact', 'Get in touch with the team', 'about.html#contact']
      ]
    }
  ];
  var contactHref = document.getElementById('contact') ? '#contact' : 'about.html#contact';

  // ---------- Header ----------
  var header = document.querySelector('[data-site-header]');
  if (header) {
    header.innerHTML =
      '<a class="logo" href="index.html" aria-label="Vayence Inc home">' +
        '<img src="assets/logos/vayence-header.svg" width="158.92" height="30.16" alt="Vayence Inc">' +
      '</a>' +
      '<nav class="nav" id="nav" aria-label="Primary">' +
        NAV.map(function (g) {
          return '<div class="nav__group" data-group="' + g.id + '">' +
            '<button class="nav__item" type="button" aria-expanded="false" aria-controls="menu-' + g.id + '"' +
              (page === g.id ? ' aria-current="page"' : '') + '>' +
              '<span class="nav__label">' + esc(g.label) + '</span>' + icon('chevron-down', 'nav__chevron') +
            '</button>' +
            '<div class="nav__panel" id="menu-' + g.id + '">' +
              '<div class="nav__intro">' +
                '<p class="nav__kicker">' + esc(g.label) + '</p>' +
                '<p class="nav__blurb">' + esc(g.blurb) + '</p>' +
                '<a class="nav__all" href="' + g.href + '">Go to ' + esc(g.label) + icon('arrow-right') + '</a>' +
              '</div>' +
              '<ul class="nav__links">' +
                g.items.map(function (it) {
                  return '<li><a class="nav__link" href="' + it[2] + '">' +
                    '<span class="nav__link-title">' + esc(it[0]) + '</span>' +
                    '<span class="nav__link-desc">' + esc(it[1]) + '</span></a></li>';
                }).join('') +
              '</ul>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</nav>' +
      '<div class="header__actions">' +
        '<a class="btn btn--primary btn--s header__cta" href="' + contactHref + '">Contact us' +
          '<img src="assets/icons/arrow-white-sm.svg" width="14" height="14" alt=""></a>' +
        '<button class="menu-toggle" type="button" aria-controls="nav" aria-expanded="false" aria-label="Open menu">' +
          '<span></span><span></span><span></span></button>' +
      '</div>';
  }

  // ---------- Footer ----------
  var footer = document.querySelector('[data-site-footer]');
  if (footer) {
    footer.innerHTML =
      '<div class="footer__top">' +
        '<div class="newsletter">' +
          '<img src="assets/logos/vayence-footer.svg" width="169.88" height="32.24" alt="Vayence Inc">' +
          '<p class="title">Get updates on ProActive</p>' +
          '<form class="newsletter__form" data-newsletter novalidate>' +
            '<input type="email" name="email" placeholder="Email address" aria-label="Email address" autocomplete="email" required>' +
            '<button class="btn btn--primary btn--s" type="submit">Subscribe</button>' +
          '</form>' +
          '<p class="small form__status" role="status" aria-live="polite"></p>' +
        '</div>' +
        '<div class="footer__cols">' +
          NAV.map(function (g) {
            return '<div class="footer__col"><a class="label muted" href="' + g.href + '">' + esc(g.label) + '</a>' +
              g.items.map(function (it) { return '<a class="body" href="' + it[2] + '">' + esc(it[0]) + '</a>'; }).join('') +
              '</div>';
          }).join('') +
          '<div class="footer__col"><p class="label muted">Contact</p>' +
            '<a class="body" href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a>' +
            '<a class="body" href="https://www.linkedin.com/search/results/companies/?keywords=Vayence%20Inc" target="_blank" rel="noopener">LinkedIn</a>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="footer__bottom small muted">' +
        '<p class="footer__disclaimer">ProActive is in development and is not available for sale. It is not intended to diagnose, treat, cure or prevent any medical condition.</p>' +
        '<p>© 2026 Vayence Inc. All rights reserved.</p>' +
      '</div>';
  }

  // ---------- Menus: desktop dropdown panels, mobile drawer + accordions ----------
  if (header) {
    var toggle = header.querySelector('.menu-toggle');
    var groups = Array.prototype.slice.call(header.querySelectorAll('.nav__group'));

    var setGroup = function (group, open) {
      group.classList.toggle('is-open', open);
      group.querySelector('.nav__item').setAttribute('aria-expanded', String(open));
    };
    var closeGroups = function (except) {
      groups.forEach(function (g) { if (g !== except) setGroup(g, false); });
    };
    var syncPanelState = function () {
      header.classList.toggle('has-panel', groups.some(function (g) { return g.classList.contains('is-open'); }));
    };
    var setMenu = function (open) {
      header.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (!open) { closeGroups(); syncPanelState(); }
    };

    groups.forEach(function (g) {
      g.querySelector('.nav__item').addEventListener('click', function () {
        var open = !g.classList.contains('is-open');
        closeGroups(g);
        setGroup(g, open);
        syncPanelState();
      });
    });
    toggle.addEventListener('click', function () { setMenu(!header.classList.contains('is-open')); });
    header.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('click', function (e) {
      if (!header.contains(e.target)) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenu(false);
    });
    window.matchMedia('(min-width: 1101px)').addEventListener('change', function () { setMenu(false); });

    // Header goes from clear glass (over the hero video) to a solid white bar:
    // --p runs 0 → 1 over the first ~60% of the video's height
    var heroVideo = document.querySelector('.hero-video');
    var ticking = false;
    var updateHeader = function () {
      ticking = false;
      var p = 1;
      if (heroVideo) {
        var range = Math.max(heroVideo.offsetHeight * 0.6, 1);
        p = Math.min(Math.max(window.scrollY / range, 0), 1);
      }
      // foreground eases in over the middle of the range (smoothstep .25 → .6)
      var q = Math.min(Math.max((p - 0.25) / 0.35, 0), 1);
      q = q * q * (3 - 2 * q);
      header.style.setProperty('--p', p.toFixed(3));
      header.style.setProperty('--q', q.toFixed(3));
    };
    var requestUpdate = function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(updateHeader); }
    };
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    updateHeader();
  }

  // ---------- Releases ----------
  // Lists and post pages are static (scripts/build-releases.js); send old releases.html?post=<slug> links there
  var legacyPost = page === 'releases' && new URLSearchParams(window.location.search).get('post');
  if (legacyPost && /^[a-z0-9-]+$/.test(legacyPost)) window.location.replace('releases/' + legacyPost + '.html');

  // ---------- Partners marquee: duplicate the set so the loop is seamless ----------
  Array.prototype.slice.call(document.querySelectorAll('.marquee__track')).forEach(function (track) {
    var group = track.querySelector('.marquee__group');
    if (!group) return;
    var copy = group.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    Array.prototype.slice.call(copy.querySelectorAll('img')).forEach(function (img) { img.alt = ''; });
    track.appendChild(copy);
  });

  // ---------- Reveal on scroll ----------
  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    document.querySelectorAll('main .section').forEach(function (s) {
      s.classList.add('reveal');
      revealObserver.observe(s);
    });
  }

  // ---------- Background videos: honour reduced motion, pause while off screen ----------
  var videos = Array.prototype.slice.call(document.querySelectorAll('.video__media'));
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  videos.forEach(function (v) {
    if (reduceMotion) { v.removeAttribute('autoplay'); v.pause(); }
  });
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var videoObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        if (entry.isIntersecting) {
          var played = v.play();
          if (played && played.catch) played.catch(function () {});
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.15 });
    videos.forEach(function (v) { videoObserver.observe(v); });
  }

  // ---------- Forms (no backend yet: hand off to the visitor's mail client) ----------
  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  var form = document.getElementById('contact-form');
  if (form) {
    var status = form.querySelector('.form__status');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements.name;
      var email = form.elements.email;
      var role = form.elements.role;
      var message = form.elements.message;
      var invalid = [];

      [name, message].forEach(function (f) { if (!f.value.trim()) invalid.push(f); });
      if (!isEmail(email.value.trim())) invalid.push(email);

      [name, email, message].forEach(function (f) {
        f.classList.toggle('is-invalid', invalid.indexOf(f) !== -1);
      });
      if (invalid.length) {
        status.textContent = 'Please fill in the required fields.';
        invalid[0].focus();
        return;
      }

      var subject = 'ProActive enquiry from ' + name.value.trim() + ' (' + role.value + ')';
      var body = message.value.trim() + '\n\n—\n' + name.value.trim() + '\n' + email.value.trim() + '\n' + role.value;
      window.location.href = 'mailto:' + CONTACT_EMAIL +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);
      status.textContent = 'Opening your email app… If nothing happens, email us at ' + CONTACT_EMAIL + '.';
    });
    form.addEventListener('input', function (e) {
      e.target.classList.remove('is-invalid');
    });
  }

  Array.prototype.slice.call(document.querySelectorAll('form[data-newsletter]')).forEach(function (nf) {
    var nfStatus = nf.parentNode.querySelector('.form__status');
    nf.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = nf.elements.email.value.trim();
      if (!isEmail(email)) {
        nfStatus.textContent = 'Please enter a valid email address.';
        return;
      }
      // the team's own address opens the releases editor (admin.html checks the Google sign-in)
      if (email.toLowerCase() === CONTACT_EMAIL) {
        window.location.href = 'admin.html';
        return;
      }
      window.location.href = 'mailto:' + CONTACT_EMAIL +
        '?subject=' + encodeURIComponent('Subscribe to ProActive updates') +
        '&body=' + encodeURIComponent('Please add ' + email + ' to the ProActive updates list.');
      nfStatus.textContent = 'Thanks! Opening your email app to confirm.';
    });
  });
})();
