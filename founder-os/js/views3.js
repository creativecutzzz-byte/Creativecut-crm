/* Creative Cut Founder OS — CRM, Finance, Personal, Meetings, Reports & Settings */
(function () {
  const CC = window.CC;
  const { D, F, n, has, sum, div, html, Icon, Btn, Card, Stat, Pill, StatusPill, Progress, Empty, Tabs, Sel, Ext, Tag } = CC;
  const { useState, useRef } = React;

  /* ---------- CRM ---------- */
  function CRM() {
    const app = CC.useApp(); const { s, M, open, up, toast, confirm } = app;
    const [pipe, setPipe] = useState('agency'); const [view, setView] = useState('board'); const [editStages, setEditStages] = useState(false);
    const leads = M.leads.filter((l) => (l.pipeline || 'agency') === pipe);
    const stages = s.crm.stages;
    const move = (l, st) => up((d) => { const x = d.leads.find((y) => y.id === l.id); if (x.stage === st) return; x.stage = st; x.history = [...(x.history || []), { date: M.t, stage: st }]; x.lastInteraction = x.lastInteraction && x.lastInteraction > M.t ? x.lastInteraction : M.t; });
    const ready = M.leads.filter((l) => ['identified', 'qualified'].includes(l.stage) && !l.outreachDate);
    const markSent = (l) => up((d) => { const x = d.leads.find((y) => y.id === l.id); x.outreachDate = M.t; x.lastInteraction = M.t; if (!x.followUp) x.followUp = D.add(M.t, 3); if (['identified', 'qualified'].includes(x.stage)) { x.stage = 'contacted'; x.history = [...(x.history || []), { date: M.t, stage: 'contacted' }]; } });
    const stageTot = (id) => leads.filter((l) => l.stage === id);
    return html`<div className="page">
      <div className="page-h"><div><p className="eyebrow">Sales CRM</p><h1>Pipeline</h1><p className="muted">No prospects are pre-loaded and nothing is sent from here. Mark outreach as sent only after you have actually sent it.</p></div>
        <div className="row gap-s wrap"><${Btn} icon="edit" onClick=${() => setEditStages(!editStages)}>Stages<//><${Btn} kind="primary" icon="plus" onClick=${() => open('lead', null, { pipeline: pipe })}>Lead<//></div></div>
      <div className="stats stats-s">
        <${Stat} label="Qualified prospects" value=${M.crm.qualified + ' / ' + s.settings.outreachTarget} tag="target" sub="Sprint target · stage past Identified, not Lost" />
        <${Stat} label="Pipeline value (open)" value=${F.inr(M.crm.pipeline)} tag="est" sub=${F.inr(M.crm.weighted) + ' weighted by probability'} />
        <${Stat} label="Won" value=${M.crm.won} tag="actual" sub=${F.inr(M.crm.wonValue) + ' deal value'} />
        <${Stat} label="Cash collected from deals" value=${F.inr(M.crm.cash)} tag="actual" sub="Entered per lead" />
      </div>
      <${Progress} value=${M.crm.qualified / n(s.settings.outreachTarget)} label="Qualified prospects vs target" />
      ${editStages && html`<${Card} title="Pipeline stages" sub="Rename, reorder or add. Leads keep their stage id.">
        ${stages.map((st, i) => html`<div key=${st.id} className="row gap-s pad-s"><input className="inp" aria-label="Stage name" value=${st.label} onChange=${(e) => up((d) => { d.crm.stages[i].label = e.target.value; })} />
          <${Sel} ariaLabel="Stage type" value=${st.type} options=${[['open', 'Open'], ['won', 'Won'], ['lost', 'Lost']]} onChange=${(v) => up((d) => { d.crm.stages[i].type = v; })} />
          <${Btn} small kind="ghost" icon="left" title="Move earlier" disabled=${i === 0} onClick=${() => up((d) => { const a = d.crm.stages; [a[i - 1], a[i]] = [a[i], a[i - 1]]; })} />
          <${Btn} small kind="ghost" icon="right" title="Move later" disabled=${i === stages.length - 1} onClick=${() => up((d) => { const a = d.crm.stages; [a[i + 1], a[i]] = [a[i], a[i + 1]]; })} />
          <${Btn} small kind="ghost" icon="trash" title="Remove stage" disabled=${s.leads.some((l) => l.stage === st.id)} onClick=${async () => { if (await confirm({ title: 'Remove stage ' + st.label + '?', text: 'Only empty stages can be removed.', ok: 'Remove', danger: true })) up((d) => { d.crm.stages.splice(i, 1); }); }} /></div>`)}
        <${Btn} small icon="plus" onClick=${() => up((d) => { d.crm.stages.splice(d.crm.stages.length - 2, 0, { id: CC.uid('stg'), label: 'New stage', type: 'open' }); })}>Add stage<//><//>`}
      <div className="row between wrap gap-s"><${Tabs} value=${pipe} onChange=${setPipe} tabs=${[['agency', 'A · Agency services · ' + M.leads.filter((l) => (l.pipeline || 'agency') === 'agency').length], ['product', 'B · Captions & partnerships · ' + M.leads.filter((l) => l.pipeline === 'product').length]]} />
        <${Tabs} small value=${view} onChange=${setView} tabs=${[['board', 'Board'], ['table', 'Table'], ['planner', 'Outreach planner'], ['offers', 'Offers']]} /></div>
      ${view === 'board' && html`<div className="kanban">${stages.map((st) => { const items = stageTot(st.id); return html`<div key=${st.id} className="kcol" onDragOver=${(e) => e.preventDefault()} onDrop=${(e) => { const id = e.dataTransfer.getData('text/plain'); const l = s.leads.find((x) => x.id === id); l && move(l, st.id); }}>
        <div className="kcol-h"><${Pill} tone=${st.type === 'won' ? 'ok' : st.type === 'lost' ? 'muted' : 'info'}>${st.label}<//><span className="xs num muted">${items.length} · ${F.inr(sum(items, (l) => l.value))}</span></div>
        ${items.map((l) => html`<article key=${l.id} className=${'kcard' + (l.followOverdue ? ' is-warn' : '')} draggable="true" onDragStart=${(e) => e.dataTransfer.setData('text/plain', l.id)}>
          <button className="kcard-b" onClick=${() => open('lead', l.id)}><strong className="kcard-t">${l.name}</strong><span className="sm muted">${[l.business, l.role].filter(Boolean).join(' · ')}</span>
            <span className="sm">${has(l.value) ? F.inr(l.value) : 'No value'}${has(l.probability) ? ' · ' + l.probability + '%' : ''}</span>
            <span className=${'xs ' + (l.followOverdue ? 'risk' : 'muted')}>${l.followUp ? 'Follow up ' + D.fmt(l.followUp) : 'No follow-up set'}</span>${l.demo && html`<${Pill} tone="warn">DEMO<//>`}</button>
          <${Sel} className="sel-s" ariaLabel=${'Stage for ' + l.name} value=${l.stage} options=${stages.map((x) => [x.id, x.label])} onChange=${(v) => move(l, v)} /></article>`)}
        ${!items.length && html`<p className="kempty">Empty</p>`}</div>`; })}</div>`}
      ${view === 'table' && html`<${Card}>${leads.length ? html`<div className="tbl-w"><table className="tbl"><thead><tr><th>Name</th><th>Business</th><th>Stage</th><th>Source</th><th>Interest</th><th>Channel</th><th>Outreach</th><th>Follow-up</th><th className="r">Value</th><th className="r">Prob.</th><th className="r">Cash</th><th>Owner</th><th>Profile</th></tr></thead><tbody>
        ${leads.map((l) => html`<tr key=${l.id}><td><button className="lnk" onClick=${() => open('lead', l.id)}>${l.name}</button></td><td>${l.business}</td><td>${stages.find((x) => x.id === l.stage)?.label}</td><td>${l.source}</td><td className="sm">${l.interest}</td><td>${l.channel}</td><td className="num">${D.fmt(l.outreachDate)}</td><td className=${'num ' + (l.followOverdue ? 'risk' : '')}>${D.fmt(l.followUp)}</td><td className="r num">${F.inr(l.value)}</td><td className="r num">${has(l.probability) ? l.probability + '%' : '—'}</td><td className="r num">${F.inr(l.cash)}</td><td>${CC.ownerName(s, l.owner)}</td><td><${Ext} href=${l.url}>view<//></td></tr>`)}</tbody></table></div>` : html`<${Empty} icon="target" title="No leads in this pipeline" text="Research real prospects and add them one by one with a specific pain point." />`}<//>`}
      ${view === 'planner' && html`<div className="grid-2">
        <${Card} title="Follow-ups due" sub=${M.crm.followOverdue.length + ' overdue · ' + M.crm.followToday.length + ' today'}>
          ${[...M.crm.followOverdue, ...M.crm.followToday].length ? [...M.crm.followOverdue, ...M.crm.followToday].map((l) => html`<div key=${l.id} className="line"><button className="line-main" onClick=${() => open('lead', l.id)}><span className="line-t">${l.name}${l.business ? ' · ' + l.business : ''}</span><span className=${'sm ' + (l.followOverdue ? 'risk' : 'muted')}>${l.followOverdue ? 'Overdue since ' : 'Due '}${D.fmt(l.followUp)} · ${l.channel || 'no channel'}</span></button>
            <div className="line-a"><${Btn} small kind="ghost" title="Log a follow-up done today, next in 3 days" icon="check" onClick=${() => { up((d) => { const x = d.leads.find((y) => y.id === l.id); x.lastInteraction = M.t; x.followUp = D.add(M.t, 3); }); toast('Logged · next follow-up ' + D.fmt(D.add(M.t, 3))); }}>Followed up<//></div></div>`) : html`<p className="muted pad">No follow-ups due.</p>`}<//>
        <${Card} title="Ready for first outreach" sub="Identified or qualified, no outreach date yet">
          ${ready.length ? ready.slice(0, 25).map((l) => html`<div key=${l.id} className="line"><button className="line-main" onClick=${() => open('lead', l.id)}><span className="line-t">${l.name}${l.business ? ' · ' + l.business : ''}</span><span className="sm muted">${l.pain || 'Add the specific pain point before writing the message'}</span></button>
            <div className="line-a"><${Btn} small title="I sent this message today" onClick=${() => { markSent(l); toast('Outreach logged for ' + l.name + ' · follow-up in 3 days'); }}>I sent it<//></div></div>`) : html`<p className="muted pad">No prospects waiting. Today’s outreach logged: ${M.crm.outreachToday}.</p>`}<//></div>`}
      ${view === 'offers' && html`<div className="grid-2">${s.crm.offers.map((o) => html`<${Card} key=${o.id} title=${o.name} actions=${html`<${Btn} small kind="ghost" icon="edit" title="Edit offer" onClick=${() => open('offer', o.id)} />`}>
        <div className="kv"><span>Price</span><b className="num">${F.inr(o.price)}</b><span>Advance</span><b className="num">${F.inr(o.advance)}</b><span>Revisions</span><b className="num">${o.revisions ?? 'Not set'}</b></div><p className="sm pad">${o.scope}</p>
        <p className="xs muted">Won deals: ${M.leads.filter((l) => l.interest === o.name && l.type === 'won').length}</p><//>`)}
        <${Card} title="Add an offer"><${Btn} icon="plus" onClick=${() => open('offer')}>New offer<//><//></div>`}
    </div>`;
  }

  /* ---------- Finance ---------- */
  function Finance() {
    const { s, M, open, up } = CC.useApp();
    const [tab, setTab] = useState('clients');
    const fin = s.finance;
    const cashIn = sum(fin.payments, (p) => p.amount) + Math.max(0, M.prod.gross - sum(fin.payments.filter((p) => p.source === 'Product'), (p) => p.amount));
    const cashOut = sum(fin.expenses, (e) => e.amount) + M.ads.cost;
    const months = [...new Set([...fin.payments.map((p) => D.month(p.date)), ...fin.expenses.map((e) => D.month(e.date)), ...s.ads.entries.map((e) => D.month(e.date)), ...s.product.daily.map((d) => D.month(d.date)), M.month])].filter(Boolean).sort();
    const flow = months.map((m) => {
      const inn = sum(fin.payments.filter((p) => D.month(p.date) === m && p.source !== 'Product'), (p) => p.amount) + sum(s.product.daily.filter((d) => D.month(d.date) === m), (d) => n(d.gross) - n(d.refundAmt));
      const out = sum(fin.expenses.filter((e) => D.month(e.date) === m), (e) => e.amount) + sum(s.ads.entries.filter((e) => D.month(e.date) === m), (e) => n(e.spend) + n(e.taxes));
      return { m, inn, out, net: inn - out };
    });
    const cat = (c) => sum(fin.expenses.filter((e) => e.category === c && D.month(e.date) === M.month), (e) => e.amount);
    return html`<div className="page">
      <div className="page-h"><div><p className="eyebrow">Financial command center · ${D.monthName(M.month)}</p><h1>Money</h1><p className="muted">Cash received, invoiced revenue, outstanding amounts and profit estimates are kept separate. An advance is cash, not profit.</p></div>
        <div className="row gap-s wrap"><${Btn} icon="plus" onClick=${() => open('invoice')}>Invoice<//><${Btn} icon="plus" onClick=${() => open('expense')}>Expense<//><${Btn} kind="primary" icon="plus" onClick=${() => open('payment')}>Payment received<//></div></div>
      <div className="stats">
        <${Stat} label="Invoiced this month" value=${F.inr(M.invoicedMonth)} tag="actual" />
        <${Stat} label="Client cash received this month" value=${F.inr(M.cashMonthClient)} tag="actual" sub="Includes advances" />
        <${Stat} label="Outstanding from clients" value=${F.inr(M.pending)} tag="actual" sub="All invoices minus payments" tone=${M.pending ? 'warn' : ''} />
        <${Stat} label="Product net this month" value=${F.inr(M.productGrossMonth - M.productRefundMonth)} tag="actual" sub="Gross − refunds, from Product logs" />
        <${Stat} label="Expenses this month" value=${F.inr(M.expensesMonth)} tag="actual" sub=${'Payouts ' + F.inr(cat('Editor payout')) + ' · software ' + F.inr(cat('Software')) + ' · outsourcing ' + F.inr(cat('Outsourcing'))} />
        <${Stat} label="Ad spend this month" value=${F.inr(M.adSpendMonth)} tag="actual" sub="From Meta Ads entries" />
        <${Stat} label="Operating result (estimate)" value=${F.inr(M.operatingEstimate)} tag="est" sub="Invoiced + product net − expenses − ads" tone=${M.operatingEstimate < 0 ? 'crit' : ''} />
        <${Stat} label="Cash result this month" value=${F.inr(M.cashResultMonth)} tag="actual" sub="Cash in − cash out" />
      </div>
      <${Tabs} value=${tab} onChange=${setTab} tabs=${[['clients', 'By client'], ['flow', 'Cash flow'], ['invoices', 'Invoices · ' + fin.invoices.length], ['payments', 'Payments · ' + fin.payments.length], ['expenses', 'Expenses · ' + fin.expenses.length], ['budget', 'Budget vs profit']]} />
      ${tab === 'clients' && html`<${Card} sub="Editor pool % is per contract (reference 70 / 30). Reference payout is an estimate on cash received; actual payouts come from expense records.">
        <div className="tbl-w"><table className="tbl"><thead><tr><th>Client</th><th className="r">Contract value</th><th className="r">Price / deliverable</th><th className="r">Delivered</th><th className="r">Earned (est.)</th><th className="r">Invoiced</th><th className="r">Advance rec’d</th><th className="r">Total rec’d</th><th className="r">Balance due</th><th className="r">Editor payout</th><th className="r">Pool %</th><th className="r">Other exp.</th><th className="r">Refunds</th><th className="r">Net operating (cash)</th></tr></thead><tbody>
          ${M.clientsFin.map((c) => html`<tr key=${c.client.id}><td><button className="lnk" onClick=${() => open('client', c.client.id)}>${c.client.name}</button></td><td className="r num">${has(c.client.contractValue) ? F.inr(c.client.contractValue) : html`<span className="nc">Not configured</span>`}</td><td className="r num">${has(c.client.pricePerVideo) ? F.inr(c.client.pricePerVideo) : html`<span className="nc">Not configured</span>`}</td><td className="r num">${c.deliveredCount}</td><td className="r num">${F.inr(c.earned)}</td><td className="r num">${F.inr(c.invoiced)}</td><td className="r num">${F.inr(c.advances)}</td><td className="r num">${F.inr(c.received)}</td><td className=${'r num ' + (c.balance > 0 ? 'risk' : '')}>${F.inr(c.balance)}</td><td className="r num">${F.inr(c.payout)}<div className="xs muted">ref. ${F.inr(c.refPayout)}</div></td><td className="r num">${c.client.editorPoolPct ?? '—'}%</td><td className="r num">${F.inr(c.other)}</td><td className="r num">${F.inr(c.refunds)}</td><td className="r num"><b>${F.inr(c.contribution)}</b></td></tr>`)}
        </tbody></table></div>
        ${M.unbilledPayments.length > 0 && html`<p className="sm pad">Payments not linked to a client: ${F.inr(sum(M.unbilledPayments, (p) => p.amount))}</p>`}<//>`}
      ${tab === 'flow' && html`<${Card} title="Cash flow by month" sub="Cash in: client payments + product net. Cash out: expenses + ad spend.">
        <${CC.BarChart} data=${flow.map((f) => ({ label: D.parse(f.m + '-01').toLocaleDateString('en-IN', { month: 'short' }), values: [f.inn, f.out] }))} series=${[{ name: 'Cash in' }, { name: 'Cash out', color: 'var(--c3)' }]} fmt=${(v) => '₹' + (v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : Math.round(v))} empty="No money movements recorded" />
        <div className="tbl-w"><table className="tbl"><thead><tr><th>Month</th><th className="r">Cash in</th><th className="r">Cash out</th><th className="r">Net</th></tr></thead><tbody>${flow.map((f) => html`<tr key=${f.m}><td>${D.monthName(f.m)}</td><td className="r num">${F.inr(f.inn)}</td><td className="r num">${F.inr(f.out)}</td><td className=${'r num ' + (f.net < 0 ? 'risk' : '')}>${F.inr(f.net)}</td></tr>`)}<tr><td><b>All time</b></td><td className="r num"><b>${F.inr(cashIn)}</b></td><td className="r num"><b>${F.inr(cashOut)}</b></td><td className="r num"><b>${F.inr(cashIn - cashOut)}</b></td></tr></tbody></table></div><//>`}
      ${tab === 'invoices' && html`<${Card} actions=${html`<${Btn} small icon="plus" onClick=${() => open('invoice')}>Invoice<//>`}>${fin.invoices.length ? html`<div className="tbl-w"><table className="tbl"><thead><tr><th>Number</th><th>Client</th><th>Description</th><th>Issued</th><th>Due</th><th className="r">Amount</th><th className="r">Paid</th><th className="r">Outstanding</th></tr></thead><tbody>
        ${fin.invoices.map((i) => { const paid = sum(fin.payments.filter((p) => p.invoiceId === i.id), (p) => p.amount); const out = n(i.amount) - paid; return html`<tr key=${i.id} className=${out > 0 && i.dueDate && i.dueDate < M.t ? 'row-crit' : ''}><td><button className="lnk" onClick=${() => open('invoice', i.id)}>${i.number}</button>${i.demo ? html` <${Pill} tone="warn">DEMO<//>` : ''}</td><td>${M.clientById[i.clientId]?.name || '—'}</td><td className="sm">${i.description}</td><td className="num">${D.fmt(i.issueDate)}</td><td className="num">${D.fmt(i.dueDate)}</td><td className="r num">${F.inr(i.amount)}</td><td className="r num">${F.inr(paid)}</td><td className=${'r num ' + (out > 0 ? 'risk' : '')}>${F.inr(out)}</td></tr>`; })}</tbody></table></div>` : html`<${Empty} icon="wallet" title="No invoices" text="Record invoices you have actually issued." />`}<//>`}
      ${tab === 'payments' && html`<${Card} actions=${html`<${Btn} small icon="plus" onClick=${() => open('payment')}>Payment<//>`}>${fin.payments.length ? html`<div className="tbl-w"><table className="tbl"><thead><tr><th>Date</th><th>Source</th><th>Client</th><th>Type</th><th>Invoice</th><th>Reference</th><th className="r">Amount</th></tr></thead><tbody>
        ${fin.payments.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((p) => html`<tr key=${p.id}><td><button className="lnk" onClick=${() => open('payment', p.id)}>${D.fmt(p.date)}</button>${p.demo ? html` <${Pill} tone="warn">DEMO<//>` : ''}</td><td>${p.source}</td><td>${M.clientById[p.clientId]?.name || '—'}</td><td>${p.kind}</td><td>${fin.invoices.find((i) => i.id === p.invoiceId)?.number || '—'}</td><td className="mono xs">${p.reference || ''}</td><td className="r num">${F.inr(p.amount)}</td></tr>`)}</tbody></table></div>` : html`<${Empty} icon="wallet" title="No payments recorded" text="Only record money that has reached your account." />`}<//>`}
      ${tab === 'expenses' && html`<${Card} actions=${html`<${Btn} small icon="plus" onClick=${() => open('expense')}>Expense<//>`}>${fin.expenses.length ? html`<div className="tbl-w"><table className="tbl"><thead><tr><th>Date</th><th>Category</th><th>Client</th><th>Note</th><th>Sprint budget</th><th className="r">Amount</th></tr></thead><tbody>
        ${fin.expenses.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((e) => html`<tr key=${e.id}><td><button className="lnk" onClick=${() => open('expense', e.id)}>${D.fmt(e.date)}</button>${e.demo ? html` <${Pill} tone="warn">DEMO<//>` : ''}</td><td>${e.category}</td><td>${M.clientById[e.clientId]?.name || 'Company'}</td><td className="sm">${e.note}</td><td>${e.sprintBudget ? 'Yes' : ''}</td><td className="r num">${F.inr(e.amount)}</td></tr>`)}</tbody></table></div>` : html`<${Empty} icon="wallet" title="No expenses recorded" text="Editor payouts, software, outsourcing and refunds go here. Ad spend is tracked in Meta Ads." />`}<//>`}
      ${tab === 'budget' && html`<div className="grid-2">
        <${Card} title="Sprint budget" sub="Spending limit — not a profit figure"><div className="kv"><span>Cap</span><b className="num">${F.inr(s.settings.sprintBudget)}</b><span>Ad spend in sprint dates</span><b className="num">${F.inr(sum(s.ads.entries.filter((e) => e.date >= s.settings.sprintStart && e.date <= s.settings.sprintEnd), (e) => n(e.spend) + n(e.taxes)))}</b><span>Expenses flagged sprint</span><b className="num">${F.inr(sum(fin.expenses.filter((e) => e.sprintBudget), (e) => e.amount))}</b><span>Remaining</span><b className="num">${F.inr(s.settings.sprintBudget - M.sprintSpend)}</b></div><${Progress} value=${M.sprintSpend / s.settings.sprintBudget} tone=${M.sprintSpend > s.settings.sprintBudget ? 'crit' : 'accent'} label="Sprint budget used" /><//>
        <${Card} title="Profitability (estimate)" sub=${D.monthName(M.month)}><div className="kv"><span>Invoiced (agency)</span><b className="num">${F.inr(M.invoicedMonth)}</b><span>+ Product net</span><b className="num">${F.inr(M.productGrossMonth - M.productRefundMonth)}</b><span>− Expenses</span><b className="num">${F.inr(M.expensesMonth)}</b><span>− Ad spend</span><b className="num">${F.inr(M.adSpendMonth)}</b><span>= Operating result</span><b className="num">${F.inr(M.operatingEstimate)}</b></div><p className="xs muted pad">Unpaid invoices are included here but not in cash. Editor payouts not yet recorded are not subtracted, so this overstates profit until payouts are logged.</p><//></div>`}
    </div>`;
  }

  /* ---------- Personal ---------- */
  function RoutineChecklist({ date }) {
    const { s, up } = CC.useApp(); const log = s.personal.log[date] || {};
    return html`<div className="stack-s">${s.personal.routines.map((r) => html`<label key=${r.id} className="chk"><input type="checkbox" checked=${!!log[r.id]} onChange=${() => up((d) => { d.personal.log[date] = { ...(d.personal.log[date] || {}), [r.id]: !log[r.id] }; })} /><span>${r.label} · ${r.mins} min</span></label>`)}</div>`;
  }
  CC.RoutineChecklist = RoutineChecklist;
  function Personal() {
    const { s, M, up } = CC.useApp(); const P = M.personal;
    const days = D.range(D.add(M.t, -13), M.t);
    const setSp = (id, k, v) => up((d) => { d.personal.speech.find((x) => x.id === id)[k] = v; });
    const totalMins = sum(s.personal.routines, (r) => r.mins);
    return html`<div className="page">
      <div className="page-h"><div><p className="eyebrow">Personal growth</p><h1>Founder practice</h1><p className="muted">${totalMins} minutes a day. Consistency matters more than intensity; rest days do not break anything important.</p></div></div>
      <div className="stats stats-s">
        <${Stat} label="Today" value=${F.pct(P.todayPct, 0)} tag="actual" sub="Routines ticked" />
        <${Stat} label="Streak" value=${P.streak + ' day' + (P.streak === 1 ? '' : 's')} tag="calc" sub="Days with ≥75% of routines" />
        <${Stat} label="Last 7 days" value=${F.pct(P.routinePct7, 0)} tag="calc" sub="Routine completion" />
        <${Stat} label="Discipline score" value=${P.discipline == null ? 'No data' : P.discipline + ' / 100'} empty=${P.discipline == null} tag="calc" sub=${'Founder tasks on time ' + P.founderDone + '/' + P.founderDue + ' · speech ' + s.personal.speech.filter((x) => x.date <= M.t && x.date >= D.add(M.t, -6) && x.done === true).length + '/' + P.speechDue} />
      </div>
      <div className="grid-side">
        <${Card} title="Today’s routine" sub=${D.long(M.t)}><${RoutineChecklist} date=${M.t} />
          <p className="xs muted pad">This tracker does not reward late nights. If a day is overloaded, protect sleep and pick the routine up tomorrow.</p><//>
        <${Card} title="Routines" sub="Edit labels and minutes">${s.personal.routines.map((r, i) => html`<div key=${r.id} className="row gap-s pad-s"><input className="inp" aria-label="Routine" value=${r.label} onChange=${(e) => up((d) => { d.personal.routines[i].label = e.target.value; })} /><input className="inp num w60" type="number" aria-label="Minutes" value=${r.mins} onChange=${(e) => up((d) => { d.personal.routines[i].mins = +e.target.value || 0; })} /></div>`)}<//>
      </div>
      <${Card} title="Practice consistency · last 14 days">
        <div className="tbl-w"><table className="tbl heat"><thead><tr><th>Routine</th>${days.map((d) => html`<th key=${d} className="c">${D.dow(d).slice(0, 2)}<br />${D.parse(d).getDate()}</th>`)}</tr></thead><tbody>
          ${s.personal.routines.map((r) => html`<tr key=${r.id}><td className="sm">${r.label}</td>${days.map((d) => { const on = !!(s.personal.log[d] || {})[r.id]; return html`<td key=${d} className="c"><button className=${'hc' + (on ? ' on' : '')} aria-label=${r.label + ' ' + d + (on ? ' done' : ' not done')} onClick=${() => up((x) => { x.personal.log[d] = { ...(x.personal.log[d] || {}), [r.id]: !on }; })}></button></td>`; })}</tr>`)}
        </tbody></table></div><//>
      <${Card} title="Speech challenges · Nov 7–15" sub="Record yourself, rate honestly, write one specific improvement">
        <div className="tbl-w"><table className="tbl"><thead><tr><th>Date</th><th>Challenge</th><th>Result</th><th>Minutes</th><th>Clarity 1–5</th><th>Confidence 1–5</th><th>Recording link</th><th>Specific improvement</th><th>Next practice</th></tr></thead><tbody>
          ${s.personal.speech.map((x) => html`<tr key=${x.id} className=${x.date === M.t ? 'row-today' : ''}><td className="num">${D.fmt(x.date)}</td><td><strong>${x.topic}</strong></td>
            <td><${Sel} ariaLabel="Result" value=${x.done === true ? 'done' : x.done === false ? 'missed' : ''} options=${[['', '—'], ['done', 'Completed'], ['missed', 'Missed']]} onChange=${(v) => setSp(x.id, 'done', v === 'done' ? true : v === 'missed' ? false : null)} /></td>
            <td><input className="inp num w60" type="number" min="0" aria-label="Minutes" value=${x.mins ?? ''} onChange=${(e) => setSp(x.id, 'mins', e.target.value === '' ? null : +e.target.value)} /></td>
            <td><input className="inp num w60" type="number" min="1" max="5" aria-label="Clarity" value=${x.clarity ?? ''} onChange=${(e) => setSp(x.id, 'clarity', e.target.value === '' ? null : +e.target.value)} /></td>
            <td><input className="inp num w60" type="number" min="1" max="5" aria-label="Confidence" value=${x.confidence ?? ''} onChange=${(e) => setSp(x.id, 'confidence', e.target.value === '' ? null : +e.target.value)} /></td>
            <td><input className="inp" type="url" aria-label="Recording link" placeholder="https://" value=${x.link} onChange=${(e) => setSp(x.id, 'link', e.target.value)} /></td>
            <td><input className="inp" aria-label="Improvement" value=${x.improvement} onChange=${(e) => setSp(x.id, 'improvement', e.target.value)} /></td>
            <td><input className="inp" aria-label="Next practice" value=${x.next} onChange=${(e) => setSp(x.id, 'next', e.target.value)} /></td></tr>`)}
        </tbody></table></div><//>
    </div>`;
  }

  /* ---------- Meetings ---------- */
  function Meetings() {
    const { s, M, open } = CC.useApp();
    const [date, setDate] = useState(M.t);
    const reps = s.meetings.standups.filter((x) => x.date === date);
    const missing = s.team.filter((m) => m.active !== false && !reps.some((r) => r.memberId === m.id));
    return html`<div className="page">
      <div className="page-h"><div><p className="eyebrow">Meetings & reviews</p><h1>Operating rhythm</h1><p className="muted">Daily five-question reports, weekly meeting notes and a decision log you can review later.</p></div>
        <div className="row gap-s wrap"><${Btn} icon="plus" onClick=${() => open('decision')}>Decision<//><${Btn} icon="plus" onClick=${() => open('meeting')}>Meeting log<//><${Btn} kind="primary" icon="plus" onClick=${() => open('standup', null, { date })}>Daily report<//></div></div>
      <${Card} title="Daily reports" actions=${html`<input type="date" className="inp" aria-label="Report date" value=${date} onChange=${(e) => setDate(e.target.value)} />`} sub=${reps.length + ' submitted' + (missing.length ? ' · missing: ' + missing.map((m) => m.name).join(', ') : '')}>
        ${reps.length ? html`<div className="grid-2">${reps.map((r) => html`<button key=${r.id} className="report" onClick=${() => open('standup', r.id)}><strong>${s.team.find((m) => m.id === r.memberId)?.name || 'Unknown'}</strong>
          ${[['Completed yesterday', r.yesterday], ['Today', r.today], ['Blocked', r.blocked], ['Deadline at risk', r.risk], ['Support needed', r.support]].map(([k, v]) => html`<div key=${k}><span className="xs muted">${k}</span><p className=${'sm ' + ((k === 'Blocked' || k === 'Deadline at risk') && v && !/^(no|none|nil|-)$/i.test(v.trim()) ? 'risk' : '')}>${v || '—'}</p></div>`)}</button>`)}</div>` : html`<${Empty} icon="meetings" title="No reports for this date" action=${html`<${Btn} small kind="primary" onClick=${() => open('standup', null, { date })}>Add report<//>`} />`}<//>
      <div className="grid-2">
        <${Card} title="Meeting log">${s.meetings.logs.length ? s.meetings.logs.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((m) => html`<button key=${m.id} className="line line-main" onClick=${() => open('meeting', m.id)}><span className="line-t">${m.type} · ${D.long(m.date)}</span><span className="sm muted">${m.attendees}</span>${m.actions && html`<span className="sm">Actions: ${m.actions}</span>`}</button>`) : html`<p className="muted pad">No meetings logged.</p>`}<//>
        <${Card} title="Decisions" sub=${s.meetings.decisions.filter((d) => d.status === 'Open').length + ' open'}>${s.meetings.decisions.length ? s.meetings.decisions.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((d) => html`<div key=${d.id} className="line"><button className="line-main" onClick=${() => open('decision', d.id)}><span className="line-t">${d.decision}</span><span className="sm muted">${D.fmt(d.date)} · ${CC.ownerName(s, d.owner)}${d.review ? ' · review ' + D.fmt(d.review) : ''}</span></button><div className="line-a"><${Pill} tone=${d.status === 'Done' ? 'ok' : d.status === 'Reversed' ? 'muted' : 'info'}>${d.status}<//></div></div>`) : html`<p className="muted pad">No decisions logged.</p>`}<//>
      </div></div>`;
  }

  /* ---------- Reports & Settings ---------- */
  function Reports({ sub }) {
    const app = CC.useApp(); const { s, M, up, confirm, toast, sync, replaceAll } = app;
    const [tab, setTab] = useState(sub || 'charts');
    const [fc, setFc] = useState(''); const [fo, setFo] = useState(''); const [fs, setFs] = useState('');
    const [from, setFrom] = useState(D.add(M.t, -13)); const [to, setTo] = useState(D.add(M.t, 7 > 0 ? 0 : 0));
    const dl = M.dels.filter((d) => (!fc || d.clientId === fc) && (!fo || d.assigneeId === fo) && (!fs || d.status === fs));
    const days = D.range(from, to < from ? from : to).slice(0, 120);
    const planned = (d) => sum(s.clients.filter((c) => (!fc || c.id === fc) && c.cadence === 'daily'), (c) => (CC.nonWorking(c).includes(d) ? 0 : n(c.minPerPeriod)));
    const deliv = days.map((d) => ({ label: D.fmt(d), values: [dl.filter((x) => x.done && x.completedDate === d).length, planned(d)] }));
    const doneDels = dl.filter((d) => d.done); const lateN = doneDels.filter((d) => d.late).length;
    const leadsF = M.leads.filter((l) => !fo || l.owner === fo);
    const tasksF = M.tasks.filter((x) => (!fo || x.owner === fo) && (!fs || x.status === fs));
    const json = () => JSON.stringify(s, null, 1);
    const [importText, setImportText] = useState(''); const fileRef = useRef(null);
    const doImport = async (text) => {
      let data; try { data = JSON.parse(text); } catch (e) { toast('That file is not valid JSON', 'err'); return; }
      if (!data || !data.meta || !Array.isArray(data.deliverables) || !Array.isArray(data.tasks)) { toast('This does not look like a Founder OS backup', 'err'); return; }
      if (!(await confirm({ title: 'Replace all current data?', text: 'The backup replaces everything in this workspace. Export the current data first if you may need it.', ok: 'Replace', danger: true }))) return;
      replaceAll(data); setImportText(''); toast('Backup imported');
    };
    const exportFile = async () => {
      const name = 'creative-cut-founder-os-' + M.t + '.json';
      try { const dlc = await window.claude?.use?.('downloads'); if (dlc) { await dlc.save({ filename: name, data: json() }); toast('Backup offered as ' + name); return; } } catch (e) { /* fall through */ }
      toast('File download is not available here. Use Copy JSON instead.', 'err');
    };
    const copy = async () => { try { await navigator.clipboard.writeText(json()); toast('Backup JSON copied'); } catch (e) { const ta = document.getElementById('export-ta'); ta && ta.select(); toast('Select the text below and copy it', 'err'); } };
    const demoCount = s.deliverables.filter((x) => x.demo).length + s.leads.filter((x) => x.demo).length + s.finance.payments.filter((x) => x.demo).length + s.finance.invoices.filter((x) => x.demo).length + s.finance.expenses.filter((x) => x.demo).length + s.ads.entries.filter((x) => x.demo).length + s.product.daily.filter((x) => x.demo).length;
    const addDemo = async () => {
      if (!(await confirm({ title: 'Add DEMO records?', text: 'Adds clearly labelled sample records so you can see how screens behave. They affect totals until you remove them.', ok: 'Add demo records' }))) return;
      up((d) => { const id = () => { d.counters.deliverable = n(d.counters.deliverable) + 1; return 'CC-' + String(d.counters.deliverable).padStart(4, '0'); };
        const base = { demo: true, priority: 'Medium', complexity: 'standard', assetsReceived: true, scriptStatus: 'Ready', editingProgress: 0, revisionCount: 0, paymentStatus: 'Not billed', qc: {} };
        [['DEMO reel: hook test', 'c_mehak', 'Editing', 0, 60], ['DEMO reel: tips carousel', 'c_mehak', 'Internal QC', 1, 90], ['DEMO brand video', 'c_maya', 'Client Review', 3, 100], ['DEMO late edit', 'c_mehak', 'Backlog', -1, 0]].forEach(([t, c, st, off, pr]) => d.deliverables.push({ ...base, id: id(), title: t, clientId: c, status: st, dueDate: D.add(M.t, off), originalDueDate: D.add(M.t, off), startDate: M.t, editingProgress: pr, assigneeId: off === -1 ? '' : 'm_hemant' }));
        d.leads.push({ id: CC.uid('lea'), demo: true, name: 'DEMO Prospect', business: 'Demo Studio', pipeline: 'agency', stage: 'replied', value: 4000, probability: 40, followUp: D.add(M.t, -1), owner: 'm_hemant', history: [] });
        d.finance.invoices.push({ id: 'inv_demo', demo: true, number: 'DEMO-001', clientId: 'c_maya', amount: 5000, issueDate: M.t, dueDate: D.add(M.t, 7) });
        d.finance.payments.push({ id: CC.uid('pay'), demo: true, date: M.t, amount: 2000, source: 'Client', clientId: 'c_maya', invoiceId: 'inv_demo', kind: 'Advance' });
      });
      toast('Demo records added');
    };
    const removeDemo = async () => {
      if (!(await confirm({ title: 'Remove all DEMO records?', text: demoCount + ' demo records will be deleted. Your real records are untouched.', ok: 'Remove demo records', danger: true }))) return;
      up((d) => { d.deliverables = d.deliverables.filter((x) => !x.demo); d.leads = d.leads.filter((x) => !x.demo); ['payments', 'invoices', 'expenses'].forEach((k) => (d.finance[k] = d.finance[k].filter((x) => !x.demo))); d.ads.entries = d.ads.entries.filter((x) => !x.demo); d.product.daily = d.product.daily.filter((x) => !x.demo); });
      toast('Demo records removed');
    };
    const reset = async () => { if (await confirm({ title: 'Reset everything?', text: 'All records are erased and the starting configuration is restored. This cannot be undone. Export a backup first.', ok: 'Erase and reset', danger: true })) { replaceAll(CC.seed()); toast('Workspace reset'); } };
    const sprintDaysRows = M.sprint.days;
    const weekStart = D.week(M.t), weekEnd = D.add(weekStart, 6);
    const inR = (x, a, b) => x && x >= a && x <= b;
    const summary = (a, b) => [
      ['Videos delivered', M.dels.filter((d) => d.done && inR(d.completedDate, a, b)).length], ['Delivered late', M.dels.filter((d) => d.done && d.late && inR(d.completedDate, a, b)).length],
      ['Deliverables still open with due date in range', M.openDels.filter((d) => inR(d.dueDate, a, b)).length],
      ['Tasks completed', M.tasks.filter((x) => x.done && inR(x.completedDate, a, b)).length], ['Tasks due and not done', M.tasks.filter((x) => !x.done && inR(x.dueDate, a, b)).length],
      ['Client cash received', F.inr(sum(s.finance.payments.filter((p) => p.source !== 'Product' && inR(p.date, a, b)), (p) => p.amount))],
      ['Product gross', F.inr(sum(s.product.daily.filter((d) => inR(d.date, a, b)), (d) => d.gross))], ['Product purchases', sum(s.product.daily.filter((d) => inR(d.date, a, b)), (d) => d.purchases)],
      ['Ad spend incl. tax', F.inr(sum(s.ads.entries.filter((e) => inR(e.date, a, b)), (e) => n(e.spend) + n(e.taxes)))],
      ['Outreach sent', M.leads.filter((l) => inR(l.outreachDate, a, b)).length], ['Replies', M.leads.filter((l) => (l.history || []).some((h) => h.stage === 'replied' && inR(h.date, a, b))).length],
      ['Deals won', M.leads.filter((l) => (l.history || []).some((h) => M.leads && s.crm.stages.find((x) => x.id === h.stage)?.type === 'won' && inR(h.date, a, b))).length],
      ['Routine completion', F.pct(D.range(a, b < M.t ? b : M.t).reduce((acc, d) => acc + M.personal.dayPct(d), 0) / Math.max(1, D.range(a, b < M.t ? b : M.t).length), 0)],
      ['Speech challenges completed', s.personal.speech.filter((x) => x.done === true && inR(x.date, a, b)).length],
    ];
    return html`<div className="page">
      <div className="page-h"><div><p className="eyebrow">Reports & settings</p><h1>Analytics</h1><p className="muted">Charts read the same records as every other screen.</p></div></div>
      <${Tabs} value=${tab} onChange=${setTab} tabs=${[['charts', 'Charts'], ['summary', 'Daily · weekly · sprint'], ['warnings', 'Warnings · ' + M.warnings.length], ['data', 'Data & backup']]} />
      ${tab === 'charts' && html`<div className="filters">
        <${Sel} ariaLabel="Client" value=${fc} onChange=${setFc} options=${[['', 'All clients'], ...s.clients.map((c) => [c.id, c.name])]} />
        <${Sel} ariaLabel="Owner" value=${fo} onChange=${setFo} options=${[['', 'All owners'], ...s.team.map((m) => [m.id, m.name])]} />
        <${Sel} ariaLabel="Status" value=${fs} onChange=${setFs} options=${[['', 'All statuses'], ...CC.ALL_STATUSES, ...CC.TASK_STATUS.filter((x) => x !== 'Blocked')]} />
        <input type="date" className="inp" aria-label="From" value=${from} onChange=${(e) => setFrom(e.target.value)} /><input type="date" className="inp" aria-label="To" value=${to} onChange=${(e) => setTo(e.target.value)} />
        <${Btn} small kind="ghost" onClick=${() => { setFrom(s.settings.sprintStart); setTo(s.settings.sprintEnd); }}>Sprint<//></div>
      <div className="grid-2">
        <${Card} title="Client delivery over time" sub="Delivered vs planned minimum (daily-cadence clients)"><${CC.BarChart} data=${deliv} series=${[{ name: 'Delivered' }, { name: 'Planned minimum', color: 'var(--c4)' }]} empty="No deliveries or daily targets in this range" /><//>
        <${Card} title="Planned vs delivered by client" sub="Deliverables due in range vs delivered in range"><${CC.BarChart} data=${s.clients.filter((c) => !fc || c.id === fc).map((c) => ({ label: c.name, values: [dl.filter((d) => d.clientId === c.id && inR(d.dueDate, from, to)).length, dl.filter((d) => d.clientId === c.id && d.done && inR(d.completedDate, from, to)).length] }))} series=${[{ name: 'Planned (due)' }, { name: 'Delivered', color: 'var(--c2)' }]} /><//>
        <${Card} title="Team workload" sub="Remaining hours next 7 days vs capacity"><${CC.HBars} rows=${M.team.filter((m) => !fo || m.id === fo).map((m) => ({ label: m.name + ' (' + m.capacity + ' h)', value: +m.loadHours.toFixed(1), tone: m.over ? 'crit' : 'accent' }))} fmt=${(v) => v + ' h'} /><//>
        <${Card} title="Late delivery" sub="Delivered after the original due date"><div className="big num">${F.pct(div(lateN, doneDels.length), 0)}</div><p className="muted sm">${lateN} of ${doneDels.length} delivered videos were late.</p><//>
        <${Card} title="Revenue by client" sub="Cash received (actual) and invoiced"><${CC.BarChart} data=${M.clientsFin.filter((c) => !fc || c.client.id === fc).map((c) => ({ label: c.client.name, values: [c.received, c.invoiced] }))} series=${[{ name: 'Received' }, { name: 'Invoiced', color: 'var(--c2)' }]} fmt=${(v) => '₹' + Math.round(v)} empty="No invoices or payments yet" /><//>
        <${Card} title="Cash collected vs outstanding"><${CC.HBars} rows=${[{ label: 'Collected', value: sum(M.clientsFin, (c) => c.received) }, { label: 'Outstanding', value: M.pending, tone: 'warn' }]} fmt=${F.inr} empty="No invoices or payments yet" /><//>
        <${Card} title="Ads spend over time"><${CC.BarChart} data=${[...new Set(s.ads.entries.map((e) => e.date))].sort().map((d) => ({ label: D.fmt(d), values: [sum(s.ads.entries.filter((e) => e.date === d), (e) => n(e.spend) + n(e.taxes))] }))} series=${[{ name: 'Spend' }]} fmt=${(v) => '₹' + Math.round(v)} empty="No ad spend entered" /><//>
        <${Card} title="Funnel conversion · Creative Captions"><${CC.Funnel} stages=${[['Visits', M.prod.visits], ['Engaged', M.prod.engaged], ['Trials', M.prod.trials], ['Activated', M.prod.activations], ['Checkout', M.prod.checkouts], ['Paid', M.prod.purchases]].map(([label, value]) => ({ label, value }))} /><//>
        <${Card} title="Leads by stage"><${CC.HBars} rows=${s.crm.stages.map((st) => ({ label: st.label, value: leadsF.filter((l) => l.stage === st.id).length, tone: st.type === 'won' ? 'ok' : st.type === 'lost' ? 'muted' : 'accent' }))} empty="No leads yet" /><//>
        <${Card} title="Sprint completion by day"><${CC.BarChart} stacked data=${sprintDaysRows.map((d) => ({ label: 'D' + d.day, values: [d.done, d.total - d.done] }))} series=${[{ name: 'Done' }, { name: 'Open', color: 'var(--c4)' }]} /><//>
        <${Card} title="Personal practice consistency" sub="Share of routines done per day"><${CC.LineChart} data=${days.filter((d) => d <= M.t).map((d) => ({ label: D.fmt(d), values: [Math.round(M.personal.dayPct(d) * 100)] }))} series=${[{ name: 'Routine %' }]} fmt=${(v) => Math.round(v) + '%'} empty="No routine logs in this range" /><//>
        <${Card} title="Tasks by status" sub="Filtered by owner and status"><${CC.HBars} rows=${CC.TASK_STATUS.map((st) => ({ label: st, value: tasksF.filter((x) => x.status === st).length, tone: st === 'Done' ? 'ok' : st === 'Blocked' ? 'crit' : 'accent' }))} /><//>
      </div>`}
      ${tab === 'summary' && html`<div className="grid-3">${[['Today', M.t, M.t], ['This week', weekStart, weekEnd], ['Sprint · Nov 7–15', s.settings.sprintStart, s.settings.sprintEnd]].map(([t, a, b]) => html`<${Card} key=${t} title=${t} sub=${D.fmt(a) + (a !== b ? ' – ' + D.fmt(b) : '')}><div className="kv">${summary(a, b).map(([k, v], i) => html`<span key=${'k' + i}>${k}</span><b key=${'v' + i} className="num">${v}</b>`)}</div><//>`)}</div>`}
      ${tab === 'warnings' && html`<${Card} title="All calculated warnings">${M.warnings.length ? M.warnings.map((w, i) => html`<button key=${i} className=${'warn warn-' + w.level} onClick=${() => app.go(w.to)}><${Icon} name="alert" size=${14} /><span>${w.text}</span><${Icon} name="right" size=${14} /></button>`) : html`<p className="muted pad">No warnings. Nothing overdue, unassigned, over capacity or outstanding.</p>`}<//>`}
      ${tab === 'data' && html`<div className="grid-2">
        <${Card} title="Where your data lives">
          <div className="kv"><span>Storage</span><b>${sync.label}</b><span>Last change</span><b>${D.ago(s.meta.updatedAt)}</b><span>Last cloud save</span><b>${sync.savedAt ? D.ago(sync.savedAt) : '—'}</b></div>
          <ul className="ulist sm"><li>When this page is opened in Claude while you are signed in, a copy is saved privately to your Claude account so it is there on your other devices. Only you can read it.</li><li>A copy is also kept in this browser. Clearing site data, private windows or another browser start without it.</li><li>There is no multi-user sync. Team members who open this page get their own empty workspace, not yours. Share updates through exports or by entering their reports yourself.</li><li>Nothing is connected to Meta, Gmail, Google Sheets or payment tools. All numbers are typed in.</li><li>Export a JSON backup at least once a week.</li></ul><//>
        <${Card} title="Backup">
          <div className="row gap-s wrap"><${Btn} kind="primary" icon="download" onClick=${exportFile}>Download JSON<//><${Btn} icon="copy" onClick=${copy}>Copy JSON<//></div>
          <textarea id="export-ta" className="inp mono xs pad" rows="5" readOnly value=${json()} aria-label="Backup JSON"></textarea>
          <p className="eyebrow pad">Import a backup</p>
          <input ref=${fileRef} type="file" accept="application/json,.json" className="inp" aria-label="Backup file" onChange=${(e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => doImport(String(r.result)); r.readAsText(f); e.target.value = ''; }} />
          <textarea className="inp mono xs pad" rows="3" placeholder="…or paste backup JSON here" value=${importText} onChange=${(e) => setImportText(e.target.value)} aria-label="Paste backup JSON"></textarea>
          <${Btn} small icon="upload" disabled=${!importText.trim()} onClick=${() => doImport(importText)}>Import pasted JSON<//><//>
        <${Card} title="Demo records" sub=${demoCount + ' DEMO records present'}>
          <p className="sm">Demo records are labelled DEMO everywhere and are counted in totals while present. Remove them before real use.</p>
          <div className="row gap-s wrap pad"><${Btn} onClick=${addDemo}>Add demo records<//><${Btn} kind="danger" disabled=${!demoCount} onClick=${removeDemo}>Remove all demo records<//></div><//>
        <${Card} title="Settings">
          <div className="form">
            <div className="fld"><label htmlFor="set-b">Sprint budget (₹)</label><input id="set-b" className="inp num" type="number" value=${s.settings.sprintBudget} onChange=${(e) => up((d) => { d.settings.sprintBudget = +e.target.value || 0; })} /></div>
            <div className="fld"><label htmlFor="set-o">Qualified prospect target</label><input id="set-o" className="inp num" type="number" value=${s.settings.outreachTarget} onChange=${(e) => up((d) => { d.settings.outreachTarget = +e.target.value || 0; })} /></div>
          </div>
          <${Btn} kind="danger" icon="trash" onClick=${reset}>Erase all data and reset<//><//>
      </div>`}
    </div>`;
  }

  Object.assign(CC, { CRM, Finance, Personal, Meetings, Reports });
})();
