/* Small shared helpers: escaping, dates in Kuwait time, star + heart drawings, toast. */
window.UI = (function () {
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Today's date in Kuwait as YYYY-MM-DD
  const todayKW = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuwait', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());

  // "2026-10-31" -> "31 Oct 2026"
  function fmtDate(iso, opts) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC', ...(opts || {}) });
  }

  const STAR = '<path class="s" d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z"/>';
  const HEART = '<path class="h" d="M12 20.3s-7.6-4.6-7.6-10A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.6 2.7c0 5.4-7.6 10-7.6 10z"/>';
  const starSVG = () => '<svg viewBox="0 0 24 24" aria-hidden="true">' + STAR + '</svg>';
  const heartSVG = () => '<svg viewBox="0 0 24 24" aria-hidden="true">' + HEART + '</svg>';

  // Read-only stars for the table
  function mini(rating, heart) {
    let s = '<span class="mini" aria-label="' + rating + ' out of 5' + (heart ? ', loved it' : '') + '">';
    for (let i = 1; i <= 5; i++) s += '<span class="' + (i <= rating ? 'on' : '') + '">' + starSVG() + '</span>';
    if (heart) s += '<span class="heart">' + heartSVG() + '</span>';
    return s + '</span>';
  }

  const WORDS = ['', 'Not for me', 'Okay', 'Good', 'Really good', 'Excellent'];
  const word = (rating, heart) => (heart ? 'Excellent, loved it' : WORDS[rating] || '');

  let timer;
  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => { el.hidden = true; }, 2400);
  }

  return { esc, todayKW, fmtDate, starSVG, heartSVG, mini, word, toast };
})();
