/* Creative Cut Founder OS — Dashboard, Mind Map, Client Production */
(function () {
  const CC = window.CC;
  const { D, F, n, has, sum, html, Icon, Btn, Card, Stat, Pill, StatusPill, Progress, Empty, Tabs, Sel, Ext, Tag } = CC;
  const { useState, useMemo, useRef, useEffect } = React;

  /* ---------- shared actions ---------- */
  CC.actions = function (app) {
    const { up, confirm, toast, M } = app;
    return {
      async setDelStatus(id, status, reason) {
        const d = app.s.deliverables.find((x) => x.id === id); if (!d || d.status === status) return;
        if (status === 'Delivered' && d.status !== 'Approved') {
          const ok = await confirm({ title: 'Mark ' + id + ' as delivered?', text: 'It is not marked Approved. Editing being finished does not mean the client received it. Continue only if the final file was delivered.', ok: 'Yes, delivered' });
          if (!ok) return;
        }
        up((s) => { const x = s.deliverables.find((y) => y.id === id); x.status = status;
          if (status === 'Delivered') x.completedDate = x.completedDate || M.t; else x.completedDate = null;
          if (status === 'Revision Required') x.revisionCount = n(x.revisionCount) + 1;
          if (status === 'Blocked' && reason !== undefined) x.blockedReason = reason; });
        toast(id + ' → ' + status + (status === 'Revision Required' ? ' (revision count +1)' : ''));
      },
      toggleTask(id) {
        up((s) => { const x = s.tasks.find((y) => y.id === id); const done = x.status === 'Done'; x.status = done ? 'To do' : 'Done'; x.completedDate = done ? null : M.t; });
      },
      carryTask(id) {
        up((s) => { const x = s.tasks.find((y) => y.id === id); if (!x.originalDueDate) x.originalDueDate = x.dueDate; x.dueDate = D.add(M.t, 1); x.carryCount = n(x.carryCount) + 1; });
        toast('Carried to tomorrow · original due date kept');
      },
      carryDel(id) {
        up((s) => { const x = s.deliverables.find((y) => y.id === id); if (!x.originalDueDate) x.originalDueDate = x.dueDate; x.dueDate = D.add(M.t, 1); x.carryCount = n(x.carryCount) + 1; });
        toast(id + ' carried to tomorrow · counts as late against original date');
      },
    };
  };

  function DelLine({ d, compact }) {
    const app = CC.useApp(); const A = CC.actions(app);
    const c = app.M.clientById[d.clientId];
    return html`<div className="line">
      <button className="line-main" onClick=${() => app.open('deliverable', d.id)}>
        <span className="mono xs muted">${d.id}</span><span className="line-t">${d.title}</span>
        <span className="muted sm">${c?.name || '—'} · ${CC.ownerName(app.s, d.assigneeId)} · due ${D.fmt(d.dueDate)}${d.originalDueDate && d.originalDueDate !== d.dueDate ? ' (orig. ' + D.fmt(d.originalDueDate) + ')' : ''}</span>
        ${!compact && d.risk.length > 0 && html`<span className="risk">${d.risk.join(' · ')}</span>`}
      </button>
      <div className="line-a">
        ${d.overdue && html`<${Pill} tone="crit">Overdue<//>`}
        <${Sel} value=${d.status} ariaLabel="Status" className="sel-s" options=${CC.ALL_STATUSES} onChange=${(v) => A.setDelStatus(d.id, v)} />
        ${!d.done && (d.overdue || d.dueToday) && html`<${Btn} small kind="ghost" icon="carry" title="Carry forward to tomorrow" onClick=${() => A.carryDel(d.id)} />`}
      </div></div>`;
  }
  function TaskLine({ x, showDay }) {
    const app = CC.useApp(); const A = CC.actions(app);
    return html`<div className=${'line' + (x.done ? ' is-done' : '')}>
      <label className="tick"><input type="checkbox" checked=${x.done} onChange=${() => A.toggleTask(x.id)} aria-label=${'Complete ' + x.title} /></label>
      <button className="line-main" onClick=${() => app.open('task', x.id)}>
        <span className="line-t">${x.title}</span>
        <span className="muted sm">${CC.ownerName(app.s, x.owner)}${showDay && x.sprintDay ? ' · Day ' + x.sprintDay : ''} · ${x.dueDate ? 'due ' + D.fmt(x.dueDate) : 'no date'}${n(x.carryCount) ? ' · carried ' + x.carryCount + '× (orig. ' + D.fmt(x.originalDueDate) + ')' : ''}${has(x.estMins) ? ' · ' + x.estMins + ' min' : ''}</span>
        ${x.status === 'Blocked' && html`<span className="risk">Blocked${x.blocker ? ': ' + x.blocker : ''}</span>`}
      </button>
      <div className="line-a">${x.overdue && html`<${Pill} tone="crit">Overdue<//>`}${x.status === 'In progress' && html`<${Pill} tone="accent">In progress<//>`}
        ${!x.done && (x.overdue || x.dueToday) && html`<${Btn} small kind="ghost" icon="carry" title="Carry forward to tomorrow" onClick=${() => A.carryTask(x.id)} />`}</div></div>`;
  }
  CC.DelLine = DelLine; CC.TaskLine = TaskLine;

  /* ---------- Dashboard ---------- */
  function Dashboard() {
    const app = CC.useApp(); const { s, M, go, open } = app;
    const hour = new Date().getHours();
    const [mode, setMode] = useState(hour >= 17 ? 'evening' : 'morning');
    const [pri, setPri] = useState('today');
    const c = M.counts;
    const inSprint = M.t >= s.settings.sprintStart && M.t <= s.settings.sprintEnd;
    const sprintDay = s.sprintDays.find((d) => d.date === M.t);
    const lists = {
      today: [...M.openDels.filter((d) => d.dueToday).map((d) => ['d', d]), ...M.tasks.filter((x) => x.dueToday).map((x) => ['t', x])],
      overdue: [...M.openDels.filter((d) => d.overdue).map((d) => ['d', d]), ...M.tasks.filter((x) => x.overdue).map((x) => ['t', x])],
      risk: [...M.openDels.filter((d) => d.risk.length && !d.overdue).map((d) => ['d', d]), ...M.tasks.filter((x) => !x.done && x.status === 'Blocked').map((x) => ['t', x])],
      done: [...M.dels.filter((d) => d.done && d.completedDate === M.t).map((d) => ['d', d]), ...M.tasks.filter((x) => x.done && x.completedDate === M.t).map((x) => ['t', x])],
    };
    const personalDone = s.personal.routines.filter((r) => (s.personal.log[M.t] || {})[r.id]).length;
    const adsToday = sum(s.ads.entries.filter((e) => e.date === M.t), (e) => n(e.spend) + n(e.taxes));
    const cashToday = sum(s.finance.payments.filter((p) => p.date === M.t), (p) => p.amount);
    const carry = M.tasks.filter((x) => !x.done && x.dueDate && x.dueDate <= M.t);
    const tomorrow = [...M.openDels.filter((d) => d.dueDate === M.tomorrow).map((d) => d.id + ' · ' + d.title), ...M.tasks.filter((x) => !x.done && x.dueDate === M.tomorrow).sort((a, b) => (CC.PRI_RANK[a.priority] ?? 2) - (CC.PRI_RANK[b.priority] ?? 2)).map((x) => x.title)].slice(0, 3);
    const outstandingInv = s.finance.invoices.map((i) => ({ i, due: n(i.amount) - sum(s.finance.payments.filter((p) => p.invoiceId === i.id), (p) => p.amount) })).filter((x) => x.due > 0).sort((a, b) => ((a.i.dueDate || '9') < (b.i.dueDate || '9') ? -1 : 1));

    return html`<div className="page">
      <div className="page-h">
        <div><p className="eyebrow">${D.long(M.t)}${inSprint ? ' · Sprint day ' + sprintDay.day + ' of 9' : M.t < s.settings.sprintStart ? ' · Sprint starts ' + D.fmt(s.settings.sprintStart) : ''}</p>
          <h1>${mode === 'morning' ? 'Morning brief' : 'Evening review'}</h1>
          ${sprintDay && html`<p className="muted">${sprintDay.theme} — ${sprintDay.focus}</p>`}</div>
        <div className="row gap-s wrap"><${Tabs} small value=${mode} onChange=${setMode} tabs=${[['morning', 'Morning'], ['evening', 'Evening']]} /></div>
      </div>

      ${M.warnings.length > 0 && html`<div className="warns">${M.warnings.slice(0, 5).map((w, i) => html`<button key=${i} className=${'warn warn-' + w.level} onClick=${() => go(w.to)}><${Icon} name="alert" size=${14} /><span>${w.text}</span><${Icon} name="right" size=${14} /></button>`)}
        ${M.warnings.length > 5 && html`<button className="warn warn-more" onClick=${() => go('reports')}>+${M.warnings.length - 5} more warnings</button>`}</div>`}

      ${mode === 'morning' ? html`<div className="brief">
        <${Card} title="1 · Today’s client deliverables" sub=${c.dueToday + ' due today'} actions=${html`<${Btn} small icon="plus" onClick=${() => open('deliverable')}>Deliverable<//>`}>
          ${M.openDels.filter((d) => d.dueToday).length ? M.openDels.filter((d) => d.dueToday).map((d) => html`<${DelLine} key=${d.id} d=${d} />`) : html`<${Empty} icon="film" title="Nothing due today" text=${M.dels.length ? 'No open deliverable has today as its due date.' : 'Add deliverables in Client Production, or create Mehak’s planned daily slots.'} action=${!M.dels.length && html`<${Btn} small onClick=${() => go('production', 'targets')}>Open client targets<//>`} />`}<//>
        <${Card} title="2 · Overdue" sub=${c.overdue + ' deliverables · ' + M.tasks.filter((x) => x.overdue).length + ' tasks'}>
          ${lists.overdue.length ? lists.overdue.slice(0, 6).map(([k, x]) => (k === 'd' ? html`<${DelLine} key=${x.id} d=${x} compact />` : html`<${TaskLine} key=${x.id} x=${x} />`)) : html`<p className="muted pad">Nothing overdue.</p>`}<//>
        <${Card} title="3 · Team capacity" sub="Next 7 days, remaining hours vs available" actions=${html`<${Btn} small kind="ghost" onClick=${() => go('team')}>Team<//>`}>
          ${M.team.map((m) => html`<div className="cap" key=${m.id}><div className="row between"><strong>${m.name}</strong><span className="num sm">${m.loadHours.toFixed(1)} / ${m.capacity} h</span></div><${Progress} value=${m.utilisation} tone=${m.over ? 'crit' : m.utilisation > 0.8 ? 'warn' : 'accent'} label=${m.name + ' capacity'} /></div>`)}
          ${M.openDels.some((d) => !d.assigneeId) && html`<p className="risk pad">${M.openDels.filter((d) => !d.assigneeId).length} open deliverable(s) with no editor</p>`}<//>
        <${Card} title="4 · Three founder actions" sub="Ranked: overdue, due date, sprint priority" actions=${html`<${Btn} small icon="plus" onClick=${() => open('task')}>Task<//>`}>
          ${M.founderTop.length ? M.founderTop.map((x) => html`<${TaskLine} key=${x.id} x=${x} showDay />`) : html`<p className="muted pad">No open founder tasks.</p>`}<//>
        <${Card} title="5 · Sales and product follow-ups" sub=${M.crm.followToday.length + ' today · ' + M.crm.followOverdue.length + ' overdue'} actions=${html`<${Btn} small kind="ghost" onClick=${() => go('crm')}>CRM<//>`}>
          ${[...M.crm.followOverdue, ...M.crm.followToday].slice(0, 6).map((l) => html`<button key=${l.id} className="line line-main" onClick=${() => open('lead', l.id)}><span className="line-t">${l.name}${l.business ? ' · ' + l.business : ''}</span><span className="muted sm">${l.followOverdue ? 'Overdue since ' + D.fmt(l.followUp) : 'Due today'} · ${s.crm.stages.find((x) => x.id === l.stage)?.label}</span></button>`)}
          ${!M.crm.followOverdue.length && !M.crm.followToday.length && html`<p className="muted pad">${M.crm.total ? 'No follow-ups due.' : 'No leads yet. Sprint target: ' + s.settings.outreachTarget + ' qualified prospects.'}</p>`}<//>
        <${Card} title="6 · Available ad budget" actions=${html`<${Btn} small kind="ghost" onClick=${() => go('ads')}>Meta Ads<//>`}>
          <div className="kv"><span>Media budget</span><b className="num">${F.inr(s.ads.budget.media)}</b><span>Spent (incl. tax)</span><b className="num">${F.inr(M.ads.cost)}</b><span>Remaining</span><b className="num">${F.inr(M.ads.remaining)}</b><span>Decision</span><b>${M.ads.decision.key}</b></div>
          <${Progress} value=${M.ads.usedPct} tone=${M.ads.usedPct >= 0.8 ? 'warn' : 'accent'} label="Ad budget used" /><//>
        <${Card} title="7 · Cash collection priorities" sub=${F.inr(M.pending) + ' pending from clients'} actions=${html`<${Btn} small icon="plus" onClick=${() => open('payment')}>Payment<//>`}>
          ${outstandingInv.length ? outstandingInv.slice(0, 5).map(({ i, due }) => html`<button key=${i.id} className="line line-main" onClick=${() => open('invoice', i.id)}><span className="line-t">${i.number} · ${M.clientById[i.clientId]?.name || 'Unlinked'}</span><span className=${'sm ' + (i.dueDate && i.dueDate < M.t ? 'risk' : 'muted')}>${F.inr(due)} outstanding · due ${D.fmt(i.dueDate)}</span></button>`) : html`<p className="muted pad">${s.finance.invoices.length ? 'All invoices are paid.' : 'No invoices recorded yet.'}</p>`}<//>
        <${Card} title="8 · Personal practice" sub=${personalDone + ' of ' + s.personal.routines.length + ' done today'} actions=${html`<${Btn} small kind="ghost" onClick=${() => go('personal')}>Open<//>`}>
          <${CC.RoutineChecklist} date=${M.t} /><//>
      </div>` : html`<div className="brief">
        <${Card} title="Evening review" sub="Everything here is counted from today’s records">
          <div className="eve">
            ${[
              ['1', 'Videos actually delivered', c.deliveredToday, 'production'], ['2', 'Unfinished deliverables due today', M.openDels.filter((d) => d.dueToday).length, 'production'],
              ['3', 'Money actually collected', F.inr(cashToday), 'finance'], ['4', 'Campaign money spent', F.inr(adsToday), 'ads'],
              ['5', 'Outreach sent', M.crm.outreachToday, 'crm'], ['6', 'Replies received', M.crm.repliesToday, 'crm'], ['7', 'Sales won', M.crm.wonToday, 'crm'],
              ['8', 'Personal routine', personalDone + ' / ' + s.personal.routines.length, 'personal'], ['9', 'Tasks carrying forward', carry.length, 'sprint'],
            ].map(([k, l, v, to]) => html`<button key=${k} className="eve-i" onClick=${() => go(to)}><span className="eve-k">${k}</span><span>${l}</span><b className="num">${v}</b></button>`)}
          </div><//>
        <${Card} title="Carry forward" sub="Original due dates are kept; late work stays visible as late">
          ${carry.length ? carry.slice(0, 8).map((x) => html`<${TaskLine} key=${x.id} x=${x} showDay />`) : html`<p className="muted pad">Nothing to carry.</p>`}
          ${M.openDels.filter((d) => d.dueToday || d.overdue).map((d) => html`<${DelLine} key=${d.id} d=${d} compact />`)}<//>
        <${Card} title="10 · Tomorrow’s top priorities" sub=${D.long(M.tomorrow)}>
          ${tomorrow.length ? html`<ol className="olist">${tomorrow.map((t, i) => html`<li key=${i}>${t}</li>`)}</ol>` : html`<p className="muted pad">Nothing scheduled for tomorrow yet.</p>`}<//>
      </div>`}

      <h2 className="sec">Executive overview</h2>
      <div className="stats">
        <${Stat} label="Active clients" value=${c.activeClients} tag="actual" onClick=${() => go('production', 'targets')} />
        <${Stat} label="Active deliverables" value=${c.active} tag="actual" onClick=${() => go('production')} />
        <${Stat} label="Videos due today" value=${c.dueToday} tag="actual" tone=${c.dueToday ? 'accent' : ''} />
        <${Stat} label="In editing" value=${c.editing} tag="actual" />
        <${Stat} label="Pending QC" value=${c.qc} tag="actual" />
        <${Stat} label="Awaiting client approval" value=${c.review} tag="actual" />
        <${Stat} label="Overdue deliverables" value=${c.overdue} tag="actual" tone=${c.overdue ? 'crit' : ''} />
        <${Stat} label="Client revisions" value=${c.revisions} tag="actual" sub=${c.revisionTotal + ' revision rounds logged'} />
        <${Stat} label="Team workload" value=${M.team.reduce((a, m) => a + m.loadHours, 0).toFixed(1) + ' h'} tag="est" sub=${'vs ' + M.team.reduce((a, m) => a + m.capacity, 0) + ' h capacity (7 days)'} onClick=${() => go('team')} />
        <${Stat} label="Cash received this month" value=${F.inr(M.cashMonthClient)} tag="actual" sub="Client payments, incl. advances" onClick=${() => go('finance')} />
        <${Stat} label="Pending client payments" value=${F.inr(M.pending)} tag="actual" sub="Invoiced minus received" tone=${M.pending > 0 ? 'warn' : ''} />
        <${Stat} label="Business profit estimate" value=${F.inr(M.operatingEstimate)} tag="est" sub="Month, invoiced basis − costs" />
        <${Stat} label="Product sales" value=${s.product.daily.length ? F.num(M.prod.purchasesMonth) : 'Not recorded'} empty=${!s.product.daily.length} tag="actual" sub=${s.product.daily.length ? F.inr(M.productGrossMonth) + ' gross this month' : 'Log days in Creative Captions'} onClick=${() => go('product')} />
        <${Stat} label="Product trial signups" value=${s.product.daily.length ? F.num(M.prod.trialsMonth) : 'Not recorded'} empty=${!s.product.daily.length} tag="actual" sub="This month" />
        <${Stat} label="Meta Ads spend" value=${F.inr(M.ads.cost)} tag="actual" sub=${'of ' + F.inr(s.ads.budget.media) + ' media budget'} onClick=${() => go('ads')} />
        <${Stat} label="Lead pipeline value" value=${F.inr(M.crm.pipeline)} tag="est" sub=${F.inr(M.crm.weighted) + ' probability-weighted'} onClick=${() => go('crm')} />
        <${Stat} label="Sprint completion" value=${F.pct(M.sprint.pct, 0)} tag="calc" sub=${M.sprint.done + ' of ' + M.sprint.total + ' tasks done'} onClick=${() => go('sprint')} />
        <${Stat} label="Founder discipline score" value=${M.personal.discipline == null ? 'No data' : M.personal.discipline + ' / 100'} empty=${M.personal.discipline == null} tag="calc" sub="7 days: routines 50 · founder tasks 30 · speech 20" onClick=${() => go('personal')} />
      </div>

      <${Card} title="Daily priorities" actions=${html`<${Tabs} small value=${pri} onChange=${setPri} tabs=${[['today', 'Today · ' + lists.today.length], ['overdue', 'Overdue · ' + lists.overdue.length], ['risk', 'At risk · ' + lists.risk.length], ['done', 'Completed · ' + lists.done.length]]} />`}>
        ${lists[pri].length ? lists[pri].map(([k, x]) => (k === 'd' ? html`<${DelLine} key=${x.id} d=${x} />` : html`<${TaskLine} key=${x.id} x=${x} showDay />`)) : html`<p className="muted pad">Nothing in this list.</p>`}<//>
    </div>`;
  }

  /* ---------- Mind map ---------- */
  const NODES = [
    ['core', 'CREATIVE CUT', 500, 380, null], ['founder', 'Founder', 500, 175, 'core'], ['brand', 'Personal Brand', 330, 85, 'founder'], ['skill', 'Skill Development', 670, 85, 'founder'],
    ['team', 'Team', 255, 255, 'core'], ['clients', 'Clients', 235, 470, 'core'], ['mehak', 'Mehak', 80, 395, 'clients'], ['maya', 'Maya', 80, 530, 'clients'], ['suri', 'Suri', 175, 640, 'clients'],
    ['production', 'Production', 370, 600, 'core'], ['crm', 'CRM', 630, 600, 'core'], ['revenue', 'Revenue', 765, 470, 'core'], ['expenses', 'Expenses', 905, 590, 'revenue'],
    ['captions', 'Creative Captions', 745, 255, 'core'], ['ads', 'Meta Ads', 915, 175, 'captions'], ['organic', 'Organic Marketing', 915, 330, 'captions'],
    ['sprint', 'Nine-Day Sprint', 500, 700, 'core'], ['goals', '30-Day Growth Goals', 760, 715, 'sprint'],
  ];
  const XLINKS = [['team', 'production'], ['crm', 'revenue'], ['ads', 'expenses'], ['mehak', 'production'], ['organic', 'brand']];

  function clientNode(c, M) {
    if (!c) return { status: 'Not Configured', lines: [] };
    const mine = M.dels.filter((d) => d.clientId === c.id); const open = mine.filter((d) => !d.done);
    const fin = M.clientsFin.find((x) => x.client.id === c.id);
    const status = !c.configured ? 'Not Configured' : open.some((d) => d.status === 'Blocked') ? 'Blocked' : open.some((d) => d.overdue || d.risk.length) ? 'At Risk' : 'On Track';
    return { status, to: ['production', 'targets'], lines: [['Cadence', c.cadence === 'unconfigured' ? 'Not configured' : c.frequencyNote || c.cadence], ['Open deliverables', open.length], ['Overdue', open.filter((d) => d.overdue).length], ['Delivered (all time)', mine.filter((d) => d.done).length], ['Cash received', F.inr(fin.received)], ['Balance due', F.inr(fin.balance)], ['Price per video', has(c.pricePerVideo) ? F.inr(c.pricePerVideo) : 'Not configured']],
      next: open.filter((d) => d.risk.length).slice(0, 3).map((d) => d.id + ': ' + d.risk[0]) };
  }
  function nodeInfo(id, s, M) {
    const sprintOpen = M.tasks.filter((x) => x.sprintDay && !x.done);
    switch (id) {
      case 'core': return { status: M.warnings.some((w) => w.level === 'crit') ? 'At Risk' : 'Active', to: ['dashboard'], lines: [['Active clients', M.counts.activeClients], ['Open deliverables', M.counts.active], ['Cash this month', F.inr(M.cashMonthClient)], ['Pending payments', F.inr(M.pending)], ['Warnings', M.warnings.length]], next: M.warnings.slice(0, 3).map((w) => w.text) };
      case 'founder': return { status: M.founderOpen.some((x) => x.overdue) ? 'At Risk' : 'On Track', to: ['dashboard'], lines: [['Open founder tasks', M.founderOpen.length], ['Overdue', M.founderOpen.filter((x) => x.overdue).length], ['Discipline score', M.personal.discipline ?? 'No data']], next: M.founderTop.map((x) => x.title) };
      case 'brand': { const ts = M.tasks.filter((x) => x.sprintDay === 7); return { status: ts.length && ts.every((x) => x.done) ? 'Completed' : 'Active', to: ['sprint'], lines: [['Tutorial / content tasks', ts.length], ['Done', ts.filter((x) => x.done).length], ['Speech recordings logged', s.personal.speech.filter((x) => x.link).length]], next: ts.filter((x) => !x.done).map((x) => x.title).slice(0, 3) }; }
      case 'skill': return { status: M.personal.streak > 0 ? 'On Track' : 'Active', to: ['personal'], lines: [['Routine streak (≥75%)', M.personal.streak + ' days'], ['Routines today', F.pct(M.personal.todayPct, 0)], ['Speech challenges done', s.personal.speech.filter((x) => x.done === true).length + ' / 9']], next: s.personal.speech.filter((x) => x.done == null).slice(0, 2).map((x) => D.fmt(x.date) + ': ' + x.topic) };
      case 'team': return { status: M.team.some((m) => m.over) ? 'At Risk' : 'Active', to: ['team'], lines: [['Members', s.team.length], ['Roles unfilled', s.roles.filter((r) => !s.team.some((m) => (m.roleIds || []).includes(r.id))).length], ['Over capacity', M.team.filter((m) => m.over).length], ['Reports today', s.meetings.standups.filter((x) => x.date === M.t).length]], next: s.roles.filter((r) => !s.team.some((m) => (m.roleIds || []).includes(r.id))).map((r) => 'Assign someone to ' + r.title) };
      case 'clients': return { status: M.openDels.some((d) => d.overdue) ? 'At Risk' : 'Active', to: ['production', 'targets'], lines: s.clients.map((c) => [c.name, (c.configured ? c.status : 'Not configured') + ' · ' + M.openDels.filter((d) => d.clientId === c.id).length + ' open']) };
      case 'mehak': return clientNode(s.clients.find((c) => c.id === 'c_mehak'), M);
      case 'maya': return clientNode(s.clients.find((c) => c.id === 'c_maya'), M);
      case 'suri': return clientNode(s.clients.find((c) => c.id === 'c_suri'), M);
      case 'production': return { status: M.openDels.some((d) => d.status === 'Blocked') ? 'Blocked' : M.counts.overdue ? 'At Risk' : 'On Track', to: ['production'], lines: [['Open', M.counts.active], ['Due today', M.counts.dueToday], ['Editing', M.counts.editing], ['Internal QC', M.counts.qc], ['Client review', M.counts.review], ['Overdue', M.counts.overdue]], next: M.openDels.filter((d) => d.risk.length).slice(0, 3).map((d) => d.id + ': ' + d.risk[0]) };
      case 'crm': return { status: M.crm.followOverdue.length ? 'At Risk' : M.crm.total ? 'Active' : 'Not Configured', to: ['crm'], lines: [['Leads', M.crm.total], ['Qualified (target ' + s.settings.outreachTarget + ')', M.crm.qualified], ['Pipeline value', F.inr(M.crm.pipeline)], ['Won', M.crm.won], ['Follow-ups overdue', M.crm.followOverdue.length]], next: M.crm.followOverdue.slice(0, 3).map((l) => 'Follow up ' + l.name) };
      case 'revenue': return { status: M.clientsFin.some((c) => c.overdueInvoices) ? 'At Risk' : 'Active', to: ['finance'], lines: [['Client cash this month', F.inr(M.cashMonthClient)], ['Product gross this month', F.inr(M.productGrossMonth)], ['Pending client payments', F.inr(M.pending)], ['Profit estimate (month)', F.inr(M.operatingEstimate)]] };
      case 'expenses': return { status: M.sprintSpend > n(s.settings.sprintBudget) ? 'At Risk' : 'Active', to: ['finance'], lines: [['Expenses this month', F.inr(M.expensesMonth)], ['Ad spend this month', F.inr(M.adSpendMonth)], ['Sprint budget used', F.inr(M.sprintSpend) + ' / ' + F.inr(s.settings.sprintBudget)]] };
      case 'captions': { const v = s.product.config.verified; const ok = Object.values(v).filter(Boolean).length; return { status: ok < Object.keys(v).length ? 'At Risk' : 'Active', to: ['product'], lines: [['Config verified', ok + ' / ' + Object.keys(v).length], ['Trials (all)', F.num(M.prod.trials)], ['Purchases (all)', F.num(M.prod.purchases)], ['Net receipts', F.inr(M.prod.net)], ['Support issues', M.prod.support]], next: Object.entries(v).filter(([, b]) => !b).map(([k]) => 'Verify ' + k) }; }
      case 'ads': { const map = { 'Tracking Incomplete': 'Not Configured', Pause: 'Blocked', Investigate: 'At Risk', Continue: 'On Track' }; return { status: map[M.ads.decision.key], to: ['ads'], lines: [['Decision', M.ads.decision.key], ['Spent', F.inr(M.ads.cost)], ['Remaining', F.inr(M.ads.remaining)], ['Attributed purchases', F.num(M.ads.purchases)], ['ROAS', F.x(M.ads.roas)]], next: [M.ads.decision.why] }; }
      case 'organic': return { status: 'Active', to: ['product'], lines: [['Organic purchases', F.num(M.prod.organic)], ['Paid purchases', F.num(M.prod.paid)]], next: M.tasks.filter((x) => x.sprintDay === 7 && !x.done).map((x) => x.title).slice(0, 3) };
      case 'sprint': return { status: M.sprint.pct === 1 ? 'Completed' : sprintOpen.some((x) => x.overdue) ? 'At Risk' : 'On Track', to: ['sprint'], lines: [['Completion', F.pct(M.sprint.pct, 0)], ['Tasks done', M.sprint.done + ' / ' + M.sprint.total], ['Overdue sprint tasks', sprintOpen.filter((x) => x.overdue).length], ['Budget used', F.inr(M.sprintSpend) + ' / ' + F.inr(s.settings.sprintBudget)]] };
      case 'goals': return { status: s.goals.thirtyDay ? 'Active' : 'Not Configured', to: ['sprint', 'roadmap'], lines: [['Roadmap', s.goals.thirtyDay ? 'Written' : 'Not written yet (Day 9 task)']], next: s.goals.thirtyDay ? s.goals.thirtyDay.split('\n').filter(Boolean).slice(0, 4) : [] };
    }
    return { status: 'Active', lines: [] };
  }
  const NODE_TONE = { Active: 'info', 'On Track': 'ok', 'At Risk': 'warn', Blocked: 'crit', 'Not Configured': 'muted', Completed: 'ok' };

  function MindMap() {
    const app = CC.useApp(); const { s, M, go } = app;
    const [sel, setSel] = useState('core');
    const [vb, setVb] = useState({ x: 0, y: 20, w: 1000, h: 740 });
    const drag = useRef(null); const svg = useRef(null);
    const pos = Object.fromEntries(NODES.map((x) => [x[0], x]));
    const infos = useMemo(() => Object.fromEntries(NODES.map(([id]) => [id, nodeInfo(id, s, M)])), [s, M]);
    const zoom = (f, cx, cy) => setVb((v) => { const w = Math.min(2200, Math.max(300, v.w * f)), hh = (w / v.w) * v.h; const px = cx ?? v.x + v.w / 2, py = cy ?? v.y + v.h / 2; return { x: px - ((px - v.x) * w) / v.w, y: py - ((py - v.y) * hh) / v.h, w, h: hh }; });
    const toSvg = (e) => { const r = svg.current.getBoundingClientRect(); return [vb.x + ((e.clientX - r.left) / r.width) * vb.w, vb.y + ((e.clientY - r.top) / r.height) * vb.h]; };
    useEffect(() => { const el = svg.current; const w = (e) => { e.preventDefault(); const [x, y] = toSvg(e); zoom(e.deltaY > 0 ? 1.12 : 0.89, x, y); }; el.addEventListener('wheel', w, { passive: false }); return () => el.removeEventListener('wheel', w); });
    const down = (e) => { const t = e.target.closest && e.target.closest('[data-node]'); drag.current = { x: e.clientX, y: e.clientY, vb, moved: false, node: t ? t.getAttribute('data-node') : null }; e.currentTarget.setPointerCapture?.(e.pointerId); };
    const move = (e) => { const d = drag.current; if (!d) return; const r = svg.current.getBoundingClientRect(); const dx = ((e.clientX - d.x) / r.width) * d.vb.w, dy = ((e.clientY - d.y) / r.height) * d.vb.h; if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) d.moved = true; if (d.moved) setVb({ ...d.vb, x: d.vb.x - dx, y: d.vb.y - dy }); };
    const upH = (e) => { const d = drag.current; drag.current = null; if (d && !d.moved && d.node) setSel(d.node); };
    const info = infos[sel]; const node = pos[sel];
    return html`<div className="page">
      <div className="page-h"><div><p className="eyebrow">Business map</p><h1>How the business connects</h1><p className="muted">Every node is calculated from your records. Click a node to see its data; drag to pan, scroll or use the buttons to zoom.</p></div>
        <div className="legend-s">${Object.entries(NODE_TONE).map(([k, t]) => html`<span key=${k}><i className=${'dot tone-bg-' + t}></i>${k}</span>`)}</div></div>
      <div className="mm">
        <div className="mm-canvas">
          <div className="mm-tools"><${Btn} small kind="ghost" icon="zoomin" title="Zoom in" onClick=${() => zoom(0.8)} /><${Btn} small kind="ghost" icon="zoomout" title="Zoom out" onClick=${() => zoom(1.25)} /><${Btn} small kind="ghost" icon="fit" title="Fit to view" onClick=${() => setVb({ x: 0, y: 20, w: 1000, h: 740 })} /></div>
          <svg ref=${svg} viewBox=${`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} onPointerDown=${down} onPointerMove=${move} onPointerUp=${upH} onPointerLeave=${() => (drag.current = null)} role="img" aria-label="Business mind map">
            ${NODES.filter((x) => x[4]).map(([id, , x, y, p]) => html`<line key=${id} x1=${pos[p][2]} y1=${pos[p][3]} x2=${x} y2=${y} className="mm-edge" />`)}
            ${XLINKS.map(([a, b]) => html`<line key=${a + b} x1=${pos[a][2]} y1=${pos[a][3]} x2=${pos[b][2]} y2=${pos[b][3]} className="mm-edge dashed" />`)}
            ${NODES.map(([id, label, x, y]) => { const inf = infos[id]; const core = id === 'core'; const w = core ? 170 : Math.max(108, label.length * 8.2 + 34); const hh = core ? 56 : 40; const sub = inf.lines[0] ? String(inf.lines[0][1]) : ''; return html`<g key=${id} data-node=${id} className=${'mm-node' + (sel === id ? ' sel' : '') + (core ? ' core' : '')} tabIndex="0" role="button" aria-label=${label + ', ' + inf.status} onKeyDown=${(e) => (e.key === 'Enter' || e.key === ' ') && setSel(id)}>
              <rect x=${x - w / 2} y=${y - hh / 2} width=${w} height=${hh} rx=${core ? 14 : 10} />
              <circle cx=${x - w / 2 + 14} cy=${y - (core ? 8 : 6)} r="4.5" className=${'fill-' + NODE_TONE[inf.status]} />
              <text x=${x - w / 2 + 26} y=${y - (core ? 3 : 2)} className="mm-l">${label}</text>
              <text x=${x - w / 2 + 26} y=${y + (core ? 15 : 13)} className="mm-s">${inf.status}${!core && sub && sub.length < 18 ? ' · ' + sub : ''}</text></g>`; })}
          </svg></div>
        <aside className="mm-panel card">
          <p className="eyebrow">${node[4] ? 'Connected to ' + pos[node[4]][1] : 'Centre'}</p>
          <div className="row between"><h3>${node[1]}</h3><${StatusPill} s=${info.status} /></div>
          <div className="kv">${info.lines.map(([k, v], i) => html`<span key=${'k' + i}>${k}</span><b key=${'v' + i} className="num">${v}</b>`)}</div>
          ${info.next && info.next.length > 0 && html`<div><p className="eyebrow">Next actions</p><ul className="ulist">${info.next.map((t, i) => html`<li key=${i}>${t}</li>`)}</ul></div>`}
          ${info.to && html`<${Btn} kind="primary" icon="arrow" onClick=${() => go(...info.to)}>Open ${node[1]} section<//>`}
        </aside></div></div>`;
  }

  /* ---------- Client Production ---------- */
  function Production({ sub }) {
    const app = CC.useApp(); const { s, M, open, up } = app; const A = CC.actions(app);
    const [tab, setTab] = useState(sub || 'board');
    useEffect(() => { if (sub) setTab(sub); }, [sub]);
    const [fc, setFc] = useState(''); const [fa, setFa] = useState(''); const [q, setQ] = useState(''); const [showDone, setShowDone] = useState(false);
    const list = M.dels.filter((d) => (!fc || d.clientId === fc) && (!fa || (fa === 'none' ? !d.assigneeId : d.assigneeId === fa)) && (!q || (d.title + d.id).toLowerCase().includes(q.toLowerCase())));
    const filters = html`<div className="filters">
      <${Sel} ariaLabel="Client filter" value=${fc} onChange=${setFc} options=${[['', 'All clients'], ...s.clients.map((c) => [c.id, c.name])]} />
      <${Sel} ariaLabel="Editor filter" value=${fa} onChange=${setFa} options=${[['', 'All editors'], ['none', 'Unassigned'], ...s.team.map((m) => [m.id, m.name])]} />
      <input className="inp" placeholder="Search ID or topic" value=${q} onChange=${(e) => setQ(e.target.value)} aria-label="Search deliverables" /></div>`;
    return html`<div className="page">
      <div className="page-h"><div><p className="eyebrow">Client production</p><h1>Deliverables</h1><p className="muted">${M.counts.active} open · ${M.counts.overdue} overdue · ${M.dels.filter((d) => d.done).length} delivered. Status only moves when you move it.</p></div>
        <div className="row gap-s wrap"><${Btn} kind="primary" icon="plus" onClick=${() => open('deliverable', null, fc ? { clientId: fc } : undefined)}>New deliverable<//></div></div>
      <${Tabs} value=${tab} onChange=${setTab} tabs=${[['board', 'Board'], ['calendar', 'Calendar'], ['list', 'List'], ['targets', 'Client targets'], ['capacity', 'Capacity']]} />
      ${['board', 'calendar', 'list'].includes(tab) && filters}
      ${tab === 'board' && html`<${Board} list=${list} />`}
      ${tab === 'calendar' && html`<${Calendar} list=${list} />`}
      ${tab === 'list' && html`<${Card} actions=${html`<label className="chk"><input type="checkbox" checked=${showDone} onChange=${(e) => setShowDone(e.target.checked)} /><span>Show delivered</span></label>`}>
        ${list.filter((d) => showDone || !d.done).length ? html`<div className="tbl-w"><table className="tbl"><thead><tr><th>ID</th><th>Topic</th><th>Client</th><th>Editor</th><th>Status</th><th>Priority</th><th>Due</th><th>Delivered</th><th className="r">Est h</th><th className="r">Rev.</th><th>QC</th><th>Links</th></tr></thead><tbody>
          ${list.filter((d) => showDone || !d.done).sort((a, b) => ((a.dueDate || '') < (b.dueDate || '') ? -1 : 1)).map((d) => html`<tr key=${d.id} className=${d.overdue ? 'row-crit' : ''}><td><button className="lnk mono" onClick=${() => open('deliverable', d.id)}>${d.id}</button></td><td>${d.title}${d.demo ? html` <${Pill} tone="warn">DEMO<//>` : ''}</td><td>${M.clientById[d.clientId]?.name}</td><td>${CC.ownerName(s, d.assigneeId)}</td><td><${StatusPill} s=${d.status} /></td><td>${d.priority}</td><td className="num">${D.fmt(d.dueDate)}</td><td className="num">${D.fmt(d.completedDate)}${d.late ? html` <${Pill} tone="warn">late<//>` : ''}</td><td className="r num">${d.hours}</td><td className="r num">${n(d.revisionCount)}</td><td className="num">${CC.QC_ITEMS.filter(([k]) => (d.qc || {})[k]).length}/${CC.QC_ITEMS.length}</td><td><${Ext} href=${d.deliverableLink || d.assetLink}>file<//></td></tr>`)}
        </tbody></table></div>` : html`<${Empty} icon="film" title="No deliverables match" text="Add a deliverable or change the filters." />`}<//>`}
      ${tab === 'targets' && html`<${Targets} />`}
      ${tab === 'capacity' && html`<${Capacity} />`}
    </div>`;
  }

  function Board({ list }) {
    const app = CC.useApp(); const A = CC.actions(app); const { M, s, open } = app;
    const [over, setOver] = useState(null);
    const cols = CC.ALL_STATUSES;
    return html`<div className="kanban">${cols.map((st) => {
      const items = list.filter((d) => d.status === st && (st !== 'Delivered' || d.completedDate >= D.add(M.t, -7)));
      return html`<div key=${st} className=${'kcol' + (over === st ? ' over' : '') + (st === 'Blocked' ? ' kcol-blocked' : '')} onDragOver=${(e) => { e.preventDefault(); setOver(st); }} onDragLeave=${() => setOver(null)}
        onDrop=${async (e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('text/plain'); if (st === 'Blocked') { app.open('deliverable', id, undefined, { status: 'Blocked' }); return; } A.setDelStatus(id, st); }}>
        <div className="kcol-h"><${StatusPill} s=${st} /><span className="num muted sm">${items.length}</span></div>
        ${st === 'Delivered' && html`<p className="xs muted">Last 7 days</p>`}
        ${items.map((d) => { const qc = CC.QC_ITEMS.filter(([k]) => (d.qc || {})[k]).length; return html`<article key=${d.id} className=${'kcard' + (d.overdue ? ' is-crit' : d.risk.length ? ' is-warn' : '')} draggable="true" onDragStart=${(e) => e.dataTransfer.setData('text/plain', d.id)}>
          <button className="kcard-b" onClick=${() => open('deliverable', d.id)}>
            <div className="row between"><span className="mono xs muted">${d.id}</span>${d.demo ? html`<${Pill} tone="warn">DEMO<//>` : html`<span className=${'pri pri-' + d.priority}>${d.priority}</span>`}</div>
            <strong className="kcard-t">${d.title}</strong>
            <span className="sm muted">${M.clientById[d.clientId]?.name} · ${CC.ownerName(s, d.assigneeId)}</span>
            <span className=${'sm ' + (d.overdue ? 'risk' : 'muted')}>Due ${D.fmt(d.dueDate)} · ${d.hours} h${n(d.revisionCount) ? ' · ' + d.revisionCount + ' rev.' : ''} · QC ${qc}/${CC.QC_ITEMS.length}</span>
            ${d.risk.length > 0 && html`<span className="risk xs">${d.risk[0]}</span>`}</button>
          <${Sel} className="sel-s" ariaLabel=${'Move ' + d.id} value=${d.status} options=${cols} onChange=${(v) => (v === 'Blocked' ? app.open('deliverable', d.id, undefined, { status: 'Blocked' }) : A.setDelStatus(d.id, v))} /></article>`; })}
        ${!items.length && html`<p className="kempty">Empty</p>`}</div>`;
    })}</div>`;
  }

  function Calendar({ list }) {
    const { M, open } = CC.useApp();
    const [m, setM] = useState(D.month(M.t));
    const first = D.parse(m + '-01'); const start = D.week(m + '-01');
    const days = D.range(start, D.add(start, 41));
    const prevM = () => { const d = new Date(first); d.setMonth(d.getMonth() - 1); setM(D.month(D.ymd(d))); };
    const nextM = () => { const d = new Date(first); d.setMonth(d.getMonth() + 1); setM(D.month(D.ymd(d))); };
    return html`<${Card} title=${D.monthName(m)} actions=${html`<${Btn} small kind="ghost" icon="left" title="Previous month" onClick=${prevM} /><${Btn} small kind="ghost" onClick=${() => setM(D.month(M.t))}>Today<//><${Btn} small kind="ghost" icon="right" title="Next month" onClick=${nextM} />`}>
      <div className="cal-w"><div className="cal">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => html`<div key=${d} className="cal-h">${d}</div>`)}
        ${days.map((d) => { const due = list.filter((x) => x.dueDate === d); const deliv = list.filter((x) => x.done && x.completedDate === d && x.dueDate !== d); return html`<div key=${d} className=${'cal-d' + (D.month(d) !== m ? ' out' : '') + (d === M.t ? ' today' : '') + (d >= '2026-11-07' && d <= '2026-11-15' ? ' sprint' : '')}>
          <span className="cal-n num">${D.parse(d).getDate()}</span>
          ${due.map((x) => html`<button key=${x.id} className=${'cal-i st-' + (x.done ? 'ok' : x.overdue ? 'crit' : CC.STATUS_TONE[x.status])} onClick=${() => open('deliverable', x.id)} title=${x.id + ' ' + x.title + ' · ' + x.status}>${M.clientById[x.clientId]?.name.slice(0, 5)} · ${x.title}</button>`)}
          ${deliv.map((x) => html`<button key=${x.id + 'd'} className="cal-i st-ok" onClick=${() => open('deliverable', x.id)}>✓ ${x.id} delivered</button>`)}</div>`; })}</div></div>
      <p className="muted xs pad">Shaded days are the Nov 7–15 sprint. Items sit on their due date; a tick marks a delivery made on a different day.</p><//>`;
  }

  function Targets() {
    const app = CC.useApp(); const { s, M, up, open, toast, confirm } = app;
    const [from, setFrom] = useState(s.settings.sprintStart); const [to, setTo] = useState(s.settings.sprintEnd);
    const daily = s.clients.filter((c) => c.cadence === 'daily'); const weekly = s.clients.filter((c) => c.cadence === 'weekly'); const other = s.clients.filter((c) => !['daily', 'weekly'].includes(c.cadence));
    const toggleDay = (c, date) => up((d) => { const cl = d.clients.find((x) => x.id === c.id); const set = new Set(CC.nonWorking(cl)); set.has(date) ? set.delete(date) : set.add(date); cl.nonWorkingDates = [...set].sort().join(', '); });
    const createSlots = async (c, plan) => {
      const need = plan.filter((p) => p.working && p.scheduled < p.min).reduce((a, p) => a + (p.min - p.scheduled), 0);
      if (!need) { toast('Every working day already has its minimum scheduled'); return; }
      const ok = await confirm({ title: `Create ${need} planned slot${need > 1 ? 's' : ''} for ${c.name}?`, text: 'Each becomes a Backlog deliverable with topic "To be confirmed" on its due date. These are plans, not deliveries. You can edit or delete them.', ok: 'Create slots' });
      if (!ok) return;
      up((d) => { plan.filter((p) => p.working && p.scheduled < p.min).forEach((p) => { for (let i = p.scheduled; i < p.min; i++) { d.counters.deliverable = n(d.counters.deliverable) + 1; d.deliverables.push({ id: 'CC-' + String(d.counters.deliverable).padStart(4, '0'), title: c.name + ' daily video — topic TBC', clientId: c.id, status: 'Backlog', priority: 'High', complexity: 'standard', assigneeId: '', startDate: p.date, dueDate: p.date, originalDueDate: p.date, assetsReceived: false, scriptStatus: 'Pending', editingProgress: 0, revisionCount: 0, paymentStatus: 'Not billed', qc: {} }); } }); });
      toast(need + ' planned slots created');
    };
    return html`<div className="stack">
      <div className="filters"><label className="sm muted" htmlFor="tg-from">From</label><input id="tg-from" type="date" className="inp" value=${from} onChange=${(e) => setFrom(e.target.value)} /><label className="sm muted" htmlFor="tg-to">to</label><input id="tg-to" type="date" className="inp" value=${to} onChange=${(e) => setTo(e.target.value)} /><${Btn} small kind="ghost" onClick=${() => { setFrom(s.settings.sprintStart); setTo(s.settings.sprintEnd); }}>Sprint range<//></div>
      ${daily.map((c) => { const plan = CC.dailyPlan(c, M.dels, from, to); const wd = plan.filter((p) => p.working).length; const last = plan[plan.length - 1] || {}; const delivered = sum(plan, (p) => p.delivered);
        return html`<${Card} key=${c.id} title=${c.name + ' · daily target'} sub=${c.frequencyNote} actions=${html`<${Btn} small kind="ghost" icon="edit" onClick=${() => open('client', c.id)}>Configure<//><${Btn} small icon="plus" onClick=${() => createSlots(c, plan)}>Create planned slots<//>`}>
          <div className="stats stats-s">
            <${Stat} label="Planning range" value=${sum(plan, (p) => p.min) + '–' + sum(plan, (p) => p.stretch) + ' videos'} tag="target" sub=${wd + ' working days × ' + n(c.minPerPeriod) + '–' + n(c.stretchPerPeriod)} />
            <${Stat} label="Delivered in range" value=${delivered} tag="actual" />
            <${Stat} label="Carry-forward now" value=${last.date && last.date > M.t ? (plan.find((p) => p.date === M.t)?.carry ?? 0) : last.carry ?? 0} tag="calc" sub="Minimum target not yet delivered" tone=${(plan.find((p) => p.date === M.t)?.carry || 0) > 0 ? 'warn' : ''} />
            <div className="stat"><div className="stat-top"><span className="stat-l">Targets per day</span><${Tag} kind="config" /></div><div className="row gap-s"><label className="sm" htmlFor=${'mn' + c.id}>Min</label><input id=${'mn' + c.id} className="inp num w60" type="number" min="0" value=${c.minPerPeriod ?? ''} onChange=${(e) => up((d) => { d.clients.find((x) => x.id === c.id).minPerPeriod = e.target.value === '' ? null : +e.target.value; })} /><label className="sm" htmlFor=${'st' + c.id}>Stretch</label><input id=${'st' + c.id} className="inp num w60" type="number" min="0" value=${c.stretchPerPeriod ?? ''} onChange=${(e) => up((d) => { d.clients.find((x) => x.id === c.id).stretchPerPeriod = e.target.value === '' ? null : +e.target.value; })} /></div></div>
          </div>
          <div className="tbl-w"><table className="tbl"><thead><tr><th>Date</th><th>Working day</th><th className="r">Planned (min–stretch)</th><th className="r">Scheduled</th><th className="r">Delivered</th><th className="r">Cumulative</th><th className="r">Carry-forward</th></tr></thead><tbody>
            ${plan.map((p) => html`<tr key=${p.date} className=${p.date === M.t ? 'row-today' : ''}><td>${D.long(p.date)}</td><td><label className="chk"><input type="checkbox" checked=${p.working} onChange=${() => toggleDay(c, p.date)} aria-label=${'Working day ' + p.date} /><span className="sm">${p.working ? 'Yes' : 'Off / paused'}</span></label></td><td className="r num">${p.working ? p.min + '–' + p.stretch : '—'}</td><td className="r num">${p.scheduled}</td><td className="r num">${p.date > M.t ? '—' : p.delivered}</td><td className="r num">${p.date > M.t ? '—' : p.cumDel + ' / ' + p.cumMin}</td><td className=${'r num ' + (p.carry && p.date <= M.t ? 'risk' : '')}>${p.date > M.t ? '—' : p.carry}</td></tr>`)}
          </tbody></table></div><p className="xs muted pad">Delivered counts only deliverables set to Delivered with that actual delivery date. Untick a day for holidays or client pauses.</p><//>`; })}
      ${weekly.map((c) => { const plan = CC.weeklyPlan(c, M.dels, from, to); const cap = sum(M.team, (m) => m.capacity);
        return html`<${Card} key=${c.id} title=${c.name + (c.company ? ' / ' + c.company : '') + ' · weekly target'} sub=${c.frequencyNote} actions=${html`<${Btn} small kind="ghost" icon="edit" onClick=${() => open('client', c.id)}>Configure<//><${Btn} small icon="plus" onClick=${() => open('deliverable', null, { clientId: c.id })}>Add video<//>`}>
          <div className="tbl-w"><table className="tbl"><thead><tr><th>Week (Mon–Sun)</th><th>Target min</th><th>Stretch</th><th className="r">Planned</th><th className="r">Briefs in</th><th className="r">Approved</th><th className="r">Delivered</th><th className="r">Revisions</th><th className="r">Hours</th><th>Due dates</th></tr></thead><tbody>
            ${plan.map((w) => { const due = M.dels.filter((d) => d.clientId === c.id && d.dueDate >= w.weekStart && d.dueDate <= w.weekEnd); const hrs = sum(due, (d) => d.hours);
              const setW = (k, v) => up((d) => { const cl = d.clients.find((x) => x.id === c.id); cl.weekTargets = cl.weekTargets || {}; cl.weekTargets[w.weekStart] = { ...(cl.weekTargets[w.weekStart] || {}), [k]: v === '' ? null : +v }; });
              return html`<tr key=${w.weekStart}><td>${D.fmt(w.weekStart)} – ${D.fmt(w.weekEnd)}</td>
                <td><input className="inp num w60" type="number" min="0" aria-label="Weekly minimum" value=${w.min} onChange=${(e) => setW('min', e.target.value)} /></td>
                <td><input className="inp num w60" type="number" min="0" aria-label="Weekly stretch" value=${w.stretch} onChange=${(e) => setW('stretch', e.target.value)} /></td>
                <td className=${'r num ' + (w.planned < w.min ? 'risk' : '')}>${w.planned}</td><td className="r num">${w.briefs}</td><td className="r num">${w.approved}</td><td className="r num">${w.delivered} / ${w.min}</td><td className="r num">${w.revisions}</td><td className="r num">${hrs.toFixed(1)}</td>
                <td className="sm">${due.length ? due.map((d) => D.dow(d.dueDate) + ' ' + D.fmt(d.dueDate)).join(', ') : html`<span className="muted">No due dates set</span>`}</td></tr>`; })}
          </tbody></table></div>
          <p className="xs muted pad">Each week’s target can differ. No weekday deadline is assumed — set due dates per video once confirmed. Team capacity: ${cap} h per 7 days across all clients.</p><//>`; })}
      ${other.map((c) => { const fields = [['Project type', c.projectType], ['Contract value', has(c.contractValue) ? F.inr(c.contractValue) : ''], ['Frequency', c.frequencyNote], ['Expected outputs', c.expectedOutputs], ['Price per deliverable', has(c.pricePerVideo) ? F.inr(c.pricePerVideo) : ''], ['Editor', M.team.filter((m) => (m.clientIds || []).includes(c.id)).map((m) => m.name).join(', ')], ['Client point of contact', c.poc], ['Pending assets', c.pendingAssets], ['Payment terms', c.paymentTerms], ['Current status', c.status]];
        const dels = M.dels.filter((d) => d.clientId === c.id);
        return html`<${Card} key=${c.id} title=${c.name + ' · ' + (c.configured ? 'project' : 'not configured')} sub=${c.notes} actions=${html`<${Btn} small kind="primary" icon="edit" onClick=${() => open('client', c.id)}>Configure ${c.name}<//><${Btn} small icon="plus" onClick=${() => open('deliverable', null, { clientId: c.id })}>Add deliverable<//>`}>
          <div className="kv kv-2">${fields.map(([k, v]) => html`<span key=${k + 'k'}>${k}</span><b key=${k + 'v'} className=${v ? '' : 'nc'}>${v || 'Not configured'}</b>`)}</div>
          <p className="eyebrow pad">Deliverables and due dates</p>
          ${dels.length ? dels.map((d) => html`<${DelLine} key=${d.id} d=${d} compact />`) : html`<p className="muted pad">No deliverable due dates set.</p>`}<//>`; })}
    </div>`;
  }

  function Capacity() {
    const { s, M, open } = CC.useApp();
    const unassigned = M.openDels.filter((d) => !d.assigneeId);
    const days = D.range(M.t, D.add(M.t, 6));
    return html`<div className="stack">
      <${Card} title="Editor capacity · next 7 days" sub="Remaining hours from per-video estimates (complexity or your own hours), plus dated tasks. Video count alone is not used.">
        <div className="tbl-w"><table className="tbl"><thead><tr><th>Member</th><th className="r">Open videos</th><th className="r">Planned h</th><th className="r">Available h</th><th style=${{ minWidth: '160px' }}>Load</th>${days.map((d) => html`<th key=${d} className="r">${D.dow(d)} ${D.parse(d).getDate()}</th>`)}</tr></thead><tbody>
          ${M.team.map((m) => html`<tr key=${m.id}><td><strong>${m.name}</strong><div className="xs muted">${n(m.capacityHours)} h/day · ${n(m.workDays || 6)} days</div></td><td className="r num">${m.open}</td><td className="r num">${m.loadHours.toFixed(1)}</td><td className="r num">${m.capacity}</td><td><${Progress} value=${m.utilisation} tone=${m.over ? 'crit' : m.utilisation > 0.8 ? 'warn' : 'accent'} label=${m.name + ' load'} /><span className=${'xs ' + (m.over ? 'risk' : 'muted')}>${m.utilisation == null ? 'No capacity set' : F.pct(m.utilisation, 0)}${m.over ? ' · over capacity' : ''}</span></td>
            ${days.map((d) => { const hrs = sum(M.openDels.filter((x) => x.assigneeId === m.id && (d === M.t ? x.dueDate <= d : x.dueDate === d)), (x) => x.remainingHours); const ov = n(m.capacityHours) > 0 && hrs > n(m.capacityHours); return html`<td key=${d} className=${'r num ' + (ov ? 'risk' : hrs ? '' : 'muted')}>${hrs ? hrs.toFixed(1) : '·'}</td>`; })}</tr>`)}
          <tr><td><strong>Unassigned</strong></td><td className="r num">${unassigned.length}</td><td className="r num">${sum(unassigned, (d) => d.remainingHours).toFixed(1)}</td><td className="r">—</td><td>${unassigned.length ? html`<span className="risk xs">Assign an editor</span>` : ''}</td>${days.map((d) => html`<td key=${d} className="r num muted">${sum(unassigned.filter((x) => x.dueDate === d), (x) => x.remainingHours).toFixed(1).replace(/^0\.0$/, '·')}</td>`)}</tr>
        </tbody></table></div>
        <p className="xs muted pad">Day columns show remaining hours due that day (today includes overdue). Red means more than that member’s daily hours. Adjust capacity in Team Management.</p><//>
      <${Card} title="Dates at risk">${M.openDels.filter((d) => d.risk.length || d.overdue).length ? M.openDels.filter((d) => d.risk.length || d.overdue).map((d) => html`<${DelLine} key=${d.id} d=${d} />`) : html`<p className="muted pad">No deliverable is currently flagged.</p>`}<//>
    </div>`;
  }

  Object.assign(CC, { Dashboard, MindMap, Production });
})();
