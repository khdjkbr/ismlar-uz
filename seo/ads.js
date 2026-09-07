(() => {
  'use strict';
  const config = window.BOLAGA_ADS || {mode: 'off'};
  if (config.mode !== 'live' || !config.consentVerified || location.hostname !== 'bolagaism.uz') return;
  // The certified CMP is configured in the publisher account, not replaced by a custom cookie banner.
  const placements = [...document.querySelectorAll('.ad-placement[data-slot]')];
  if (!placements.length) return;
  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(config.publisher);
  const empty = el => { el.dataset.state = 'empty'; };
  script.onerror = () => placements.forEach(empty);
  document.head.append(script);
  const request = el => {
    if (el.dataset.requested || !el.getBoundingClientRect().width) return;
    el.dataset.requested = 'true';
    const ad = document.createElement('ins');
    ad.className = 'adsbygoogle';
    ad.dataset.adClient = config.publisher;
    ad.dataset.adSlot = el.dataset.slot;
    el.querySelector('.ad-space').append(ad);
    const observer = new MutationObserver(() => {
      if (ad.dataset.adStatus === 'unfilled') empty(el);
      if (ad.dataset.adStatus) observer.disconnect();
    });
    observer.observe(ad, {attributes: true, attributeFilter: ['data-ad-status']});
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { empty(el); }
    // Local diagnostic only. Never count ad clicks or simulate impressions.
    document.dispatchEvent(new CustomEvent('bolaga:ad-request', {detail: {placement: el.dataset.placement}}));
  };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { request(entry.target); observer.unobserve(entry.target); }
    }), {rootMargin: '200px'});
    placements.forEach(el => observer.observe(el));
  } else placements.forEach(request);
})();
