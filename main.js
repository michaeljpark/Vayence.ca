(function () {
  var CONTACT_EMAIL = 'theproactiveproject@gmail.com';

  var header = document.querySelector('.header');
  var toggle = document.querySelector('.menu-toggle');
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav__item'));

  // Mobile menu
  function setMenu(open) {
    header.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  toggle.addEventListener('click', function () {
    setMenu(!header.classList.contains('is-open'));
  });
  header.addEventListener('click', function (e) {
    if (e.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenu(false);
  });

  // Header shadow once the page scrolls
  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if ('IntersectionObserver' in window) {
    // Highlight the nav item for the section in view
    var byId = {};
    navLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) { a.classList.remove('is-active'); });
        var link = byId[entry.target.id];
        if (link) link.classList.add('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach(function (s) { sectionObserver.observe(s); });

    // Fade sections in as they enter the viewport
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

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  // Contact form: validate, then hand off to the visitor's mail client
  var form = document.getElementById('contact-form');
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

  // Newsletter: no backend yet, so send the sign-up request by email
  var newsletter = document.getElementById('newsletter-form');
  var newsletterStatus = document.getElementById('newsletter-status');
  newsletter.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = newsletter.elements.email.value.trim();
    if (!isEmail(email)) {
      newsletterStatus.textContent = 'Please enter a valid email address.';
      return;
    }
    window.location.href = 'mailto:' + CONTACT_EMAIL +
      '?subject=' + encodeURIComponent('Subscribe to ProActive updates') +
      '&body=' + encodeURIComponent('Please add ' + email + ' to the ProActive updates list.');
    newsletterStatus.textContent = 'Thanks! Opening your email app to confirm.';
  });
})();
