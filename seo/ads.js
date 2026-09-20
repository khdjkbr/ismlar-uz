(() => {
  'use strict';
  const config = window.BOLAGA_ADS || { mode: 'off', network: 'yandex' };
  if (config.mode !== 'live' || config.network !== 'yandex' || location.hostname !== 'bolagaism.uz') return;
  const placements = [...document.querySelectorAll('.ad-placement[data-block-id]')];
  if (!placements.length) return;
  window.yaContextCb = window.yaContextCb || [];
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://yandex.ru/ads/system/context.js';
  script.onerror = () => placements.forEach((el) => { el.dataset.state = 'empty'; });
  document.head.append(script);
  placements.forEach((el) => {
    const target = el.querySelector('.ad-space');
    const renderTo = `yandex_rtb_${el.dataset.blockId.replace(/[^a-z0-9_-]/gi, '_')}`;
    target.id = renderTo;
    window.yaContextCb.push(() => {
      try {
        Ya.Context.AdvManager.render({ blockId: el.dataset.blockId, renderTo });
      } catch (e) {
        el.dataset.state = 'empty';
      }
    });
  });
})();
