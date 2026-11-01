/* Data layer.
   Preview mode (no Firebase config): everything lives in this browser's localStorage,
   with one sample coffee, so the site can be tried straight away.
   Live mode (Firebase config in js/config.js): Firestore, updating live for everyone.

   coffees/{id}   cafe, date (YYYY-MM-DD), order, beans, description, createdAt   (added by Badriyah)
                  description = what the beans are supposed to taste like ("earthy, chocolatey and spicy")
                  question = her note to him ("You mentioned it's even more bitter. Is that a good thing?")
                  rating (1-5), heart (only with 5), comment, notes, ratedAt       (added by the taster)
                  own: true = a coffee he added himself, with his rating            (added by the taster) */
window.Store = (function () {
  const cfg = (window.CR_CONFIG || {}).firebase;
  const demo = !cfg;
  const FB = 'https://www.gstatic.com/firebasejs/10.14.1/';

  const clean = (s, max) => String(s || '').trim().slice(0, max);
  const coffeeBody = d => ({
    cafe: clean(d.cafe, 120),
    date: /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : UI.todayKW(),
    order: clean(d.order, 160),
    beans: clean(d.beans, 160),
    description: clean(d.description, 2000)
  });
  const ratingBody = r => {
    const rating = Math.max(1, Math.min(5, Math.round(+r.rating || 0)));
    return { rating, heart: !!r.heart && rating === 5, comment: clean(r.comment, 1000), notes: clean(r.notes, 1000) };
  };

  // A coffee he had on his own: his café, order and beans plus his rating, all at once
  const ownBody = d => ({
    cafe: clean(d.cafe, 120), order: clean(d.order, 160), beans: clean(d.beans, 160),
    date: UI.todayKW(), own: true, ...ratingBody(d)
  });

  /* ---------- preview mode ---------- */

  const KEY = 'cr-preview-v1';
  const listeners = new Set();
  const authListeners = new Set();
  let mem = null;

  function readLS() {
    try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function db() {
    if (!mem) { mem = readLS(); if (!mem) { mem = seed(); persist(); } }
    return mem;
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {} }
  function commit() { persist(); listeners.forEach(fn => fn()); }
  if (demo) {
    window.addEventListener('storage', e => {
      if (e.key !== KEY) return;
      mem = readLS() || seed();
      listeners.forEach(fn => fn());
    });
  }
  const newId = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

  // Preview only: one sample coffee waiting for a rating, nothing rated yet
  function seed() {
    return {
      coffees: {
        sample: {
          id: 'sample', date: UI.todayKW(), createdAt: Date.now(),
          cafe: 'Sample café',
          order: 'Hot V60',
          beans: 'Ethiopia Guji',
          description: 'fruity, floral and bright'
        }
      }
    };
  }

  const previewApi = {
    watchCoffees(cb) {
      const fn = () => cb(Object.values(db().coffees).map(c => ({ ...c })));
      listeners.add(fn);
      Promise.resolve().then(() => listeners.has(fn) && fn());
      return () => listeners.delete(fn);
    },
    async rate(id, r) {
      const c = db().coffees[id];
      if (!c) throw new Error('missing');
      Object.assign(c, ratingBody(r), { ratedAt: Date.now() });
      commit();
    },
    async addOwn(d) {
      const id = newId();
      db().coffees[id] = { id, ...ownBody(d), createdAt: Date.now(), ratedAt: Date.now() };
      commit();
    },
    async saveCoffee(id, data) {
      const body = coffeeBody(data);
      if (id && db().coffees[id]) Object.assign(db().coffees[id], body);
      else { id = newId(); db().coffees[id] = { id, ...body, createdAt: Date.now() }; }
      commit();
      return id;
    },
    async deleteCoffee(id) { delete db().coffees[id]; commit(); },
    // Preview has no real accounts: any password opens the site, and the admin page is always open.
    onAuth(cb) {
      const fn = () => {
        let inside = false;
        try { inside = !!sessionStorage.getItem('cr-preview-in'); } catch (e) {}
        cb(window.CR_ADMIN || inside ? { state: 'in', role: 'admin', email: 'Preview mode' } : { state: 'out' });
      };
      authListeners.add(fn);
      Promise.resolve().then(fn);
      return () => authListeners.delete(fn);
    },
    async enter(password) {
      if (!String(password || '').trim()) throw new Error('empty');
      try { sessionStorage.setItem('cr-preview-in', '1'); } catch (e) {}
      authListeners.forEach(fn => fn());
    },
    async signIn() {},
    async signOut() {
      try { sessionStorage.removeItem('cr-preview-in'); } catch (e) {}
      authListeners.forEach(fn => fn());
    }
  };

  /* ---------- live mode (Firebase) ---------- */

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }

  let fs = null;
  const ready = demo ? Promise.resolve() : loadScript(FB + 'firebase-app-compat.js')
    .then(() => Promise.all([
      loadScript(FB + 'firebase-firestore-compat.js'),
      loadScript(FB + 'firebase-auth-compat.js')
    ]))
    .then(() => { firebase.initializeApp(cfg); fs = firebase.firestore(); });

  /* Two kinds of account, both made in the Firebase console (public sign-up is off):
     the site's shared password belongs to taster@<authDomain>; any other account is Badriyah (admin). */
  const TASTER = cfg ? 'taster@' + cfg.authDomain : '';

  const coffees = () => fs.collection('coffees');
  const stamp = () => firebase.firestore.FieldValue.serverTimestamp();
  const millis = ts => (ts && ts.toMillis ? ts.toMillis() : (typeof ts === 'number' ? ts : null));
  const fromDoc = d => {
    const v = d.data();
    return { ...v, id: d.id, createdAt: millis(v.createdAt) || 0, ratedAt: millis(v.ratedAt) };
  };

  const liveApi = {
    watchCoffees(cb, onErr) {
      let off = null, stopped = false;
      ready.then(() => {
        if (stopped) return;
        off = coffees().onSnapshot(s => cb(s.docs.map(fromDoc)), e => onErr && onErr(e));
      }).catch(e => onErr && onErr(e));
      return () => { stopped = true; if (off) off(); };
    },
    async rate(id, r) {
      await ready;
      await coffees().doc(id).update({ ...ratingBody(r), ratedAt: stamp() });
    },
    async addOwn(d) {
      await ready;
      await coffees().add({ ...ownBody(d), createdAt: stamp(), ratedAt: stamp() });
    },
    async saveCoffee(id, data) {
      await ready;
      const body = coffeeBody(data);
      if (id) { await coffees().doc(id).update(body); return id; }
      return (await coffees().add({ ...body, createdAt: stamp() })).id;
    },
    async deleteCoffee(id) { await ready; await coffees().doc(id).delete(); },

    onAuth(cb) {
      let off = null, stopped = false;
      ready.then(() => {
        if (stopped) return;
        off = firebase.auth().onAuthStateChanged(user => {
          if (!user) return cb({ state: 'out' });
          cb({ state: 'in', email: user.email, role: user.email === TASTER ? 'taster' : 'admin' });
        });
      }).catch(() => cb({ state: 'out', error: true }));
      return () => { stopped = true; if (off) off(); };
    },
    async enter(password) {
      await ready;
      await firebase.auth().signInWithEmailAndPassword(TASTER, password);
    },
    async signIn(email, password) {
      await ready;
      // A plain username like "badriyah" means badriyah@<authDomain>
      const name = String(email || '').trim().toLowerCase();
      await firebase.auth().signInWithEmailAndPassword(name.includes('@') ? name : name + '@' + cfg.authDomain, password);
    },
    async signOut() { await ready; await firebase.auth().signOut(); }
  };

  return { demo, ready, ...(demo ? previewApi : liveApi) };
})();
