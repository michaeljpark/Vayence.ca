/* Releases shown on the home page and releases.html, newest first.
   Add a post by adding an object here; `slug` becomes releases.html?post=<slug>.
   Also add that URL to sitemap.xml so search engines find it.
   category: 'Awards' | 'Updates' | 'Newsletter'
   Optional: source {name, url}, links [{label, url}], videos [{title, embed, duration}], quote {text, cite}. */
window.VAYENCE_POSTS = [
  {
    slug: 'james-dyson-award-2026-canada',
    category: 'Awards',
    date: '2026-09-23',
    dateLabel: 'September 23, 2026',
    title: 'ProActive named Canada’s national winner of the 2026 James Dyson Award',
    excerpt: 'Marzuq Vohra and Vienna Doria-Pighin’s smart vest takes the Canadian title and advances to the international stage.',
    image: 'assets/img/cohort-event.png',
    imageAlt: 'Vayence Inc founders Marzuq Vohra and Vienna Doria-Pighin',
    body: [
      'ProActive, the smart wearable vest developed by Vayence Inc founders Marzuq Vohra and Vienna Doria-Pighin, has been named Canada’s national winner of the 2026 James Dyson Award.',
      'The $9,000 national prize will support the project’s next steps in development and commercialization. ProActive now advances to the international competition, alongside Canadian national runners-up AnemoSwab and SoleTrace, for a place on the international shortlist of 20 projects.',
      'Using skin-contact sensors, the vest continuously monitors biometric signals associated with rising stress. When heightened stress is detected, a compressor gently inflates air bladders within the garment, delivering a calming, hug-like deep pressure response. It stays active until readings return to baseline or the wearer turns it off, then deflates gradually.',
      'The project is rooted in personal experience for both designers: Vienna grew up with sensory sensitivities, and Marzuq watched his autistic brother navigate sensory overload.',
      'The work was supported by an independent study in OCAD University’s Industrial Design program, supervised by Industrial Design Chair Dr. Peter Coppin with involvement from the Perceptual Artifacts Lab, and by KITE Creates through FIBRE SONA VEE: Innovation in Wearable Therapeutic Technologies research funding.'
    ],
    quote: {
      text: '“We hope it brings greater validation to the work we’re doing, but more importantly, greater visibility to the community we’re working to serve.”',
      cite: 'Marzuq Vohra and Vienna Doria-Pighin, via OCAD University'
    },
    source: { name: 'OCAD University', url: 'https://www.ocadu.ca/news/ocad-u-alum-team-named-canadian-winner-2026-james-dyson-award-smart-vest-help-people-manage' },
    links: [
      { label: 'Project page on the James Dyson Award', url: 'https://www.jamesdysonaward.org/2026/project/the-proactive-project' }
    ]
  },
  {
    slug: 'startupfest-2026',
    category: 'Updates',
    date: '2026-07-10',
    dateLabel: 'July 2026',
    title: 'Vayence at Startupfest 2026 in Montreal',
    excerpt: 'Our first conference as a company — and a place among the finalists for one of the event’s prizes.',
    image: 'assets/img/startupfest-2026.jpg',
    imageAlt: 'Marzuq Vohra and Vienna Doria-Pighin at Startupfest 2026',
    imagePosition: '50% 20%',
    body: [
      'In July, Marzuq Vohra and Vienna Doria-Pighin attended Startupfest in Montreal, their first conference representing Vayence Inc.',
      'It was an opportunity to meet founders, investors and builders from across Canada, hear about ventures emerging in the startup ecosystem, and share more about what the team is building.',
      'Vayence was also selected as a finalist for one of the event’s prizes. The team did not take home the award, but being recognized at their first conference as a company was a milestone they were proud of.',
      'The team left Montreal energized, grateful for the experience, and even more committed to the work ahead.'
    ],
    quote: {
      text: '“A memorable first conference for Vayence, hopefully the first of many.”',
      cite: 'Marzuq Vohra, co-founder'
    }
  },
  {
    slug: 'rbc-cead-seed-fund-2026',
    category: 'Awards',
    date: '2026-05-13',
    dateLabel: 'May 13, 2026',
    title: 'Second prize in the 2026 Seed Fund for Creative Entrepreneurs',
    excerpt: 'Vayence Inc receives $5,000 from OCAD University’s RBC Centre for Emerging Artists & Designers.',
    image: 'assets/img/hero-visual.jpg',
    imageAlt: 'A person zipping up the ProActive vest prototype',
    body: [
      'Vayence Inc received the $5,000 second prize in the 2026 Seed Fund for Creative Entrepreneurs, run by OCAD University’s RBC Centre for Emerging Artists & Designers (CEAD).',
      'Now in its sixth year, the Seed Fund helps OCAD U students and recent alumni develop, test and grow creative business ideas. More than 30 applicants went through a review and validation process this year, and finalists joined a mentorship roundtable with industry professionals.',
      'OCAD U described Vayence as an innovative venture “developing a comforting, tactile product, a hug when you need it.”'
    ],
    source: { name: 'OCAD University', url: 'https://www.ocadu.ca/news/ocad-universitys-creative-entrepreneurs-receive-18000-through-2026-seed-fund-creative-0' }
  },
  {
    slug: 'dezeen-ocad-school-show-2025',
    category: 'Updates',
    date: '2025-10-07',
    dateLabel: 'October 7, 2025',
    title: 'ProActive featured in Dezeen’s OCAD University school show',
    excerpt: 'Dezeen features the self-inflating vest among projects from OCAD University’s Faculty of Design.',
    image: 'assets/img/dezeen-vest.jpg',
    imageAlt: 'The ProActive vest prototype lying flat, with its air tubes',
    body: [
      'Dezeen featured ProActive in its school show of projects from OCAD University’s Faculty of Design.',
      'The feature describes a reusable, self-inflating vest designed to support people with high care needs and sensory sensitivities, particularly autism, by applying deep pressure touch to ease sensory overload. It also notes that the designers have filed a patent and launched a company to bring the product to market.'
    ],
    source: { name: 'Dezeen', url: 'https://www.dezeen.com/2025/10/07/rehabilitation-device-stroke-survivors-ocad-university-schoolshows/' }
  },
  {
    slug: 'ocad-video-series-2025',
    category: 'Updates',
    date: '2025-08-26',
    dateLabel: 'August 26, 2025',
    title: 'The Proactive Vest Project: an OCAD U video series',
    excerpt: 'Three short films on the design challenge, how the project was made at OCAD U, and a product demo.',
    image: 'assets/img/ocad-video-series.jpg',
    imageAlt: 'Vienna Doria-Pighin and Marzuq Vohra in the OCAD U Rapid Prototyping Centre',
    imagePosition: '50% 30%',
    body: [
      'OCAD University published a three-part video series on the Proactive Vest Project by 2025 Industrial Design graduates Vienna Doria-Pighin and Marzuq Vohra.',
      'The films cover the design challenge behind the vest, how OCAD U made the project possible, and a demonstration of the prototype.'
    ],
    videos: [
      { title: 'The Design Challenge', duration: '2:09', embed: 'https://player.vimeo.com/video/1113280882?h=d5bf0ddea3' },
      { title: 'How OCAD U made it possible', duration: '2:18', embed: 'https://player.vimeo.com/video/1113280919?h=fc971c88ad' },
      { title: 'Product Demo', duration: '3:23', embed: 'https://player.vimeo.com/video/1113280948?h=96e9a0b056' }
    ],
    source: { name: 'Vimeo', cta: 'Watch the series on Vimeo', url: 'https://vimeo.com/showcase/11849266' }
  },
  {
    slug: 'acido-peoples-choice-2025',
    category: 'Awards',
    date: '2025-06-01',
    dateLabel: '2025',
    title: 'People’s Choice Award from ACIDO',
    excerpt: 'ProActive receives the People’s Choice Award from the Association of Chartered Industrial Designers of Ontario.',
    image: 'assets/img/acido-founders.jpg',
    imageAlt: 'Marzuq Vohra and Vienna Doria-Pighin in front of their ProActive research boards',
    imagePosition: '50% 30%',
    body: [
      'ProActive received the 2025 People’s Choice Award from ACIDO, the Association of Chartered Industrial Designers of Ontario, at its Rocket showcase.'
    ],
    source: { name: 'OCAD University', url: 'https://www.ocadu.ca/news/ocad-u-alum-team-named-canadian-winner-2026-james-dyson-award-smart-vest-help-people-manage' }
  },
  {
    slug: 'cboe-disruptive-design-2025',
    category: 'Awards',
    date: '2025-05-31',
    dateLabel: '2025',
    title: 'CBOE Canada Award for Disruptive Design',
    excerpt: 'Marzuq Vohra and Vienna Doria-Pighin receive OCAD U’s 2025 CBOE Canada Award for Disruptive Design.',
    image: 'assets/video/vest-inflating-poster.jpg',
    imageAlt: 'The ProActive vest lying flat before it inflates',
    body: [
      'Marzuq Vohra and Vienna Doria-Pighin received OCAD University’s 2025 CBOE Canada Award for Disruptive Design for the ProActive project, recognized at their 2025 convocation.'
    ],
    source: { name: 'OCAD University', url: 'https://www.ocadu.ca/news/ocad-u-alum-team-named-canadian-winner-2026-james-dyson-award-smart-vest-help-people-manage' }
  }
];
