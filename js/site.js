/* Public page: today's coffee (rate it) + the ratings table. */
(function () {
  const $ = id => document.getElementById(id);
  const { esc, fmtDate, todayKW, starSVG, heartSVG, mini, word, toast } = UI;

  const state = {
    loaded: false,
    coffees: [],
    sort: 'new',
    drafts: {},            // id -> {rating, heart, comment, notes} while rating
    justRated: new Set(),  // rated during this visit: keep showing them with a thank-you
    saving: new Set(),
    todaySig: ''
  };
  try { if (localStorage.getItem('cr-sort') === 'best') state.sort = 'best'; } catch (e) {}

  /* ---------- Today ---------- */

  function todayList() {
    const today = todayKW();
    return state.coffees
      .filter(c => (!c.rating && c.date <= today) || state.justRated.has(c.id))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
  }

  function draftFor(c) {
    if (!state.drafts[c.id]) state.drafts[c.id] = { rating: 0, heart: false, comment: '', notes: '' };
    return state.drafts[c.id];
  }

  // Her note: "How was today's coffee? It was from …, …, beans: … From my research … But how was it?"
  function info(c) {
    const from = [c.cafe && '<b>' + esc(c.cafe) + '</b>', c.order && '<b>' + esc(c.order) + '</b>',
      c.beans && 'beans: <b>' + esc(c.beans) + '</b>'].filter(Boolean).join(', ');
    return '<div class="card-info">' +
      '<span class="date">' + esc(fmtDate(c.date, { weekday: 'long' })) + '</span>' +
      '<h3 class="ask">How was today’s coffee?</h3>' +
      (from ? '<p class="said">It was from ' + from + '.</p>' : '') +
      (c.description ? '<p class="said">From my research, these beans are supposed to be <b>' + esc(c.description.replace(/\.$/, '')) + '</b>.</p>' : '') +
      (c.question ? '<p class="said">' + esc(c.question) + '</p>' : '') +
      '<p class="ask-2">But how was it?</p>' +
    '</div>';
  }

  function rateForm(c) {
    return '<form class="card-rate" data-id="' + esc(c.id) + '">' + rateFields(c) + '</form>';
  }

  function rateFields(c) {
    const d = draftFor(c);
    let stars = '';
    for (let i = 1; i <= 5; i++) {
      stars += '<button type="button" class="star-btn' + (i <= d.rating ? ' on' : '') + '" data-star="' + i +
        '" role="radio" aria-checked="' + (d.rating === i) + '" aria-label="' + i + ' star' + (i > 1 ? 's' : '') + '">' + starSVG() + '</button>';
    }
    stars += '<button type="button" class="heart-btn" data-heart aria-pressed="' + d.heart + '" aria-label="Loved it">' + heartSVG() + '</button>';
    const busy = state.saving.has(c.id);
    return '<span class="label" id="r-' + esc(c.id) + '">Rating</span>' +
      '<div class="stars" role="radiogroup" aria-labelledby="r-' + esc(c.id) + '">' + stars + '</div>' +
      '<div class="word">' + esc(word(d.rating, d.heart)) + '</div>' +
      '<label class="label" for="c-' + esc(c.id) + '">Comment</label>' +
      '<textarea id="c-' + esc(c.id) + '" data-field="comment" maxlength="1000">' + esc(d.comment) + '</textarea>' +
      '<label class="label" for="n-' + esc(c.id) + '">Notes</label>' +
      '<textarea id="n-' + esc(c.id) + '" data-field="notes" maxlength="1000">' + esc(d.notes) + '</textarea>' +
      '<button class="btn" type="submit"' + (!ready(c.id) || busy ? ' disabled' : '') + '>' + (busy ? 'Saving' : 'Submit') + '</button>';
  }

  // Ready to submit: a rating, and for his own coffee also a café and an order
  function ready(id) {
    const d = state.drafts[id];
    if (!d || !d.rating) return false;
    return id !== OWN || !!(d.cafe && d.cafe.trim() && d.order && d.order.trim());
  }

  /* ---------- His own coffee ---------- */

  const OWN = 'own';
  let ownOpen = false;

  function ownField(label, key, required) {
    const d = state.drafts[OWN];
    return '<div class="field"><label for="o-' + key + '">' + label + '</label>' +
      '<input type="text" id="o-' + key + '" data-field="' + key + '" maxlength="' + (key === 'cafe' ? 120 : 160) + '"' +
      (required ? ' required' : '') + ' value="' + esc(d[key] || '') + '"></div>';
  }

  function renderOwn() {
    $('openOwn').setAttribute('aria-expanded', String(ownOpen));
    if (!ownOpen) { $('ownBox').innerHTML = ''; return; }
    if (!state.drafts[OWN]) state.drafts[OWN] = { cafe: '', order: '', beans: '', rating: 0, heart: false, comment: '', notes: '' };
    $('ownBox').innerHTML = '<form class="card" data-id="' + OWN + '" autocomplete="off">' +
      '<div class="card-info">' +
        '<h3 class="ask">What’s today’s coffee?</h3>' +
        ownField('Café', 'cafe', true) + ownField('Order', 'order', true) + ownField('Beans', 'beans', false) +
      '</div>' +
      '<div class="card-rate">' + rateFields({ id: OWN }) +
        '<button type="button" class="btn-line" data-close-own style="align-self:flex-start">Cancel</button>' +
      '</div>' +
    '</form>';
    $('ownBox').scrollIntoView({ block: 'start' });
    $('o-cafe').focus({ preventScroll: true });
  }

  // The + in the header opens it (or brings it back into view if it's already open)
  $('openOwn').addEventListener('click', () => {
    if (ownOpen) { $('ownBox').scrollIntoView({ block: 'start' }); return; }
    ownOpen = true;
    renderOwn();
  });

  function doneBlock(c) {
    return '<div class="card-rate">' +
      '<span class="label">Rating</span>' +
      '<div class="stars">' + mini(c.rating, c.heart).replace('class="mini"', 'class="mini big"') + '</div>' +
      '<div class="word">' + esc(word(c.rating, c.heart)) + '</div>' +
      (c.comment ? '<span class="label">Comment</span><p class="done-text">' + esc(c.comment) + '</p>' : '') +
      (c.notes ? '<span class="label">Notes</span><p class="done-text">' + esc(c.notes) + '</p>' : '') +
      '<span class="thanks">Thank you</span>' +
    '</div>';
  }

  function renderToday(force) {
    const list = todayList();
    const sig = JSON.stringify(list.map(c => [c.id, c.cafe, c.date, c.order, c.beans, c.description, c.rating, c.heart, c.comment,
      c.notes, state.saving.has(c.id)])) + state.loaded;
    if (!force && sig === state.todaySig) return; // keep what's being typed
    state.todaySig = sig;

    const box = $('todayCards');
    if (!state.loaded) { box.innerHTML = ''; return; }
    if (!list.length) { box.innerHTML = '<div class="waiting">Next coffee soon</div>'; return; }
    box.innerHTML = list.map(c => {
      return '<article class="card">' + info(c) + (c.rating ? doneBlock(c) : rateForm(c)) + '</article>';
    }).join('');
  }

  function paintStars(form) {
    const d = state.drafts[form.dataset.id];
    form.querySelectorAll('[data-star]').forEach(b => {
      const n = +b.dataset.star;
      b.classList.toggle('on', n <= d.rating);
      b.setAttribute('aria-checked', String(n === d.rating));
    });
    form.querySelector('[data-heart]').setAttribute('aria-pressed', String(d.heart));
    form.querySelector('.word').textContent = word(d.rating, d.heart);
    form.querySelector('[type="submit"]').disabled = !ready(form.dataset.id) || state.saving.has(form.dataset.id);
  }

  $('today').addEventListener('click', e => {
    if (e.target.closest('[data-close-own]')) { ownOpen = false; delete state.drafts[OWN]; renderOwn(); return; }
    const form = e.target.closest('form[data-id]');
    if (!form) return;
    const d = state.drafts[form.dataset.id];
    const star = e.target.closest('[data-star]');
    const heart = e.target.closest('[data-heart]');
    if (star) {
      d.rating = +star.dataset.star;
      if (d.rating < 5) d.heart = false;
      paintStars(form);
    } else if (heart) {
      d.heart = !d.heart;
      if (d.heart) d.rating = 5;
      paintStars(form);
    }
  });

  $('today').addEventListener('input', e => {
    const field = e.target.dataset.field;
    if (!field) return;
    const form = e.target.closest('form[data-id]');
    state.drafts[form.dataset.id][field] = e.target.value;
    if (form.dataset.id === OWN) paintStars(form);
  });

  $('today').addEventListener('submit', e => {
    e.preventDefault();
    const form = e.target.closest('form[data-id]');
    const id = form.dataset.id;
    const d = state.drafts[id];
    if (!ready(id) || state.saving.has(id)) return;
    if (id === OWN) {
      state.saving.add(OWN);
      paintStars(form);
      Store.addOwn(d).then(() => {
        state.saving.delete(OWN);
        ownOpen = false;
        delete state.drafts[OWN];
        renderOwn();
        toast('Added');
      }).catch(() => {
        state.saving.delete(OWN);
        paintStars(form);
        toast('Could not save. Try again.');
      });
      return;
    }
    state.saving.add(id);
    renderToday(true);
    Store.rate(id, d).then(() => {
      state.saving.delete(id);
      state.justRated.add(id);
      delete state.drafts[id];
      toast('Saved');
      renderToday(true);
    }).catch(() => {
      state.saving.delete(id);
      renderToday(true);
      toast('Could not save. Try again.');
    });
  });

  /* ---------- Ratings table ---------- */

  function renderTable() {
    const rows = state.coffees.filter(c => c.rating);
    const score = c => c.rating + (c.heart ? 0.5 : 0);
    rows.sort(state.sort === 'best'
      ? (a, b) => score(b) - score(a) || (b.date || '').localeCompare(a.date || '')
      : (a, b) => (b.date || '').localeCompare(a.date || '') || (b.ratedAt || 0) - (a.ratedAt || 0));

    $('sortNew').setAttribute('aria-pressed', String(state.sort === 'new'));
    $('sortBest').setAttribute('aria-pressed', String(state.sort === 'best'));
    document.querySelector('.th').hidden = !rows.length;

    if (!state.loaded) { $('rows').innerHTML = ''; return; }
    if (!rows.length) {
      let ghost = '';
      for (let i = 0; i < 5; i++) ghost += '<g transform="translate(' + (i * 20) + ' 5)">' + '<path class="s" d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z"/></g>';
      $('rows').innerHTML = '<div class="empty" role="row"><svg viewBox="0 0 124 34" aria-hidden="true">' + ghost + '</svg>' +
        '<p role="cell">The first rating will sit here</p></div>';
      return;
    }
    $('rows').innerHTML = rows.map(c =>
      '<div class="tr' + (c.heart ? ' loved' : '') + '" role="row">' +
        '<span class="td-date" role="cell">' + esc(fmtDate(c.date)) + '</span>' +
        '<span class="td-cafe" role="cell">' + esc(c.cafe) + (c.own ? '<span class="own-tag">His pick</span>' : '') + '</span>' +
        '<span class="td-coffee" role="cell"><b>' + esc(c.order) + '</b>' + (c.beans ? '<span>' + esc(c.beans) + '</span>' : '') + '</span>' +
        '<span class="td-rating" role="cell">' + mini(c.rating, c.heart) + '</span>' +
        '<span class="td-comment" role="cell">' + esc(c.comment || '') + '</span>' +
        '<span class="td-notes" role="cell">' + esc(c.notes || '') + '</span>' +
      '</div>'
    ).join('');
  }

  function setSort(s) {
    state.sort = s;
    try { localStorage.setItem('cr-sort', s); } catch (e) {}
    renderTable();
  }
  $('sortNew').addEventListener('click', () => setSort('new'));
  $('sortBest').addEventListener('click', () => setSort('best'));

  /* ---------- Password + data ---------- */

  let off = null;
  Store.onAuth(a => {
    const inside = a.state === 'in';
    $('gate').hidden = inside;
    $('main').hidden = !inside;
    $('navLinks').hidden = !inside;
    if (inside && !off) {
      off = Store.watchCoffees(list => {
        state.coffees = list;
        state.loaded = true;
        renderToday();
        renderTable();
        if (!ownOpen) renderOwn(); // never rebuild the form while he's typing
      }, () => {
        state.loaded = true;
        renderToday();
        renderTable();
        toast('Could not load ratings. Check your connection.');
      });
    }
    if (!inside && off) { off(); off = null; state.loaded = false; state.coffees = []; }
    if (!inside && !a.error) setTimeout(() => $('pw').focus(), 0);
  });

  $('gate').addEventListener('submit', e => {
    e.preventDefault();
    $('gateErr').hidden = true;
    Store.enter($('pw').value).catch(() => {
      $('gateErr').textContent = 'Wrong password';
      $('gateErr').hidden = false;
      $('pw').select();
    });
  });

  renderToday(true);
  renderTable();
})();
