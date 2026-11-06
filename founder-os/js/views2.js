/* Creative Cut Founder OS — Team, Sprint, Creative Captions, Meta Ads */
(function () {
  const CC = window.CC;
  const { D, F, n, has, sum, div, html, Icon, Btn, Card, Stat, Pill, StatusPill, Progress, Empty, Tabs, Sel, Ext, Tag, TaskLine } = CC;
  const { useState, useEffect } = React;

  /* ---------- Team ---------- */
  function Team() {
    const { s, M, open, up, go, toast } = CC.useApp();
    const wk = D.week(M.t);
    const [noteFor, setNoteFor] = useState(null); const [noteText, setNoteText] = useState('');
    const addNote = (id) => { if (!noteText.trim()) return; up((d) => { const m = d.team.find((x) => x.id === id); m.notes = [...(m.notes || []), { week: wk, date: M.t, text: noteText.trim() }]; }); setNoteText(''); setNoteFor(null); toast('Note saved'); };
    return html`<div className="page">
      <div className="page-h"><div><p className="eyebrow">Team management</p><h1>Ownership and workload</h1><p className="muted">Roles are listed separately from people. A role with nobody in it shows as unfilled, so nothing is silently owned by no one.</p></div>
        <div className="row gap-s wrap"><${Btn} icon="plus" onClick=${() => open('role')}>Role<//><${Btn} kind="primary" icon="plus" onClick=${() => open('member')}>Team member<//></div></div>
      <div className="grid-3">${s.roles.map((r) => { const ms = s.team.filter((m) => (m.roleIds || []).includes(r.id)); return html`<${Card} key=${r.id} title=${r.title} actions=${html`<${Btn} small kind="ghost" icon="edit" title="Edit role" onClick=${() => open('role', r.id)} />`}>
        <p className="sm">${r.responsibilities}</p><div className="row gap-s wrap pad">${ms.length ? ms.map((m) => html`<${Pill} key=${m.id} tone="accent">${m.name}<//>`) : html`<${Pill} tone="warn">Unfilled<//>`}
        ${M.tasks.filter((x) => x.owner === 'role:' + r.id && !x.done).length > 0 && html`<span className="xs muted">${M.tasks.filter((x) => x.owner === 'role:' + r.id && !x.done).length} open tasks waiting for this role</span>`}</div><//>`; })}</div>
      <${Card} title="Members" sub="Counts include deliverables and tasks assigned to each person">
        <div className="tbl-w"><table className="tbl"><thead><tr><th>Name</th><th>Roles</th><th>Clients</th><th className="r">Assigned</th><th className="r">Due today</th><th className="r">Overdue</th><th className="r">Completed</th><th className="r">On-time</th><th className="r">Revisions</th><th className="r">Workload (7d)</th><th className="r">Blocked</th><th></th></tr></thead><tbody>
          ${M.team.map((m) => html`<tr key=${m.id}><td><strong>${m.name}</strong>${m.active === false ? html` <${Pill}>inactive<//>` : ''}</td><td className="sm">${(m.roleIds || []).map((id) => s.roles.find((r) => r.id === id)?.title.split(' / ')[0]).join(', ') || '—'}</td><td className="sm">${(m.clientIds || []).map((id) => M.clientById[id]?.name).filter(Boolean).join(', ') || '—'}</td>
            <td className="r num">${m.assigned}</td><td className="r num">${m.dueToday}</td><td className=${'r num ' + (m.overdue ? 'risk' : '')}>${m.overdue}</td><td className="r num">${m.completed}</td><td className="r num">${F.pct(m.onTimePct, 0)}</td><td className="r num">${m.revisions}</td><td className=${'r num ' + (m.over ? 'risk' : '')}>${m.loadHours.toFixed(1)} / ${m.capacity} h</td><td className="r num">${m.blocked}</td>
            <td><${Btn} small kind="ghost" icon="edit" title=${'Edit ' + m.name} onClick=${() => open('member', m.id)} /></td></tr>`)}
        </tbody></table></div>
        ${s.team.length === 1 && html`<p className="muted sm pad">Only you are listed. Add the PM, editors and outreach person when they are confirmed, then assign them to roles and clients.</p>`}<//>
      <div className="grid-2">
        <${Card} title="Weekly performance notes" sub=${'Week of ' + D.fmt(wk)}>
          ${s.team.map((m) => { const notes = (m.notes || []).slice().reverse(); return html`<div key=${m.id} className="note-blk"><div className="row between"><strong>${m.name}</strong><${Btn} small kind="ghost" icon="plus" onClick=${() => { setNoteFor(m.id); setNoteText(''); }}>Note<//></div>
            ${noteFor === m.id && html`<div className="stack-s"><textarea className="inp" rows="2" aria-label=${'Note for ' + m.name} value=${noteText} onChange=${(e) => setNoteText(e.target.value)} placeholder="Specific, observable: what went well, what to change"></textarea><div className="row gap-s"><${Btn} small kind="primary" onClick=${() => addNote(m.id)}>Save note<//><${Btn} small kind="ghost" onClick=${() => setNoteFor(null)}>Cancel<//></div></div>`}
            ${notes.length ? notes.slice(0, 4).map((x, i) => html`<p key=${i} className="sm"><span className="muted xs">Week of ${D.fmt(x.week)} · </span>${x.text}</p>`) : html`<p className="xs muted">No notes yet.</p>`}</div>`; })}<//>
        <${Card} title="Daily report template" sub="Each member answers these five every working day" actions=${html`<${Btn} small kind="primary" icon="plus" onClick=${() => open('standup')}>Add report<//>`}>
          <ol className="olist"><li>What was completed yesterday?</li><li>What will be completed today?</li><li>What is blocked?</li><li>Is any deadline at risk?</li><li>What support is needed?</li></ol>
          <p className="sm pad">Reports today: <b className="num">${s.meetings.standups.filter((x) => x.date === M.t).length}</b> of ${s.team.filter((m) => m.active !== false).length} active members.</p>
          <${Btn} small kind="ghost" icon="arrow" onClick=${() => go('meetings')}>Open Meetings & Reviews<//><//>
      </div></div>`;
  }

  /* ---------- Sprint ---------- */
  function Sprint({ sub }) {
    const app = CC.useApp(); const { s, M, open, up } = app;
    const idx = Math.max(0, s.sprintDays.findIndex((d) => d.date === M.t));
    const [day, setDay] = useState(sub === 'roadmap' ? 9 : s.sprintDays[idx].day);
    useEffect(() => { if (sub === 'roadmap') setDay(9); }, [sub]);
    const sd = M.sprint.days.find((d) => d.day === day);
    const tasks = M.tasks.filter((x) => x.sprintDay === day);
    const groups = CC.TASK_KINDS.map((k) => [k, tasks.filter((x) => (x.kind || 'Founder') === k)]);
    const setDayField = (k, v) => up((d) => { d.sprintDays.find((x) => x.day === day)[k] = v; });
    const mehak = s.clients.find((c) => c.id === 'c_mehak'), maya = s.clients.find((c) => c.id === 'c_maya');
    const mp = mehak && mehak.cadence === 'daily' ? CC.dailyPlan(mehak, M.dels, sd.date, sd.date)[0] : null;
    const wp = maya && maya.cadence === 'weekly' ? CC.weeklyPlan(maya, M.dels, sd.date, sd.date)[0] : null;
    const estCost = sum(M.tasks.filter((x) => x.sprintDay), (x) => x.cost), actCost = sum(M.tasks.filter((x) => x.sprintDay), (x) => x.actualCost);
    return html`<div className="page">
      <div className="page-h"><div><p className="eyebrow">Nine-day growth sprint · Nov 7–15, 2026</p><h1>Sprint plan</h1><p className="muted">Completion is calculated from tasks marked Done. Budget cap ${F.inr(s.settings.sprintBudget)} of discretionary cash.</p></div>
        <div className="row gap-s"><${Btn} kind="primary" icon="plus" onClick=${() => open('task', null, { sprintDay: day, dueDate: sd.date, category: 'Sprint', kind: 'Founder' })}>Task for day ${day}<//></div></div>
      <div className="stats stats-s">
        <${Stat} label="Sprint completion" value=${F.pct(M.sprint.pct, 0)} tag="calc" sub=${M.sprint.done + ' / ' + M.sprint.total + ' tasks'} />
        <${Stat} label="Budget used" value=${F.inr(M.sprintSpend)} tag="actual" sub=${'Ads in sprint dates + expenses flagged sprint · cap ' + F.inr(s.settings.sprintBudget)} tone=${M.sprintSpend > s.settings.sprintBudget * 0.8 ? 'warn' : ''} />
        <${Stat} label="Planned task costs" value=${F.inr(estCost)} tag="est" sub=${'Actual costs logged on tasks: ' + F.inr(actCost)} />
        <${Stat} label="Qualified prospects" value=${M.crm.qualified + ' / ' + s.settings.outreachTarget} tag="target" sub=${M.crm.sprintOutreach + ' outreach sent in sprint dates'} />
      </div>
      <div className="days" role="tablist">${M.sprint.days.map((d) => html`<button key=${d.day} role="tab" aria-selected=${d.day === day} className=${'dayb' + (d.day === day ? ' on' : '') + (d.date === M.t ? ' today' : '')} onClick=${() => setDay(d.day)}>
        <span className="xs muted">Day ${d.day} · ${D.fmt(d.date)}</span><span className="dayb-t">${d.theme}</span><${Progress} value=${d.total ? d.done / d.total : 0} label=${'Day ' + d.day} /><span className="xs num muted">${d.done}/${d.total}</span></button>`)}</div>
      <div className="grid-side">
        <div className="stack">
          <${Card} title=${'Day ' + day + ' · ' + D.long(sd.date) + ' — ' + sd.theme} sub=${sd.focus}>
            <div className="kv kv-2"><span>Time planned</span><b className="num">${(sd.est / 60).toFixed(1)} h</b><span>Estimated cost</span><b className="num">${F.inr(sd.cost)}</b><span>Actual cost</span><b className="num">${F.inr(sd.actualCost)}</b><span>Completion</span><b className="num">${sd.done} / ${sd.total}</b></div>
          <//>
          ${groups.map(([k, ts]) => html`<${Card} key=${k} title=${k === 'Top priority' ? 'Three highest priorities' : k === 'Founder' ? 'Founder tasks' : k === 'Delegated' ? 'Delegated team tasks' : 'Client delivery tasks'} sub=${ts.length + ' task' + (ts.length === 1 ? '' : 's')} actions=${html`<${Btn} small kind="ghost" icon="plus" title="Add" onClick=${() => open('task', null, { sprintDay: day, dueDate: sd.date, category: 'Sprint', kind: k, owner: k === 'Delegated' ? '' : 'm_hemant' })} />`}>
            ${ts.length ? ts.map((x) => html`<div key=${x.id}><${TaskLine} x=${x} />${(x.dependency || has(x.cost) || x.evidence) && html`<div className="sub-meta">${x.dependency && html`<span>Depends on: ${x.dependency}</span>`}${has(x.cost) && html`<span>Est. cost ${F.inr(x.cost)}${has(x.actualCost) ? ' · actual ' + F.inr(x.actualCost) : ''}</span>`}${x.evidence && html`<${Ext} href=${x.evidence}>Evidence<//>`}</div>`}</div>`) : html`<p className="muted pad sm">None.</p>`}<//>`)}
        </div>
        <div className="stack">
          <${Card} title="Ongoing client delivery" sub="Calculated from targets and deliverables">
            ${mp && html`<div className="kv"><span>Mehak target</span><b className="num">${mp.working ? mp.min + '–' + mp.stretch : 'Non-working'}</b><span>Scheduled</span><b className="num">${mp.scheduled}</b><span>Delivered</span><b className="num">${sd.date > M.t ? '—' : mp.delivered}</b></div>`}
            ${wp && html`<div className="kv"><span>Maya, week of ${D.fmt(wp.weekStart)}</span><b className="num">${wp.min}–${wp.stretch}</b><span>Delivered this week</span><b className="num">${wp.delivered}</b></div>`}
            <p className="xs muted">Suri: ${s.clients.find((c) => c.id === 'c_suri')?.configured ? 'see Production' : 'not configured'}.</p><//>
          <${Card} title="KPIs and blockers">
            <div className="fld"><label htmlFor="kp-t">Target KPIs <${Tag} kind="target" /></label><textarea id="kp-t" className="inp" rows="3" value=${sd.targetKPIs} onChange=${(e) => setDayField('targetKPIs', e.target.value)}></textarea></div>
            <div className="fld"><label htmlFor="kp-a">Actual KPIs <${Tag} kind="actual" /></label><textarea id="kp-a" className="inp" rows="3" placeholder="Only what actually happened" value=${sd.actualKPIs} onChange=${(e) => setDayField('actualKPIs', e.target.value)}></textarea></div>
            <div className="fld"><label htmlFor="kp-b">Blockers</label><textarea id="kp-b" className="inp" rows="2" value=${sd.blockers} onChange=${(e) => setDayField('blockers', e.target.value)}></textarea></div>
            <div className="fld"><label htmlFor="kp-n">Notes / evidence links</label><textarea id="kp-n" className="inp" rows="2" value=${sd.notes} onChange=${(e) => setDayField('notes', e.target.value)}></textarea></div><//>
          ${day === 9 && html`<${Card} title="Next 30-day roadmap" sub="Shown on the mind map as 30-Day Growth Goals"><textarea className="inp" rows="8" aria-label="30-day roadmap" placeholder="One goal per line: outcome, measure, owner" value=${s.goals.thirtyDay} onChange=${(e) => up((d) => { d.goals.thirtyDay = e.target.value; })}></textarea><//>`}
        </div></div></div>`;
  }

  /* ---------- Creative Captions ---------- */
  function Product() {
    const { s, M, open, up } = CC.useApp();
    const cfg = s.product.config; const P = M.prod;
    const [from, setFrom] = useState(''); const [to, setTo] = useState('');
    const rows = s.product.daily.filter((d) => (!from || d.date >= from) && (!to || d.date <= to));
    const tot = (k) => sum(rows, (d) => d[k]);
    const stages = [['Website visits', tot('visits')], ['Product page engaged', tot('engaged')], ['Trial signup', tot('trials')], ['Trial activation', tot('activations')], ['Checkout started', tot('checkouts')], ['Payment completed', tot('purchases')]].map(([label, value]) => ({ label, value }));
    const productExp = sum(s.finance.expenses.filter((e) => e.category === 'Product'), (e) => e.amount);
    const setCfg = (k, v) => up((d) => { d.product.config[k] = v; });
    const setVer = (k) => up((d) => { d.product.config.verified[k] = !d.product.config.verified[k]; });
    const V = [['price', 'Pro price ₹' + cfg.proPrice], ['coupon', 'Coupon ' + cfg.coupon], ['trial', cfg.trialDays + '-day free trial'], ['checkout', 'Checkout completes'], ['refund', cfg.refundDays + '-day money-back'], ['licence', 'Licence for ' + cfg.licenseSeats + ' computers']];
    return html`<div className="page">
      <div className="page-h"><div><p className="eyebrow">Digital product</p><h1>Creative Captions</h1><p className="muted">After Effects captioning plugin · ${cfg.styles} caption styles · ${cfg.languages} languages · ${cfg.sfx} sound effects · editable captions · <${Ext} href=${cfg.url}>${cfg.url.replace('https://', '')}<//></p></div>
        <${Btn} kind="primary" icon="plus" onClick=${() => open('productDay')}>Log a day<//></div>
      <div className="grid-side">
        <${Card} title="Funnel" sub="Each conversion uses the stage directly before it as the denominator" actions=${html`<div className="row gap-s"><input type="date" className="inp" aria-label="From date" value=${from} onChange=${(e) => setFrom(e.target.value)} /><input type="date" className="inp" aria-label="To date" value=${to} onChange=${(e) => setTo(e.target.value)} /></div>`}>
          <${CC.Funnel} stages=${stages} />
          <div className="kv kv-2 pad"><span>Refunds</span><b className="num">${F.num(tot('refunds'))} (${F.inr(tot('refundAmt'))})</b><span>Refund rate (of payments)</span><b className="num">${F.pct(div(tot('refunds'), tot('purchases')))}</b><span>Visit → payment</span><b className="num">${F.pct(div(tot('purchases'), tot('visits')), 2)}</b><span>Trial → payment (same days)</span><b className="num">${F.pct(div(tot('purchases'), tot('trials')))}</b></div>
          <p className="xs muted">Some buyers skip the trial, so trial-to-payment on the same days is rough. Use the cohort table for trial conversion.</p><//>
        <${Card} title="Configuration" sub="Treat every price and purchase rule as unverified until you test it">
          ${V.map(([k, l]) => html`<label key=${k} className="chk"><input type="checkbox" checked=${!!cfg.verified[k]} onChange=${() => setVer(k)} /><span>${l}</span>${cfg.verified[k] ? html`<${Pill} tone="ok">Verified<//>` : html`<${Pill} tone="warn">Needs verification<//>`}</label>`)}
          <div className="form pad">
            ${[['proPrice', 'Pro price (₹)'], ['couponPct', 'Coupon discount %'], ['trialDays', 'Trial days'], ['refundDays', 'Refund window (days)'], ['licenseSeats', 'Licence seats']].map(([k, l]) => html`<div key=${k} className="fld"><label htmlFor=${'pc-' + k}>${l}</label><input id=${'pc-' + k} className="inp num" type="number" value=${cfg[k] ?? ''} onChange=${(e) => setCfg(k, e.target.value === '' ? null : +e.target.value)} /></div>`)}
            <div className="fld"><label htmlFor="pc-coupon">Coupon code</label><input id="pc-coupon" className="inp" value=${cfg.coupon} onChange=${(e) => setCfg('coupon', e.target.value)} /></div>
          </div><//>
      </div>
      <div className="stats">
        <${Stat} label="Website visits" value=${F.num(P.visits)} tag="actual" /><${Stat} label="Trial starts" value=${F.num(P.trials)} tag="actual" /><${Stat} label="Trial activations" value=${F.num(P.activations)} tag="actual" sub=${F.pct(div(P.activations, P.trials)) + ' of trials'} />
        <${Stat} label="Purchases" value=${F.num(P.purchases)} tag="actual" sub=${'Paid ' + F.num(P.paid) + ' · organic ' + F.num(P.organic) + ' · unattributed ' + F.num(Math.max(0, P.purchases - P.paid - P.organic))} />
        <${Stat} label="Gross receipts" value=${F.inr(P.gross)} tag="actual" /><${Stat} label="Refunds" value=${F.inr(P.refundAmt)} tag="actual" sub=${F.num(P.refunds) + ' refunds'} />
        <${Stat} label="Net receipts" value=${F.inr(P.net)} tag="calc" /><${Stat} label="Revenue per buyer" value=${F.inr(P.rpb)} tag="calc" sub="Net ÷ non-refunded buyers" />
        <${Stat} label="Product expenses" value=${F.inr(productExp)} tag="actual" sub="Finance → category Product" /><${Stat} label="Support issues" value=${F.num(P.support)} tag="actual" /><${Stat} label="Install failures" value=${F.num(P.installFail)} tag="actual" tone=${P.installFail ? 'warn' : ''} />
        <${Stat} label="Ad-attributed purchases" value=${F.num(M.ads.purchases)} tag="est" sub="From Meta, attribution not verified" />
      </div>
      <${Card} title="Trial cohorts" sub=${'Grouped by signup date. A cohort is mature after its ' + cfg.trialDays + '-day trial plus one day; before that, conversion is provisional.'}>
        ${P.cohorts.length ? html`<div className="tbl-w"><table className="tbl"><thead><tr><th>Signup date</th><th className="r">Trials</th><th className="r">Converted</th><th className="r">Rate</th><th>Status</th><th></th></tr></thead><tbody>
          ${P.cohorts.map((c) => { const rec = s.product.daily.find((d) => d.date === c.date); return html`<tr key=${c.date}><td>${D.long(c.date)}</td><td className="r num">${c.trials}</td><td className="r"><input className="inp num w60" type="number" min="0" aria-label=${'Converted from ' + c.date} value=${c.converted ?? ''} onChange=${(e) => up((d) => { d.product.daily.find((x) => x.id === rec.id).cohortConverted = e.target.value === '' ? null : +e.target.value; })} /></td><td className="r num">${F.pct(c.rate)}</td><td>${c.isMature ? html`<${Pill} tone="ok">Mature<//>` : html`<${Pill} tone="info">Maturing · ${c.daysLeft} d left<//>`}</td><td></td></tr>`; })}
        </tbody></table></div>` : html`<${Empty} icon="captions" title="No trial signups logged" text="Log a day with trial signups to start a cohort." />`}<//>
      <${Card} title="Daily records" sub="Counts from your analytics and payment dashboard. Blank means not recorded.">
        ${s.product.daily.length ? html`<div className="tbl-w"><table className="tbl"><thead><tr><th>Date</th><th className="r">Visits</th><th className="r">Engaged</th><th className="r">Trials</th><th className="r">Activ.</th><th className="r">Checkout</th><th className="r">Paid</th><th className="r">Gross</th><th className="r">Refunds</th><th className="r">Support</th><th className="r">Install fail</th><th>Source</th></tr></thead><tbody>
          ${s.product.daily.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((d) => html`<tr key=${d.id}><td><button className="lnk" onClick=${() => open('productDay', d.id)}>${D.long(d.date)}</button>${d.demo ? html` <${Pill} tone="warn">DEMO<//>` : ''}</td>${['visits', 'engaged', 'trials', 'activations', 'checkouts', 'purchases'].map((k) => html`<td key=${k} className="r num">${F.num(d[k])}</td>`)}<td className="r num">${F.inr(d.gross)}</td><td className="r num">${F.num(d.refunds)}</td><td className="r num">${F.num(d.supportIssues)}</td><td className="r num">${F.num(d.installFailures)}</td><td className="xs muted">${d.source}</td></tr>`)}
        </tbody></table></div>` : html`<${Empty} icon="captions" title="No product data yet" text="Nothing is assumed. Log real counts from website analytics and your payment dashboard." action=${html`<${Btn} small kind="primary" onClick=${() => open('productDay')}>Log first day<//>`} />`}<//>
    </div>`;
  }

  /* ---------- Meta Ads ---------- */
  function Ads() {
    const { s, M, open, up } = CC.useApp(); const a = M.ads; const b = s.ads.budget;
    const conf = !a.entries ? ['No data', 'muted'] : a.verified === a.entries ? ['Verified against Ads Manager', 'ok'] : a.verified ? ['Partially verified', 'warn'] : ['Unverified', 'crit'];
    const total = n(b.media) + n(b.reserve) + n(b.contingency);
    const byCreative = Object.values(s.ads.entries.reduce((acc, e) => { const k = e.creative || '(unnamed)'; acc[k] = acc[k] || { k, spend: 0, taxes: 0, imp: 0, clicks: 0, lpv: 0, trials: 0, purch: 0, rev: 0 }; const r = acc[k]; r.spend += n(e.spend); r.taxes += n(e.taxes); r.imp += n(e.impressions); r.clicks += n(e.clicks); r.lpv += n(e.lpv); r.trials += n(e.trials); r.purch += n(e.purchases); r.rev += n(e.revenue); return acc; }, {}));
    const dates = [...new Set(s.ads.entries.map((e) => e.date))].sort();
    const chart = dates.map((d) => ({ label: D.fmt(d), values: [sum(s.ads.entries.filter((e) => e.date === d), (e) => n(e.spend) + n(e.taxes))] }));
    let cum = 0; const cumChart = dates.map((d) => { cum += sum(s.ads.entries.filter((e) => e.date === d), (e) => n(e.spend) + n(e.taxes)); return { label: D.fmt(d), values: [cum, n(b.media)] }; });
    const T = [['pixel', 'Meta Pixel installed on product page and checkout'], ['purchaseEvent', 'Purchase event fires once with value and INR currency'], ['testPurchase', 'Real test purchase seen in Events Manager'], ['checkout', 'Checkout and licence delivery work end to end'], ['utm', 'UTM parameters on every ad link']];
    const metric = (label, value, formula, tag = 'calc') => html`<${Stat} label=${label} value=${value} tag=${tag} sub=${formula} />`;
    return html`<div className="page">
      <div className="page-h"><div><p className="eyebrow">Meta Ads · controlled experiment</p><h1>Ads and budget</h1><p className="muted">Nothing here connects to Meta. Enter numbers from Ads Manager; blank fields stay blank and are never read as results.</p></div>
        <div className="row gap-s wrap"><${Btn} icon="plus" onClick=${() => open('campaign')}>Campaign<//><${Btn} kind="primary" icon="plus" onClick=${() => open('adEntry')}>Enter results<//></div></div>
      <div className="grid-3">
        <${Card} title="Budget" sub=${'Discretionary total ' + F.inr(total)}>
          ${[['media', 'Media spend'], ['reserve', 'Tax / emergency reserve'], ['contingency', 'Contingency']].map(([k, l]) => html`<div key=${k} className="row between gap-s pad-s"><label htmlFor=${'bd-' + k} className="sm">${l}</label><input id=${'bd-' + k} className="inp num w100" type="number" value=${b[k] ?? ''} onChange=${(e) => up((d) => { d.ads.budget[k] = e.target.value === '' ? null : +e.target.value; })} /></div>`)}
          <div className="kv pad"><span>Spent incl. tax</span><b className="num">${F.inr(a.cost)}</b><span>Media remaining</span><b className=${'num ' + (a.remaining < 0 ? 'risk' : '')}>${F.inr(a.remaining)}</b></div>
          <${Progress} value=${a.usedPct} tone=${a.usedPct >= 1 ? 'crit' : a.usedPct >= 0.8 ? 'warn' : 'accent'} label="Media budget used" />
          ${a.usedPct >= 0.8 && html`<p className="risk sm pad">Approaching the media cap. Do not move reserve or contingency into ads without a decision log entry.</p>`}<//>
        <${Card} title="Tracking checklist" sub="Required before the Nov 8 start">
          ${T.map(([k, l]) => html`<label key=${k} className="chk"><input type="checkbox" checked=${!!s.ads.tracking[k]} onChange=${() => up((d) => { d.ads.tracking[k] = !d.ads.tracking[k]; })} /><span>${l}</span></label>`)}
          <p className=${'sm pad ' + (a.trackingDone ? '' : 'risk')}>${a.trackingDone ? 'Tracking verified. The campaign may start (no earlier than Nov 8).' : 'Do not start spending until every item is ticked.'}</p><//>
        <${Card} title="Decision" className=${'decision dec-' + a.decision.level}>
          <div className="dec-opts">${['Continue', 'Investigate', 'Pause', 'Tracking Incomplete'].map((k) => html`<span key=${k} className=${'dec-o' + (a.decision.key === k ? ' on' : '')}>${k}</span>`)}</div>
          <p>${a.decision.why}</p><p className="xs muted">Rule-based on your entries. Low CPC does not mean sales; judge on purchases, refunds and matured trial cohorts.</p>
          <div className="row gap-s pad"><span className="sm muted">Data confidence</span><${Pill} tone=${conf[1]}>${conf[0]}<//></div><//>
      </div>
      <div className="stats">
        ${metric('Media spend', F.inr(a.spend), 'Sum of entries', 'actual')}${metric('Taxes and fees', F.inr(a.taxes), 'Sum of entries', 'actual')}
        ${metric('Impressions', F.num(a.impressions), 'Sum of entries', 'actual')}${metric('Reach', F.num(a.reach), 'Summed per entry; overlaps not removed', 'actual')}
        ${metric('Link clicks', F.num(a.clicks), 'Sum of entries', 'actual')}${metric('Link CTR', F.pct(a.ctr, 2), 'Link clicks ÷ impressions')}
        ${metric('Link CPC', F.inr2(a.cpc), 'Media spend ÷ link clicks')}${metric('Landing page views', F.num(a.lpv), F.pct(a.lpvRate) + ' of link clicks', 'actual')}
        ${metric('Trials', F.num(a.trials), 'Cost per trial ' + F.inr(a.costPerTrial), 'est')}${metric('Attributed purchases', F.num(a.purchases), 'Meta attribution — an estimate', 'est')}
        ${metric('Attributed revenue', F.inr(a.revenue), 'As reported by Meta', 'est')}${metric('CPA', F.inr(a.cpa), '(spend + tax) ÷ purchases')}
        ${metric('ROAS', F.x(a.roas), 'Attributed revenue ÷ (spend + tax)')}${metric('Net contribution estimate', F.inr(a.entries ? a.net : null), 'Attributed revenue − spend − tax', 'est')}
      </div>
      <div className="grid-2">
        <${Card} title="Daily spend"><${CC.BarChart} data=${chart} series=${[{ name: 'Spend incl. tax' }]} fmt=${(v) => '₹' + Math.round(v)} empty="No ad spend entered" /><//>
        <${Card} title="Cumulative spend vs media budget"><${CC.LineChart} data=${cumChart} series=${[{ name: 'Cumulative spend' }, { name: 'Media budget', color: 'var(--c3)', dash: true }]} fmt=${(v) => '₹' + Math.round(v)} empty="Needs at least two days of entries" /><//>
      </div>
      <${Card} title="Campaigns">${s.ads.campaigns.map((c) => html`<div key=${c.id} className="line"><button className="line-main" onClick=${() => open('campaign', c.id)}><span className="line-t">${c.name}</span><span className="muted sm">${c.objective} · ${c.conversion} · ${c.location} · ${F.inr(c.dailyBudget)}/day · start ${D.fmt(c.startDate)}</span><span className="sm">${c.audience}</span></button><div className="line-a"><${StatusPill} s=${c.status} /></div></div>`)}<//>
      <${Card} title="By creative">${byCreative.length ? html`<div className="tbl-w"><table className="tbl"><thead><tr><th>Creative</th><th className="r">Spend+tax</th><th className="r">Impr.</th><th className="r">CTR</th><th className="r">CPC</th><th className="r">LPV</th><th className="r">Trials</th><th className="r">Purch.</th><th className="r">CPA</th><th className="r">ROAS</th></tr></thead><tbody>
        ${byCreative.map((r) => html`<tr key=${r.k}><td>${r.k}</td><td className="r num">${F.inr(r.spend + r.taxes)}</td><td className="r num">${F.num(r.imp)}</td><td className="r num">${F.pct(div(r.clicks, r.imp), 2)}</td><td className="r num">${F.inr2(div(r.spend, r.clicks))}</td><td className="r num">${F.num(r.lpv)}</td><td className="r num">${F.num(r.trials)}</td><td className="r num">${F.num(r.purch)}</td><td className="r num">${F.inr(div(r.spend + r.taxes, r.purch))}</td><td className="r num">${F.x(div(r.rev, r.spend + r.taxes))}</td></tr>`)}</tbody></table></div>` : html`<p className="muted pad">No entries yet.</p>`}<//>
      <${Card} title="Entries">${s.ads.entries.length ? html`<div className="tbl-w"><table className="tbl"><thead><tr><th>Date</th><th>Creative</th><th className="r">Spend</th><th className="r">Tax</th><th className="r">Clicks</th><th className="r">LPV</th><th className="r">Purch.</th><th>Source</th><th>Verified</th></tr></thead><tbody>
        ${s.ads.entries.slice().sort((x, y) => (x.date < y.date ? 1 : -1)).map((e) => html`<tr key=${e.id}><td><button className="lnk" onClick=${() => open('adEntry', e.id)}>${D.fmt(e.date)}</button>${e.demo ? html` <${Pill} tone="warn">DEMO<//>` : ''}</td><td>${e.creative || '—'}</td><td className="r num">${F.inr(e.spend)}</td><td className="r num">${F.inr(e.taxes)}</td><td className="r num">${F.num(e.clicks)}</td><td className="r num">${F.num(e.lpv)}</td><td className="r num">${F.num(e.purchases)}</td><td className="xs muted">${e.dataSource}</td><td>${e.verified ? html`<${Pill} tone="ok">Yes<//>` : html`<${Pill} tone="warn">No<//>`}</td></tr>`)}</tbody></table></div>` : html`<${Empty} icon="megaphone" title="No ad results entered" text="The campaign is a draft. Start no earlier than Nov 8 and only after the tracking checklist is complete." />`}
        <p className="xs muted pad">Attribution caveat: Meta counts purchases within its attribution window, including view-through. Cross-check purchases against your payment dashboard in Creative Captions before trusting ROAS.</p><//>
    </div>`;
  }

  Object.assign(CC, { Team, Sprint, Product, Ads });
})();
