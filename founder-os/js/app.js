/* Creative Cut Founder OS — app shell, navigation, persistence */
(function () {
  const CC = window.CC;
  const { D, html, Icon, Btn } = CC;
  const { useState, useEffect, useMemo, useRef, useCallback } = React;
  const LS = 'cc-founder-os-v1';

  const NAV = [
    ['dashboard', 'Founder Dashboard', 'dashboard'], ['mindmap', 'Business Mind Map', 'map'], ['production', 'Client Production', 'film'],
    ['team', 'Team Management', 'users'], ['sprint', 'Nine-Day Sprint', 'rocket'], ['product', 'Creative Captions', 'captions'],
    ['ads', 'Meta Ads', 'megaphone'], ['crm', 'Sales CRM', 'target'], ['finance', 'Financial Center', 'wallet'],
    ['personal', 'Personal Growth', 'activity'], ['meetings', 'Meetings & Reviews', 'meetings'], ['reports', 'Reports & Settings', 'chart'],
  ];
  const VIEWS = { dashboard: 'Dashboard', mindmap: 'MindMap', production: 'Production', team: 'Team', sprint: 'Sprint', product: 'Product', ads: 'Ads', crm: 'CRM', finance: 'Finance', personal: 'Personal', meetings: 'Meetings', reports: 'Reports' };

  const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
  function fill(t, b) { for (const k of Object.keys(b)) { if (t[k] === undefined) t[k] = JSON.parse(JSON.stringify(b[k])); else if (isObj(t[k]) && isObj(b[k]) && !['log', 'weekTargets'].includes(k)) fill(t[k], b[k]); } return t; }
  const migrate = (d) => fill(d, CC.seed());
  function loadLocal() { try { const t = localStorage.getItem(LS); if (t) { const d = JSON.parse(t); if (d && d.meta) return migrate(d); } } catch (e) { /* storage unavailable */ } return null; }
  function saveLocal(s) { try { localStorage.setItem(LS, JSON.stringify(s)); return true; } catch (e) { return false; } }

  function App() {
    const [s, setS] = useState(() => loadLocal() || CC.seed());
    const initialHash = (location.hash || '').replace('#', '');
    const [route, setRoute] = useState({ section: VIEWS[initialHash] ? initialHash : 'dashboard', sub: null, n: 0 });
    const [modal, setModal] = useState(null);
    const [conf, setConf] = useState(null);
    const [toasts, setToasts] = useState([]);
    const [navOpen, setNavOpen] = useState(false);
    const [quick, setQuick] = useState(false);
    const [sync, setSync] = useState({ mode: 'local', label: 'This browser only', savedAt: null });
    const [, tick] = useState(0);
    const M = useMemo(() => CC.model(s), [s]);
    const sRef = useRef(s); sRef.current = s;
    const cloud = useRef({ ref: null, timer: null, inflight: false, pending: false, skip: false, lastJson: '' });

    const up = useCallback((fn) => setS((prev) => { const d = JSON.parse(JSON.stringify(prev)); fn(d); d.meta.updatedAt = Date.now(); return d; }), []);
    const replaceAll = useCallback((data) => { const d = migrate(JSON.parse(JSON.stringify(data))); d.meta.updatedAt = Date.now(); setS(d); }, []);
    const toast = useCallback((text, kind) => { const id = Math.random(); setToasts((t) => [...t, { id, text, kind }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800); }, []);
    const confirm = useCallback((c) => new Promise((resolve) => setConf({ c, resolve })), []);
    const open = useCallback((kind, id, defaults, patch) => { setQuick(false); setModal({ kind, id: id || null, defaults, patch, k: Math.random() }); }, []);
    const go = useCallback((section, sub) => { setRoute((r) => ({ section, sub: sub || null, n: r.n + 1 })); setNavOpen(false); try { history.replaceState(null, '', '#' + section); } catch (e) { location.hash = section; } window.scrollTo(0, 0); document.querySelector('.main')?.scrollTo?.(0, 0); }, []);

    useEffect(() => { const f = () => { const h = location.hash.replace('#', ''); if (VIEWS[h]) setRoute((r) => ({ section: h, sub: null, n: r.n + 1 })); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
    useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t); }, []);

    /* cloud persistence: one private document per signed-in user */
    const writeCloud = useCallback(async () => {
      const c = cloud.current; if (!c.ref) return;
      if (c.inflight) { c.pending = true; return; }
      const json = JSON.stringify(sRef.current); if (json === c.lastJson) return;
      if (json.length > 250000) { setSync((x) => ({ ...x, mode: 'warn', label: 'Too large for account sync — saved in this browser. Export a backup.' })); return; }
      c.inflight = true; setSync((x) => ({ ...x, mode: 'saving', label: 'Saving to your Claude account…' }));
      try { await c.ref.set({ json, updatedAt: sRef.current.meta.updatedAt, v: 1 }); c.lastJson = json; setSync({ mode: 'cloud', label: 'Saved to your Claude account', savedAt: Date.now() }); }
      catch (e) { setSync((x) => ({ ...x, mode: 'warn', label: e && e.code === 'quota_exceeded' ? 'Account storage full — saved in this browser' : 'Account save failed — saved in this browser' })); }
      c.inflight = false; if (c.pending) { c.pending = false; setTimeout(writeCloud, 400); }
    }, []);
    useEffect(() => {
      let alive = true;
      (async () => {
        if (!window.claude || !window.claude.use) return;
        setSync((x) => ({ ...x, mode: 'connecting', label: 'Connecting to your Claude account…' }));
        let db, user;
        try { [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]); } catch (e) { /* unavailable */ }
        if (!alive) return;
        if (!db || !user) { setSync({ mode: 'local', label: 'This browser only (account storage unavailable here)', savedAt: null }); return; }
        let id = null; try { id = await user.id(); } catch (e) { /* signed out */ }
        if (!id) { setSync({ mode: 'local', label: 'This browser only (sign in to Claude to save to your account)', savedAt: null }); return; }
        const ref = db.doc('data/users/' + id + '/workspace');
        let answered = false;
        const timer = setTimeout(() => { if (!answered && alive) setSync({ mode: 'warn', label: 'Account storage not reachable yet — saving in this browser', savedAt: null }); }, 10000);
        try {
          const snap = await ref.get(); answered = true; clearTimeout(timer); if (!alive) return;
          cloud.current.ref = ref;
          if (snap.exists) {
            const body = snap.data() || {}; let remote = null; try { remote = JSON.parse(body.json); } catch (e) { /* corrupt */ }
            if (remote && remote.meta && (remote.meta.updatedAt || 0) > (sRef.current.meta.updatedAt || 0)) { cloud.current.lastJson = body.json; cloud.current.skip = true; setS(migrate(remote)); setSync({ mode: 'cloud', label: 'Loaded from your Claude account', savedAt: body.updatedAt || null }); return; }
          }
          setSync({ mode: 'cloud', label: 'Saved to your Claude account', savedAt: null }); writeCloud();
        } catch (e) { answered = true; clearTimeout(timer); if (alive) setSync({ mode: 'warn', label: 'Account storage error — saving in this browser', savedAt: null }); }
      })();
      return () => { alive = false; };
    }, []);
    useEffect(() => {
      saveLocal(s);
      const c = cloud.current; if (c.skip) { c.skip = false; return; }
      if (!c.ref) return; clearTimeout(c.timer); c.timer = setTimeout(writeCloud, 1200);
    }, [s]);

    const app = { s, M, up, open, go, toast, confirm, sync, replaceAll };
    const View = CC[VIEWS[route.section]];
    const badge = { production: M.counts.overdue, crm: M.crm.followOverdue.length, sprint: M.tasks.filter((x) => x.sprintDay && x.overdue).length, team: M.team.filter((m) => m.over).length };
    const syncIcon = sync.mode === 'cloud' ? 'cloud' : sync.mode === 'warn' ? 'alert' : sync.mode === 'saving' || sync.mode === 'connecting' ? 'clock' : 'drive';
    const quickItems = [['task', 'Task', 'check'], ['deliverable', 'Deliverable', 'film'], ['lead', 'Lead', 'target'], ['expense', 'Expense', 'wallet'], ['payment', 'Payment received', 'wallet'], ['invoice', 'Invoice', 'wallet']];

    return html`<${CC.Ctx.Provider} value=${app}>
      <div className=${'shell' + (navOpen ? ' nav-open' : '')}>
        <aside className="side" aria-label="Sections">
          <div className="brand"><span className="mark" aria-hidden="true">CC</span><div><strong>Creative Cut</strong><span>Founder Command Center</span></div></div>
          <nav>${NAV.map(([id, label, icon], i) => html`<button key=${id} className=${'nav' + (route.section === id ? ' on' : '')} aria-current=${route.section === id ? 'page' : undefined} onClick=${() => go(id)}>
            <${Icon} name=${icon} size=${17} /><span>${label}</span>${badge[id] ? html`<em className="nbadge">${badge[id]}</em>` : ''}</button>`)}</nav>
          <div className="side-foot"><div className=${'src src-' + sync.mode}><${Icon} name=${syncIcon} size=${14} /><div><b>Data source: manual entry</b><span>${sync.label}</span><span>Last updated ${D.ago(s.meta.updatedAt)}</span></div></div></div>
        </aside>
        ${navOpen && html`<div className="scrim" onClick=${() => setNavOpen(false)}></div>`}
        <main className="main">
          <header className="top">
            <button className="btn btn-ghost menu-b" aria-label="Open sections" onClick=${() => setNavOpen(true)}><${Icon} name="menu" size=${18} /></button>
            <div className="top-src"><${Icon} name=${syncIcon} size=${14} /><span>${sync.label}</span><span className="muted">· updated ${D.ago(s.meta.updatedAt)}</span></div>
            <div className="qa-w"><${Btn} kind="primary" icon="plus" onClick=${() => setQuick(!quick)}>Quick add<//>
              ${quick && html`<div className="qa" role="menu">${quickItems.map(([k, l, ic]) => html`<button key=${k} role="menuitem" onClick=${() => open(k)}><${Icon} name=${ic} size=${15} />${l}</button>`)}</div>`}</div>
          </header>
          <div className="content" key=${route.section + route.n}>${View ? html`<${View} sub=${route.sub} />` : null}</div>
        </main>
      </div>
      ${modal && html`<${CC.Editor} key=${modal.k} spec=${modal} onClose=${() => setModal(null)} />`}
      ${conf && html`<${CC.Confirm} c=${conf.c} onDone=${(v) => { conf.resolve(v); setConf(null); }} />`}
      <div className="toasts" aria-live="polite">${toasts.map((t) => html`<div key=${t.id} className=${'toast' + (t.kind === 'err' ? ' err' : '')}>${t.text}</div>`)}</div>
    <//>`;
  }

  class Boundary extends React.Component {
    constructor(p) { super(p); this.state = { err: null }; }
    static getDerivedStateFromError(err) { return { err }; }
    render() {
      if (this.state.err) return html`<div className="crash"><h2>Something went wrong on this screen</h2><p className="muted">${String(this.state.err.message || this.state.err)}</p><p>Your data is still saved. Reload the page, or export a backup from Reports & Settings.</p><button className="btn btn-primary" onClick=${() => { this.setState({ err: null }); location.hash = 'dashboard'; }}>Back to dashboard</button></div>`;
      return this.props.children;
    }
  }
  ReactDOM.createRoot(document.getElementById('root')).render(html`<${Boundary}><${App} /><//>`);
})();
