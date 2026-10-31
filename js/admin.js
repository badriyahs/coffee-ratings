/* Private page: Badriyah adds each day's coffee (café, date, coffee, beans, description). */
(function () {
  const $ = id => document.getElementById(id);
  const { esc, fmtDate, todayKW, mini, toast } = UI;
  const state = { coffees: [], editing: null, confirming: null, off: null };

  /* ---------- Sign in ---------- */

  Store.onAuth(a => {
    const inside = a.state === 'in' && a.role === 'admin';
    $('signIn').hidden = inside;
    $('panel').hidden = !inside;
    $('listBox').hidden = !inside;
    $('signOut').hidden = !inside || Store.demo;
    if (inside && !state.off) {
      state.off = Store.watchCoffees(list => { state.coffees = list; renderList(); },
        () => toast('Could not load coffees'));
    }
    if (!inside && state.off) { state.off(); state.off = null; }
  });

  $('signIn').addEventListener('submit', e => {
    e.preventDefault();
    $('signInErr').hidden = true;
    Store.signIn($('email').value, $('password').value).catch(() => {
      $('signInErr').textContent = 'Email or password is wrong';
      $('signInErr').hidden = false;
    });
  });
  $('signOut').addEventListener('click', e => { e.preventDefault(); Store.signOut(); });

  /* ---------- Add / edit ---------- */

  function resetForm() {
    state.editing = null;
    $('coffeeForm').reset();
    $('date').value = todayKW();
    $('formTitle').textContent = 'Add a coffee';
    $('saveBtn').textContent = 'Add';
    $('cancelEdit').hidden = true;
  }
  resetForm();

  $('coffeeForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      date: $('date').value, cafe: $('cafe').value, order: $('order').value,
      beans: $('beans').value, description: $('description').value
    };
    const editing = state.editing;
    $('saveBtn').disabled = true;
    Store.saveCoffee(editing, data).then(() => {
      toast(editing ? 'Saved' : 'Added');
      resetForm();
    }).catch(() => toast('Could not save. Try again.'))
      .finally(() => { $('saveBtn').disabled = false; });
  });
  $('cancelEdit').addEventListener('click', resetForm);

  /* ---------- List ---------- */

  function renderList() {
    const list = state.coffees.slice().sort((a, b) =>
      (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
    $('list').innerHTML = list.length ? list.map(c => {
      const tools = state.confirming === c.id
        ? '<button type="button" class="btn-line danger" data-del="' + esc(c.id) + '">Yes, delete</button>' +
          '<button type="button" class="btn-line" data-keep>Keep</button>'
        : '<button type="button" class="btn-line" data-edit="' + esc(c.id) + '">Edit</button>' +
          '<button type="button" class="btn-line" data-ask="' + esc(c.id) + '">Delete</button>';
      return '<div class="admin-row"><div>' +
          '<div class="date">' + esc(fmtDate(c.date)) + '</div>' +
          '<div class="td-cafe">' + esc(c.cafe) + '</div>' +
          '<div>' + esc(c.order) + (c.beans ? ' · <span class="status">' + esc(c.beans) + '</span>' : '') + '</div>' +
          '<div class="status">' + (c.rating ? mini(c.rating, c.heart) + (c.comment ? ' “' + esc(c.comment) + '”' : '') : 'Not rated yet') + '</div>' +
        '</div><div class="tools">' + tools + '</div></div>';
    }).join('') : '<p class="status" style="padding:16px 0">No coffees yet</p>';

    const cafes = [...new Set(state.coffees.map(c => c.cafe).filter(Boolean))];
    $('cafes').innerHTML = cafes.map(v => '<option value="' + esc(v) + '">').join('');
  }

  $('list').addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.edit) {
      const c = state.coffees.find(x => x.id === t.dataset.edit);
      if (!c) return;
      state.editing = c.id;
      $('date').value = c.date || todayKW();
      $('cafe').value = c.cafe || '';
      $('order').value = c.order || '';
      $('beans').value = c.beans || '';
      $('description').value = c.description || '';
      $('formTitle').textContent = 'Edit coffee';
      $('saveBtn').textContent = 'Save';
      $('cancelEdit').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (t.dataset.ask) { state.confirming = t.dataset.ask; renderList(); }
    else if ('keep' in t.dataset) { state.confirming = null; renderList(); }
    else if (t.dataset.del) {
      Store.deleteCoffee(t.dataset.del).then(() => { state.confirming = null; toast('Deleted'); })
        .catch(() => toast('Could not delete. Try again.'));
    }
  });
})();
