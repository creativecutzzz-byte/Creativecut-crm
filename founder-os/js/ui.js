/* Creative Cut Founder OS — shared UI: icons, primitives, charts, record editor. */
(function () {
  const CC = window.CC;
  const { D, F, n, has } = CC;
  const h = React.createElement;
  const html = htm.bind(h);
  CC.html = html;
  const { useState, useContext, useMemo, useEffect, useRef } = React;
  const Ctx = React.createContext(null);
  CC.Ctx = Ctx;
  CC.useApp = () => useContext(Ctx);

  /* ---------- icons (Lucide geometry, stroke 2) ---------- */
  const R = (x, y, w, hh, rx = 2) => ({ t: 'rect', x, y, width: w, height: hh, rx });
  const C = (cx, cy, r) => ({ t: 'circle', cx, cy, r });
  const I = {
    dashboard: [R(3, 3, 7, 7, 1), R(14, 3, 7, 7, 1), R(14, 14, 7, 7, 1), R(3, 14, 7, 7, 1)],
    map: [R(16, 16, 6, 6, 1), R(2, 16, 6, 6, 1), R(9, 2, 6, 6, 1), 'M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3', 'M12 12V8'],
    film: ['M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z', 'm6.2 5.3 3.1 3.9', 'm12.4 3.4 3.1 4', 'M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z'],
    users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', C(9, 7, 4), 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
    rocket: ['M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z', 'm12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z', 'M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0', 'M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5'],
    captions: [R(3, 5, 18, 14, 2), 'M7 15h4M15 15h2M7 11h2M13 11h4'],
    megaphone: ['m3 11 18-5v12L3 14v-3z', 'M11.6 16.8a3 3 0 1 1-5.8-1.6'],
    target: [C(12, 12, 10), C(12, 12, 6), C(12, 12, 2)],
    wallet: ['M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1', 'M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4'],
    activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
    meetings: [R(3, 4, 18, 18, 2), 'M16 2v4M8 2v4M3 10h18', 'm9 16 2 2 4-4'],
    chart: ['M3 3v18h18', 'M18 17V9', 'M13 17V5', 'M8 17v-3'],
    plus: ['M5 12h14M12 5v14'], x: ['M18 6 6 18M6 6l12 12'], check: ['M20 6 9 17l-5-5'],
    alert: ['m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z', 'M12 9v4', 'M12 17h.01'],
    right: ['m9 18 6-6-6-6'], left: ['m15 18-6-6 6-6'], down: ['m6 9 6 6 6-6'],
    download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
    upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
    trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
    edit: ['M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'],
    menu: ['M4 6h16M4 12h16M4 18h16'],
    zoomin: [C(11, 11, 8), 'm21 21-4.3-4.3', 'M11 8v6M8 11h6'], zoomout: [C(11, 11, 8), 'm21 21-4.3-4.3', 'M8 11h6'],
    fit: ['M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3'],
    cloud: ['M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z'],
    drive: ['M22 12H2', 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z', 'M6 16h.01M10 16h.01'],
    external: ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
    clock: [C(12, 12, 10), 'M12 6v6l4 2'],
    sun: [C(12, 12, 4), 'M12 2v2M12 20v2m-7.07-14.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41'],
    moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
    kanban: [R(3, 3, 18, 18, 2), 'M8 7v7M12 7v4M16 7v9'],
    calendar: [R(3, 4, 18, 18, 2), 'M16 2v4M8 2v4M3 10h18'],
    list: ['M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'],
    copy: [R(8, 8, 14, 14, 2), 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'],
    arrow: ['M5 12h14M12 5l7 7-7 7'],
    carry: ['M15 17l5-5-5-5', 'M4 18v-2a4 4 0 0 1 4-4h12'],
    flag: ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22v-7'],
    info: [C(12, 12, 10), 'M12 16v-4', 'M12 8h.01'],
    mic: [R(9, 2, 6, 12, 3), 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v3'],
  };
  function Icon({ name, size = 16, className = '' }) {
    const parts = I[name] || I.info;
    return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', className: 'ic ' + className, 'aria-hidden': true },
      parts.map((p, i) => (typeof p === 'string' ? h('path', { key: i, d: p }) : h(p.t, { key: i, ...p, t: undefined }))));
  }

  /* ---------- primitives ---------- */
  function Btn({ kind = 'default', icon, onClick, children, small, title, disabled, type = 'button', className = '' }) {
    return html`<button type=${type} className=${`btn btn-${kind} ${small ? 'btn-sm' : ''} ${className}`} onClick=${onClick} title=${title} disabled=${disabled} aria-label=${!children ? title : undefined}>
      ${icon && html`<${Icon} name=${icon} size=${small ? 14 : 16} />`}${children && html`<span>${children}</span>`}</button>`;
  }
  function Card({ title, sub, actions, children, className = '', id }) {
    return html`<section className=${'card ' + className} id=${id}>
      ${(title || actions) && html`<header className="card-h"><div className="card-t"><h3>${title}</h3>${sub && html`<p className="muted sm">${sub}</p>`}</div>${actions && html`<div className="row gap-s wrap">${actions}</div>`}</header>`}
      ${children}</section>`;
  }
  const TAGS = { actual: 'Actual', target: 'Target', est: 'Estimate', config: 'Config', calc: 'Calculated' };
  function Tag({ kind }) { return html`<span className=${'tag tag-' + kind}>${TAGS[kind] || kind}</span>`; }
  function Stat({ label, value, tag, sub, tone, onClick, empty }) {
    const El = onClick ? 'button' : 'div';
    return h(El, { className: 'stat ' + (tone ? 'tone-' + tone : '') + (onClick ? ' clickable' : ''), onClick, type: onClick ? 'button' : undefined },
      html`<div className="stat-top"><span className="stat-l">${label}</span>${tag && html`<${Tag} kind=${tag} />`}</div>
      <div className=${'stat-v' + (empty ? ' is-empty' : '')}>${value}</div>${sub && html`<div className="stat-s">${sub}</div>`}`);
  }
  function Pill({ tone = 'muted', children, title }) { return html`<span className=${'pill pill-' + tone} title=${title}>${children}</span>`; }
  const STATUS_TONE = { Backlog: 'muted', 'Brief Ready': 'info', Editing: 'accent', 'Internal QC': 'info', 'Client Review': 'warn', 'Revision Required': 'crit', Approved: 'ok', Delivered: 'ok', Blocked: 'crit',
    'To do': 'muted', 'In progress': 'accent', Done: 'ok', Active: 'ok', 'On Track': 'ok', 'At Risk': 'warn', 'Not Configured': 'muted', Completed: 'ok', Paused: 'muted', Onboarding: 'info', Draft: 'muted', Ready: 'info', Ended: 'muted' };
  function StatusPill({ s }) { return html`<${Pill} tone=${STATUS_TONE[s] || 'muted'}>${s}<//>`; }
  function Progress({ value, tone = 'accent', label }) {
    const v = value == null ? 0 : Math.max(0, Math.min(1, value));
    return html`<div className="prog" role="progressbar" aria-valuenow=${Math.round(v * 100)} aria-valuemin="0" aria-valuemax="100" aria-label=${label}><div className=${'prog-f tone-bg-' + tone} style=${{ width: v * 100 + '%' }}></div></div>`;
  }
  function Empty({ icon = 'info', title, text, action }) {
    return html`<div className="empty"><${Icon} name=${icon} size=${22} /><div><strong>${title}</strong>${text && html`<p className="muted">${text}</p>`}</div>${action}</div>`;
  }
  function Tabs({ tabs, value, onChange, small }) {
    return html`<div className=${'tabs' + (small ? ' tabs-s' : '')} role="tablist">${tabs.map(([id, label]) => html`<button key=${id} role="tab" aria-selected=${value === id} className=${value === id ? 'on' : ''} onClick=${() => onChange(id)}>${label}</button>`)}</div>`;
  }
  function Modal({ title, onClose, children, footer, wide }) {
    useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
    return html`<div className="overlay" onMouseDown=${(e) => e.target === e.currentTarget && onClose()}>
      <div className=${'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label=${title}>
        <header className="modal-h"><h3>${title}</h3><${Btn} kind="ghost" icon="x" title="Close" onClick=${onClose} /></header>
        <div className="modal-b">${children}</div>${footer && html`<footer className="modal-f">${footer}</footer>`}</div></div>`;
  }
  function Ext({ href, children }) {
    if (!href) return html`<span className="muted">—</span>`;
    const safe = /^https?:\/\//i.test(href) ? href : 'https://' + href;
    return html`<a href=${safe} target="_blank" rel="noopener noreferrer" className="ext">${children || 'Open'} <${Icon} name="external" size=${12} /></a>`;
  }
  function Sel({ value, onChange, options, id, className = '', ariaLabel }) {
    return html`<select id=${id} className=${'inp ' + className} value=${value ?? ''} aria-label=${ariaLabel} onChange=${(e) => onChange(e.target.value)}>${options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return html`<option key=${v} value=${v}>${l}</option>`; })}</select>`;
  }

  /* ---------- charts (SVG, single scale per chart) ---------- */
  function niceMax(m) { if (m <= 0) return 1; const p = 10 ** Math.floor(Math.log10(m)); const f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
  const SERIES = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)'];
  function BarChart({ data, series, height = 190, fmt = F.num, stacked = false, empty = 'No records yet' }) {
    const total = data.reduce((a, d) => a + d.values.reduce((x, y) => x + n(y), 0), 0);
    if (!data.length || total === 0) return html`<div className="chart-empty">${empty}</div>`;
    const W = 640, H = height, L = 46, B = 26, T = 10, Rr = 8;
    const rawMax = Math.max(...data.map((d) => (stacked ? d.values.reduce((a, b) => a + n(b), 0) : Math.max(...d.values.map(n)))));
    const ints = data.every((d) => d.values.every((v) => Number.isInteger(n(v))));
    const max = ints && rawMax <= 40 ? Math.max(4, Math.ceil(rawMax / 4) * 4) : niceMax(rawMax);
    const iw = W - L - Rr, ih = H - T - B, slot = iw / data.length, k = series.length;
    const bw = Math.min(28, (slot * 0.72) / (stacked ? 1 : k));
    const y = (v) => T + ih - (v / max) * ih;
    const every = Math.ceil(data.length / 14);
    return html`<div className="chart"><svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label="Bar chart">
      ${[0, 0.25, 0.5, 0.75, 1].map((f) => html`<g key=${f}><line x1=${L} x2=${W - Rr} y1=${y(max * f)} y2=${y(max * f)} className="grid" /><text x=${L - 6} y=${y(max * f) + 4} className="axis" textAnchor="end">${fmt(max * f)}</text></g>`)}
      ${data.map((d, i) => {
        const x0 = L + slot * i + slot / 2; let acc = 0;
        return html`<g key=${i}>${d.values.map((v, j) => {
          const val = n(v); if (!stacked) { const x = x0 - (bw * k) / 2 + bw * j; return html`<rect key=${j} x=${x + 1} y=${y(val)} width=${Math.max(1, bw - 2)} height=${Math.max(0, T + ih - y(val))} rx="2" style=${{ fill: series[j].color || SERIES[j] }}><title>${d.label} · ${series[j].name}: ${fmt(val)}</title></rect>`; }
          const y1 = y(acc + val), y0 = y(acc); acc += val;
          return html`<rect key=${j} x=${x0 - bw / 2} y=${y1} width=${bw} height=${Math.max(0, y0 - y1)} style=${{ fill: series[j].color || SERIES[j] }}><title>${d.label} · ${series[j].name}: ${fmt(val)}</title></rect>`;
        })}${i % every === 0 && html`<text x=${x0} y=${H - 8} className="axis" textAnchor="middle">${d.label}</text>`}</g>`;
      })}
      <line x1=${L} x2=${W - Rr} y1=${T + ih} y2=${T + ih} className="base" /></svg>
      <${Legend} series=${series} /></div>`;
  }
  function LineChart({ data, series, height = 190, fmt = F.num, empty = 'No records yet' }) {
    const total = data.reduce((a, d) => a + d.values.reduce((x, y) => x + n(y), 0), 0);
    if (data.length < 2 || total === 0) return html`<div className="chart-empty">${empty}</div>`;
    const W = 640, H = height, L = 46, B = 26, T = 12, Rr = 12;
    const rawMax = Math.max(...data.flatMap((d) => d.values.map(n)));
    const ints = data.every((d) => d.values.every((v) => Number.isInteger(n(v))));
    const max = ints && rawMax <= 40 ? Math.max(2, Math.ceil(rawMax / 2) * 2) : niceMax(rawMax);
    const iw = W - L - Rr, ih = H - T - B;
    const x = (i) => L + (iw * i) / (data.length - 1), y = (v) => T + ih - (v / max) * ih;
    const every = Math.ceil(data.length / 12);
    return html`<div className="chart"><svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label="Line chart">
      ${[0, 0.5, 1].map((f) => html`<g key=${f}><line x1=${L} x2=${W - Rr} y1=${y(max * f)} y2=${y(max * f)} className="grid" /><text x=${L - 6} y=${y(max * f) + 4} className="axis" textAnchor="end">${fmt(max * f)}</text></g>`)}
      ${series.map((sr, j) => {
        const pts = data.map((d, i) => [x(i), y(n(d.values[j]))]);
        const line = pts.map((p) => p.join(',')).join(' ');
        const area = `${L},${T + ih} ${line} ${x(data.length - 1)},${T + ih}`;
        const last = pts[pts.length - 1];
        return html`<g key=${j}>${j === 0 && html`<polygon points=${area} style=${{ fill: sr.color || SERIES[j], opacity: 0.1 }} />`}
          <polyline points=${line} fill="none" style=${{ stroke: sr.color || SERIES[j] }} strokeWidth="2" strokeDasharray=${sr.dash ? '5 4' : undefined} />
          <circle cx=${last[0]} cy=${last[1]} r="3.5" style=${{ fill: sr.color || SERIES[j] }} /></g>`;
      })}
      ${data.map((d, i) => i % every === 0 && html`<text key=${i} x=${x(i)} y=${H - 8} className="axis" textAnchor="middle">${d.label}</text>`)}
      <line x1=${L} x2=${W - Rr} y1=${T + ih} y2=${T + ih} className="base" /></svg><${Legend} series=${series} /></div>`;
  }
  function Legend({ series }) { if (series.length < 2) return null; return html`<div className="legend">${series.map((s, j) => html`<span key=${j}><i style=${{ background: s.color || SERIES[j] }}></i>${s.name}</span>`)}</div>`; }
  function HBars({ rows, fmt = F.num, empty = 'No records yet', max }) {
    const m = max || Math.max(0, ...rows.map((r) => n(r.value)));
    if (!rows.length || m === 0) return html`<div className="chart-empty">${empty}</div>`;
    return html`<div className="hbars">${rows.map((r, i) => html`<div className="hbar" key=${i}><span className="hbar-l">${r.label}</span><div className="hbar-t"><div className=${'hbar-f tone-bg-' + (r.tone || 'accent')} style=${{ width: (n(r.value) / m) * 100 + '%' }}></div></div><span className="hbar-v num">${fmt(r.value)}</span></div>`)}</div>`;
  }
  function Funnel({ stages }) {
    const top = n(stages[0]?.value);
    if (!stages.some((s) => n(s.value) > 0)) return html`<div className="chart-empty">No funnel counts entered yet</div>`;
    return html`<div className="funnel">${stages.map((s, i) => {
      const prev = i ? n(stages[i - 1].value) : null; const conv = i ? CC.div(n(s.value), prev) : null;
      return html`<div className="fn-row" key=${i}><span className="fn-l">${s.label}</span>
        <div className="fn-t"><div className="fn-f" style=${{ width: top ? Math.max(1.5, (n(s.value) / top) * 100) + '%' : '0' }}></div></div>
        <span className="fn-v num">${F.num(s.value)}</span><span className="fn-c num muted">${i ? (prev ? F.pct(conv) + ' of prev.' : 'no prior stage') : 'start'}</span></div>`;
    })}</div>`;
  }

  /* ---------- record editor ---------- */
  const memberOpts = (s, blank = 'Unassigned') => [['', blank], ...s.team.filter((m) => m.active !== false).map((m) => [m.id, m.name])];
  const ownerOpts = (s) => [...memberOpts(s), ...s.roles.map((r) => ['role:' + r.id, r.title.split(' / ')[0] + ' (role, unfilled)'])];
  const clientOpts = (s, blank) => [...(blank ? [['', blank]] : []), ...s.clients.map((c) => [c.id, c.name + (c.company ? ' / ' + c.company : '')])];
  const yes = [[true, 'Yes'], [false, 'No']];

  const SCHEMAS = {
    deliverable: { title: 'Deliverable', coll: (s) => s.deliverables, fields: (s) => [
      { k: 'title', l: 'Topic / title', span: 2, req: true },
      { k: 'clientId', l: 'Client', type: 'select', opts: clientOpts(s), req: true },
      { k: 'status', l: 'Status', type: 'select', opts: CC.ALL_STATUSES },
      { k: 'blockedReason', l: 'Blocked reason', show: (v) => v.status === 'Blocked', span: 2, req: (v) => v.status === 'Blocked' },
      { k: 'priority', l: 'Priority', type: 'select', opts: CC.PRIORITIES },
      { k: 'assigneeId', l: 'Editor assigned', type: 'select', opts: memberOpts(s) },
      { k: 'complexity', l: 'Complexity', type: 'select', opts: Object.entries(CC.COMPLEXITY).map(([k, v]) => [k, v.label]) },
      { k: 'estHours', l: 'Time estimate (h)', type: 'number', ph: 'Uses complexity default' },
      { k: 'startDate', l: 'Start date', type: 'date' }, { k: 'dueDate', l: 'Due date', type: 'date', req: true },
      { k: 'completedDate', l: 'Actual delivery date', type: 'date', hint: 'Set when status is Delivered' },
      { k: 'originalDueDate', l: 'Original due date', type: 'date', hint: 'Kept when work is carried forward' },
      { k: 'assetsReceived', l: 'Client assets received', type: 'check' },
      { k: 'scriptStatus', l: 'Script', type: 'select', opts: ['Not needed', 'Pending', 'Ready', 'Approved'] },
      { k: 'editingProgress', l: 'Editing progress %', type: 'number', min: 0, max: 100 },
      { k: 'revisionCount', l: 'Revision count', type: 'number', min: 0 },
      { k: 'paymentStatus', l: 'Payment status', type: 'select', opts: ['Not billed', 'Invoiced', 'Paid'] },
      { k: 'assetLink', l: 'Assets link', type: 'url' }, { k: 'deliverableLink', l: 'Deliverable link', type: 'url' },
      { k: 'approvalEvidence', l: 'Approval evidence (link or note)', span: 2 },
      { k: 'feedback', l: 'Client feedback', type: 'textarea', span: 2 },
      { k: 'qc', l: 'Internal QC checklist', type: 'qc', span: 2 },
      { k: 'notes', l: 'Notes', type: 'textarea', span: 2 },
    ], defaults: (s, M) => ({ status: 'Backlog', priority: 'Medium', complexity: 'standard', assigneeId: '', clientId: s.clients[0]?.id, dueDate: M.t, startDate: M.t, scriptStatus: 'Not needed', assetsReceived: false, editingProgress: 0, revisionCount: 0, paymentStatus: 'Not billed', qc: {} }) },
    task: { title: 'Task', coll: (s) => s.tasks, fields: (s) => [
      { k: 'title', l: 'Task', span: 2, req: true },
      { k: 'owner', l: 'Owner', type: 'select', opts: ownerOpts(s) },
      { k: 'status', l: 'Status', type: 'select', opts: CC.TASK_STATUS },
      { k: 'priority', l: 'Priority', type: 'select', opts: CC.PRIORITIES },
      { k: 'dueDate', l: 'Due date', type: 'date' },
      { k: 'category', l: 'Area', type: 'select', opts: ['Sprint', 'Founder', 'Team', 'Client', 'Sales', 'Product', 'Finance'] },
      { k: 'sprintDay', l: 'Sprint day', type: 'select', num: true, opts: [['', 'Not in sprint'], ...s.sprintDays.map((d) => [d.day, `Day ${d.day} · ${D.fmt(d.date)}`])] },
      { k: 'kind', l: 'Type', type: 'select', opts: CC.TASK_KINDS },
      { k: 'estMins', l: 'Time estimate (min)', type: 'number' },
      { k: 'cost', l: 'Estimated cost (₹)', type: 'number' }, { k: 'actualCost', l: 'Actual cost (₹)', type: 'number' },
      { k: 'dependency', l: 'Depends on', span: 2 }, { k: 'blocker', l: 'Blocker', span: 2, show: (v) => v.status === 'Blocked' || v.blocker },
      { k: 'evidence', l: 'Evidence link', type: 'url', span: 2 },
      { k: 'originalDueDate', l: 'Original due date', type: 'date', hint: 'Unchanged by carry-forward' },
      { k: 'notes', l: 'Notes', type: 'textarea', span: 2 },
    ], defaults: (s, M) => ({ status: 'To do', priority: 'Medium', owner: 'm_hemant', dueDate: M.t, category: 'Founder', kind: 'Founder', carryCount: 0 }) },
    lead: { title: 'Lead', coll: (s) => s.leads, fields: (s) => [
      { k: 'name', l: 'Name', req: true }, { k: 'business', l: 'Business' }, { k: 'role', l: 'Role' },
      { k: 'pipeline', l: 'Pipeline', type: 'select', opts: [['agency', 'A · Agency services'], ['product', 'B · Captions plugin / partnerships']] },
      { k: 'stage', l: 'Stage', type: 'select', opts: s.crm.stages.map((x) => [x.id, x.label]) },
      { k: 'source', l: 'Source', type: 'select', opts: ['', 'Instagram', 'LinkedIn', 'YouTube', 'Referral', 'Inbound', 'Website', 'Community', 'Other'] },
      { k: 'url', l: 'Public profile URL', type: 'url', span: 2 },
      { k: 'pain', l: 'Relevant pain point', type: 'textarea', span: 2 },
      { k: 'interest', l: 'Product / service interest', type: 'select', opts: ['', ...s.crm.offers.map((o) => o.name), 'Creative Captions licence', 'Creator partnership', 'Other'] },
      { k: 'channel', l: 'Contact channel', type: 'select', opts: ['', 'Instagram DM', 'LinkedIn', 'Email', 'WhatsApp', 'Phone', 'In person', 'Other'] },
      { k: 'outreachDate', l: 'Outreach sent on', type: 'date', hint: 'Only set once you actually sent it' },
      { k: 'lastInteraction', l: 'Last interaction', type: 'date' }, { k: 'followUp', l: 'Follow-up due', type: 'date' },
      { k: 'value', l: 'Deal value (₹)', type: 'number' }, { k: 'probability', l: 'Probability estimate %', type: 'number', min: 0, max: 100 },
      { k: 'cash', l: 'Actual cash collected (₹)', type: 'number' },
      { k: 'owner', l: 'Owner', type: 'select', opts: ownerOpts(s) },
      { k: 'notes', l: 'Notes', type: 'textarea', span: 2 },
    ], defaults: (s, M) => ({ pipeline: 'agency', stage: 'identified', owner: 'm_hemant', history: [] }) },
    expense: { title: 'Expense', coll: (s) => s.finance.expenses, fields: (s) => [
      { k: 'date', l: 'Date', type: 'date', req: true }, { k: 'amount', l: 'Amount (₹)', type: 'number', req: true },
      { k: 'category', l: 'Category', type: 'select', opts: ['Editor payout', 'Software', 'Outsourcing', 'Product', 'Refund', 'Sprint (non-ads)', 'Other'] },
      { k: 'clientId', l: 'Client (optional)', type: 'select', opts: clientOpts(s, 'Company-level') },
      { k: 'sprintBudget', l: 'Counts against the ₹5,000 sprint budget', type: 'check', span: 2 },
      { k: 'note', l: 'Note', span: 2 },
    ], note: 'Meta ad spend is recorded in Meta Ads so it is not counted twice.', defaults: (s, M) => ({ date: M.t, category: 'Other', clientId: '', sprintBudget: false }) },
    payment: { title: 'Payment received', coll: (s) => s.finance.payments, fields: (s) => [
      { k: 'date', l: 'Date received', type: 'date', req: true }, { k: 'amount', l: 'Amount (₹)', type: 'number', req: true },
      { k: 'source', l: 'Source', type: 'select', opts: ['Client', 'Product', 'Other'] },
      { k: 'clientId', l: 'Client', type: 'select', opts: clientOpts(s, 'None / new client'), show: (v) => v.source !== 'Product' },
      { k: 'invoiceId', l: 'Against invoice', type: 'select', opts: [['', 'No invoice'], ...s.finance.invoices.map((i) => [i.id, (i.number || i.id) + ' · ' + F.inr(i.amount)])] },
      { k: 'kind', l: 'Type', type: 'select', opts: ['Advance', 'Balance', 'Full payment', 'Product sale', 'Other'] },
      { k: 'reference', l: 'Reference (UTR / txn id)' }, { k: 'note', l: 'Note' },
    ], note: 'Advances are cash received, not profit. Profit is estimated separately.', defaults: (s, M) => ({ date: M.t, source: 'Client', kind: 'Advance', clientId: '', invoiceId: '' }) },
    invoice: { title: 'Invoice', coll: (s) => s.finance.invoices, fields: (s) => [
      { k: 'number', l: 'Invoice number', req: true }, { k: 'clientId', l: 'Client', type: 'select', opts: clientOpts(s, 'Not linked') },
      { k: 'description', l: 'Description', span: 2 }, { k: 'amount', l: 'Amount (₹)', type: 'number', req: true },
      { k: 'issueDate', l: 'Issued', type: 'date', req: true }, { k: 'dueDate', l: 'Payment due', type: 'date' }, { k: 'note', l: 'Note' },
    ], defaults: (s, M) => ({ issueDate: M.t, number: 'CC-INV-' + String(n(s.counters.invoice) + 1).padStart(3, '0') }) },
    member: { title: 'Team member', coll: (s) => s.team, fields: (s) => [
      { k: 'name', l: 'Name', req: true }, { k: 'contact', l: 'Contact' },
      { k: 'roleIds', l: 'Roles', type: 'multi', opts: s.roles.map((r) => [r.id, r.title]), span: 2 },
      { k: 'clientIds', l: 'Client projects', type: 'multi', opts: s.clients.map((c) => [c.id, c.name]), span: 2 },
      { k: 'capacityHours', l: 'Production hours per day', type: 'number' }, { k: 'workDays', l: 'Working days per week', type: 'number', min: 1, max: 7 },
      { k: 'active', l: 'Active', type: 'check' },
    ], defaults: () => ({ roleIds: [], clientIds: [], capacityHours: 6, workDays: 6, active: true, notes: [] }) },
    role: { title: 'Role', coll: (s) => s.roles, fields: () => [{ k: 'title', l: 'Role title', req: true, span: 2 }, { k: 'responsibilities', l: 'Responsibilities', type: 'textarea', span: 2 }], defaults: () => ({}) },
    client: { title: 'Client', coll: (s) => s.clients, fields: () => [
      { k: 'name', l: 'Client name', req: true }, { k: 'company', l: 'Company' },
      { k: 'status', l: 'Status', type: 'select', opts: ['Active', 'Onboarding', 'Paused', 'Ended'] },
      { k: 'cadence', l: 'Delivery cadence', type: 'select', opts: [['daily', 'Daily target'], ['weekly', 'Weekly target'], ['project', 'Project / fixed dates'], ['unconfigured', 'Not configured']] },
      { k: 'minPerPeriod', l: 'Minimum per period', type: 'number' }, { k: 'stretchPerPeriod', l: 'Stretch per period', type: 'number' },
      { k: 'projectType', l: 'Project type' }, { k: 'frequencyNote', l: 'Frequency (as agreed)' },
      { k: 'contractValue', l: 'Contract value (₹)', type: 'number' }, { k: 'pricePerVideo', l: 'Agreed price per deliverable (₹)', type: 'number' },
      { k: 'editorPoolPct', l: 'Editor pool % (this contract)', type: 'number', hint: 'Reference split is 70 / 30' },
      { k: 'paymentTerms', l: 'Payment terms' }, { k: 'poc', l: 'Client point of contact' }, { k: 'pendingAssets', l: 'Pending assets' },
      { k: 'expectedOutputs', l: 'Expected outputs', type: 'textarea', span: 2 },
      { k: 'nonWorkingDates', l: 'Non-working / paused dates', span: 2, hint: 'Comma-separated YYYY-MM-DD, excluded from daily targets' },
      { k: 'configured', l: 'Configuration confirmed with client', type: 'check', span: 2 },
      { k: 'notes', l: 'Notes', type: 'textarea', span: 2 },
    ], defaults: () => ({ status: 'Onboarding', cadence: 'unconfigured', editorPoolPct: 70, weekTargets: {}, configured: false }) },
    adEntry: { title: 'Ad results (from Ads Manager)', coll: (s) => s.ads.entries, fields: (s) => [
      { k: 'date', l: 'Date', type: 'date', req: true }, { k: 'campaignId', l: 'Campaign', type: 'select', opts: s.ads.campaigns.map((c) => [c.id, c.name]) },
      { k: 'creative', l: 'Creative name', span: 2 },
      { k: 'spend', l: 'Media spend (₹)', type: 'number' }, { k: 'taxes', l: 'Taxes and fees (₹)', type: 'number' },
      { k: 'impressions', l: 'Impressions', type: 'number' }, { k: 'reach', l: 'Reach', type: 'number' },
      { k: 'clicks', l: 'Link clicks', type: 'number' }, { k: 'lpv', l: 'Landing page views', type: 'number' },
      { k: 'trials', l: 'Trials (attributed)', type: 'number' }, { k: 'purchases', l: 'Purchases (attributed)', type: 'number' },
      { k: 'revenue', l: 'Attributed revenue (₹)', type: 'number' },
      { k: 'dataSource', l: 'Data source', type: 'select', opts: ['Ads Manager (typed in)', 'Ads Manager export', 'Unverified estimate'] },
      { k: 'verified', l: 'Checked against Ads Manager', type: 'check', span: 2 },
    ], note: 'Leave a field blank if you do not have the number. Blank is never treated as a result.', defaults: (s, M) => ({ date: M.t, campaignId: s.ads.campaigns[0]?.id, dataSource: 'Ads Manager (typed in)', verified: false }) },
    campaign: { title: 'Campaign', coll: (s) => s.ads.campaigns, fields: () => [
      { k: 'name', l: 'Campaign name', req: true, span: 2 }, { k: 'status', l: 'Status', type: 'select', opts: ['Draft', 'Ready', 'Active', 'Paused', 'Ended'] },
      { k: 'objective', l: 'Objective' }, { k: 'conversion', l: 'Conversion event' }, { k: 'location', l: 'Location' },
      { k: 'audience', l: 'Audience hypothesis', span: 2 }, { k: 'dailyBudget', l: 'Daily budget (₹)', type: 'number' }, { k: 'startDate', l: 'Start date', type: 'date' },
      { k: 'notes', l: 'Notes', type: 'textarea', span: 2 },
    ], defaults: () => ({ status: 'Draft', objective: 'Sales', conversion: 'Purchase', location: 'India' }) },
    productDay: { title: 'Product day', coll: (s) => s.product.daily, fields: () => [
      { k: 'date', l: 'Date', type: 'date', req: true }, { k: 'source', l: 'Counts from', type: 'select', opts: ['Website analytics + payment dashboard', 'Manual count', 'Unverified estimate'] },
      { k: 'visits', l: 'Website visits', type: 'number' }, { k: 'engaged', l: 'Product page engaged', type: 'number' },
      { k: 'trials', l: 'Trial signups', type: 'number' }, { k: 'activations', l: 'Trial activations', type: 'number' },
      { k: 'checkouts', l: 'Checkouts started', type: 'number' }, { k: 'purchases', l: 'Payments completed', type: 'number' },
      { k: 'paidPurchases', l: '…of which from paid ads', type: 'number' }, { k: 'organicPurchases', l: '…of which organic / direct', type: 'number' },
      { k: 'gross', l: 'Gross receipts (₹)', type: 'number' }, { k: 'refunds', l: 'Refunds (count)', type: 'number' }, { k: 'refundAmt', l: 'Refund amount (₹)', type: 'number' },
      { k: 'supportIssues', l: 'Support issues', type: 'number' }, { k: 'installFailures', l: 'Install failures', type: 'number' },
      { k: 'cohortConverted', l: 'This day’s trial signups that later bought', type: 'number', hint: 'Update after the trial window closes' },
      { k: 'notes', l: 'Notes', type: 'textarea', span: 2 },
    ], defaults: (s, M) => ({ date: M.t, source: 'Website analytics + payment dashboard' }) },
    standup: { title: 'Daily team report', coll: (s) => s.meetings.standups, fields: (s) => [
      { k: 'date', l: 'Date', type: 'date', req: true }, { k: 'memberId', l: 'Team member', type: 'select', opts: memberOpts(s, 'Choose…'), req: true },
      { k: 'yesterday', l: '1. What was completed yesterday?', type: 'textarea', span: 2 },
      { k: 'today', l: '2. What will be completed today?', type: 'textarea', span: 2 },
      { k: 'blocked', l: '3. What is blocked?', type: 'textarea', span: 2 },
      { k: 'risk', l: '4. Is any deadline at risk?', type: 'textarea', span: 2 },
      { k: 'support', l: '5. What support is needed?', type: 'textarea', span: 2 },
    ], defaults: (s, M) => ({ date: M.t, memberId: '' }) },
    meeting: { title: 'Meeting log', coll: (s) => s.meetings.logs, fields: () => [
      { k: 'date', l: 'Date', type: 'date', req: true }, { k: 'type', l: 'Type', type: 'select', opts: ['Weekly team review', 'Client review', 'Sprint review', 'One-on-one', 'Other'] },
      { k: 'attendees', l: 'Attendees', span: 2 }, { k: 'agenda', l: 'Agenda', type: 'textarea', span: 2 },
      { k: 'notes', l: 'Notes', type: 'textarea', span: 2 }, { k: 'actions', l: 'Action items', type: 'textarea', span: 2 },
    ], defaults: (s, M) => ({ date: M.t, type: 'Weekly team review' }) },
    decision: { title: 'Decision', coll: (s) => s.meetings.decisions, fields: (s) => [
      { k: 'date', l: 'Date', type: 'date', req: true }, { k: 'status', l: 'Status', type: 'select', opts: ['Open', 'Done', 'Reversed'] },
      { k: 'decision', l: 'Decision', span: 2, req: true }, { k: 'owner', l: 'Owner', type: 'select', opts: ownerOpts(s) },
      { k: 'review', l: 'Review on', type: 'date' }, { k: 'context', l: 'Context / why', type: 'textarea', span: 2 },
    ], defaults: (s, M) => ({ date: M.t, status: 'Open', owner: 'm_hemant' }) },
    offer: { title: 'Service offer', coll: (s) => s.crm.offers, fields: () => [
      { k: 'name', l: 'Offer name', req: true, span: 2 }, { k: 'price', l: 'Price (₹)', type: 'number' }, { k: 'advance', l: 'Advance (₹)', type: 'number' },
      { k: 'revisions', l: 'Revisions included', type: 'number' }, { k: 'scope', l: 'Scope', type: 'textarea', span: 2 },
    ], defaults: () => ({}) },
  };
  CC.SCHEMAS = SCHEMAS;

  function FieldInput({ f, v, set, id }) {
    const val = v[f.k];
    if (f.type === 'select') return html`<${Sel} id=${id} value=${val === true ? 'true' : val === false ? 'false' : val ?? ''} options=${f.opts.map((o) => (Array.isArray(o) ? [String(o[0]), o[1]] : [o, o || '—']))} onChange=${(x) => set(f.num ? (x === '' ? null : +x) : x)} />`;
    if (f.type === 'textarea') return html`<textarea id=${id} className="inp" rows="3" value=${val ?? ''} onChange=${(e) => set(e.target.value)}></textarea>`;
    if (f.type === 'check') return html`<label className="chk"><input id=${id} type="checkbox" checked=${!!val} onChange=${(e) => set(e.target.checked)} /><span>${f.l}</span></label>`;
    if (f.type === 'multi') return html`<div className="multi">${f.opts.map(([k, l]) => { const on = (val || []).includes(k); return html`<label key=${k} className=${'chip' + (on ? ' on' : '')}><input type="checkbox" checked=${on} onChange=${() => set(on ? (val || []).filter((x) => x !== k) : [...(val || []), k])} />${l}</label>`; })}</div>`;
    if (f.type === 'qc') { const q = val || {}; const done = CC.QC_ITEMS.filter(([k]) => q[k]).length; return html`<div className="qc"><div className="muted sm">${done} of ${CC.QC_ITEMS.length} checks passed</div>${CC.QC_ITEMS.map(([k, l]) => html`<label key=${k} className="chk"><input type="checkbox" checked=${!!q[k]} onChange=${(e) => set({ ...q, [k]: e.target.checked })} /><span>${l}</span></label>`)}</div>`; }
    if (f.type === 'number') return html`<input id=${id} className="inp num" type="number" inputMode="decimal" min=${f.min} max=${f.max} step="any" placeholder=${f.ph || 'blank = not recorded'} value=${val ?? ''} onChange=${(e) => set(e.target.value === '' ? null : +e.target.value)} />`;
    return html`<input id=${id} className="inp" type=${f.type === 'date' ? 'date' : f.type === 'url' ? 'url' : 'text'} placeholder=${f.ph || (f.type === 'url' ? 'https://' : '')} value=${val ?? ''} onChange=${(e) => set(e.target.value)} />`;
  }

  function Editor({ spec, onClose }) {
    const { s, M, up, confirm, toast } = CC.useApp();
    const sc = SCHEMAS[spec.kind];
    const existing = spec.id ? sc.coll(s).find((r) => r.id === spec.id) : null;
    const [v, setV] = useState(() => (existing ? { ...JSON.parse(JSON.stringify(existing)), ...(spec.patch || {}) } : { ...sc.defaults(s, M), ...(spec.defaults || {}) }));
    const [err, setErr] = useState('');
    const fields = sc.fields(s).filter((f) => !f.show || f.show(v));
    const save = async (e) => {
      e && e.preventDefault();
      const missing = fields.filter((f) => (typeof f.req === 'function' ? f.req(v) : f.req) && !has(v[f.k]) && !(typeof v[f.k] === 'string' && v[f.k].trim()));
      if (missing.length) { setErr('Fill in: ' + missing.map((f) => f.l).join(', ')); return; }
      let rec = { ...v };
      if (spec.kind === 'deliverable') {
        if (rec.status === 'Delivered' && existing?.status !== 'Delivered' && !['Approved'].includes(existing?.status || '') ) {
          const ok = await confirm({ title: 'Mark as delivered?', text: 'This video is not marked Approved yet. Only mark it Delivered once the final file has actually reached the client.', ok: 'Yes, it was delivered' });
          if (!ok) return;
        }
        if (rec.status === 'Delivered' && !rec.completedDate) rec.completedDate = M.t;
        if (rec.status !== 'Delivered' && existing?.status === 'Delivered') rec.completedDate = null;
        if (!rec.originalDueDate) rec.originalDueDate = rec.dueDate;
      }
      if (spec.kind === 'task') {
        if (rec.status === 'Done' && !rec.completedDate) rec.completedDate = M.t;
        if (rec.status !== 'Done') rec.completedDate = null;
        if (!rec.originalDueDate) rec.originalDueDate = rec.dueDate;
      }
      if (spec.kind === 'lead' && (!existing || existing.stage !== rec.stage)) rec.history = [...(rec.history || []), { date: M.t, stage: rec.stage }];
      up((d) => {
        const coll = sc.coll(d);
        if (existing) { const i = coll.findIndex((r) => r.id === existing.id); coll[i] = rec; }
        else {
          if (spec.kind === 'deliverable') { d.counters.deliverable = n(d.counters.deliverable) + 1; rec.id = 'CC-' + String(d.counters.deliverable).padStart(4, '0'); }
          else if (spec.kind === 'invoice') { d.counters.invoice = n(d.counters.invoice) + 1; rec.id = CC.uid('inv'); }
          else rec.id = CC.uid(spec.kind.slice(0, 3));
          coll.push(rec);
        }
      });
      toast(existing ? 'Saved' : sc.title + ' added');
      onClose();
    };
    const del = async () => {
      const ok = await confirm({ title: 'Delete this ' + sc.title.toLowerCase() + '?', text: 'This cannot be undone. Export a backup first if you might need it.', ok: 'Delete', danger: true });
      if (!ok) return;
      up((d) => { const coll = sc.coll(d); const i = coll.findIndex((r) => r.id === existing.id); if (i >= 0) coll.splice(i, 1); });
      toast('Deleted'); onClose();
    };
    return html`<${Modal} title=${(existing ? 'Edit ' : 'New ') + sc.title.toLowerCase() + (existing && spec.kind === 'deliverable' ? ' · ' + existing.id : '')} onClose=${onClose} wide=${fields.length > 8}
      footer=${html`${existing && spec.kind !== 'member' || (existing && existing.id !== 'm_hemant') ? html`<${Btn} kind="danger" icon="trash" onClick=${del}>Delete<//>` : html`<span></span>`}<div className="row gap-s"><${Btn} kind="ghost" onClick=${onClose}>Cancel<//><${Btn} kind="primary" icon="check" onClick=${save}>Save<//></div>`}>
      ${existing?.demo && html`<p className="note warn-note">This is a DEMO record. Remove all demo records in Reports & Settings before real use.</p>`}
      ${sc.note && html`<p className="note">${sc.note}</p>`}
      <form className="form" onSubmit=${save}>
        ${fields.map((f) => { const id = 'f-' + spec.kind + '-' + f.k; return html`<div key=${f.k} className=${'fld' + (f.span === 2 ? ' span2' : '')}>
          ${f.type !== 'check' && html`<label htmlFor=${id}>${f.l}${(typeof f.req === 'function' ? f.req(v) : f.req) ? ' *' : ''}</label>`}
          <${FieldInput} f=${f} v=${v} id=${id} set=${(x) => setV((o) => ({ ...o, [f.k]: x }))} />
          ${f.hint && html`<small className="muted">${f.hint}</small>`}</div>`; })}
        <button type="submit" hidden></button>
      </form>${err && html`<p className="err" role="alert">${err}</p>`}<//>`;
  }

  function Confirm({ c, onDone }) {
    return html`<${Modal} title=${c.title} onClose=${() => onDone(false)} footer=${html`<span></span><div className="row gap-s"><${Btn} kind="ghost" onClick=${() => onDone(false)}>Cancel<//><${Btn} kind=${c.danger ? 'danger' : 'primary'} onClick=${() => onDone(true)}>${c.ok || 'Confirm'}<//></div>`}>
      <p>${c.text}</p><//>`;
  }

  Object.assign(CC, { Icon, Btn, Card, Tag, Stat, Pill, StatusPill, STATUS_TONE, Progress, Empty, Tabs, Modal, Ext, Sel, BarChart, LineChart, HBars, Funnel, Editor, Confirm, memberOpts, ownerOpts, clientOpts });
})();
