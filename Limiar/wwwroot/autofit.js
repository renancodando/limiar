(() => {
  'use strict';
  // Bounded local layout feedback. No model, API, tracking, or polling.
  const groups = [...document.querySelectorAll('.hero, .manifesto, .manifesto-body, .experiment-intro, .hero-bottom, .footer-top')];
  let queued = false;
  let previousWidth = 0;
  function overflowing(group) {
    const box = group.getBoundingClientRect();
    return [...group.children].some(child => {
      const bounds = child.getBoundingClientRect();
      return child.scrollWidth > child.clientWidth + 2 || bounds.right > box.right + 2 || bounds.left < box.left - 2;
    });
  }
  function adapt() {
    queued = false;
    const width = document.documentElement.clientWidth;
    // Reset only on a real available-width change, avoiding observer oscillation.
    if (Math.abs(width - previousWidth) > 2) groups.forEach(group => group.classList.remove('auto-stack'));
    previousWidth = width;
    const hero = groups[0];
    const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    if (hero && hero.clientWidth < fontSize * 54) hero.classList.add('auto-stack');
    // Two bounded passes account for parent layout changes.
    for (let pass = 0; pass < 2; pass++) {
      groups.forEach(group => {if (overflowing(group)) group.classList.add('auto-stack');});
    }
    document.documentElement.dataset.layout = 'measured';
  }
  function schedule() {if (!queued) {queued = true;requestAnimationFrame(adapt);}}
  const observer = new ResizeObserver(schedule);
  observer.observe(document.documentElement);
  groups.forEach(group => observer.observe(group));
  window.addEventListener('resize', schedule, {passive:true});
  window.visualViewport?.addEventListener('resize', schedule, {passive:true});
  document.fonts?.ready.then(schedule);
  document.fonts?.addEventListener('loadingdone', schedule);
  schedule();
})();
