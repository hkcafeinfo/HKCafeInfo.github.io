/* Six saved site themes. Each occupies two calendar months in Hong Kong. */
(() => {
  'use strict';
  const themes = ['amber', 'fuji', 'skyblue', 'firebrick', 'moonlight', 'hojicha'];
  function themeForHKDate(year, month) {
    const elapsedMonths = (year - 2026) * 12 + month - 11;
    const period = Math.max(0, Math.floor(elapsedMonths / 2));
    return themes[period % themes.length];
  }
  function currentHKDate() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Hong_Kong', year: 'numeric', month: 'numeric', day: 'numeric'
    }).formatToParts(new Date());
    const value = (type) => Number(parts.find((part) => part.type === type).value);
    return [value('year'), value('month'), value('day')];
  }
  function apply() {
    const theme = themeForHKDate(...currentHKDate());
    document.documentElement.dataset.theme = theme;
    return theme;
  }
  window.HKCITheme = Object.freeze({ themes: Object.freeze([...themes]), themeForHKDate, apply });
  apply();
  window.setInterval(apply, 60 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) apply(); });
})();
