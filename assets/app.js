/* Creativecut CRM — UI layer. All business rules live in logic.js. */
(function () {
  'use strict';

  var CRM = window.CRM, C = window.CRM_CONTENT;
  var STORAGE_KEY = 'creativecut-crm-v1';
  var state = load();
  var currentView = 'dashboard';
  var leadFilter = { q: '', stage: '' };

  // ---------- persistence ----------
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return CRM.migrate(raw ? JSON.parse(raw) : null);
    } catch (e) {
      return CRM.emptyState();
    }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      toast('Could not save — browser storage is blocked. Export a backup from Settings.');
    }
  }
  function commit() { save(); render(); }

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '$' + Math.round(n || 0).toLocaleString('en-US'); }
  function pct(r) { return r == null ? '—' : Math.round(r * 100) + '%'; }
  function today() { return CRM.todayISO(); }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function template(id) { return C.TEMPLATES.filter(function (t) { return t.id === id; })[0]; }
  function sequence(id) { return C.SEQUENCES.filter(function (s) { return s.id === id; })[0]; }
  function leadName(l) { return l ? (l.company ? l.name + ' · ' + l.company : l.name || '(no name)') : ''; }
  function stageOptions(sel) {
    return CRM.STAGES.map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === sel ? ' selected' : '') + '>' + esc(s.label) + '</option>';
    }).join('');
  }
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('Copied'); }, function () { fallbackCopy(text); });
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Copied'); } catch (e) { toast('Copy failed — select and copy manually'); }
    ta.remove();
  }

  // ---------- modal ----------
  var modal = $('#modal');
  function openModal(html, onReady) {
    $('#modalBody').innerHTML = html;
    if (!modal.open) modal.showModal();
    if (onReady) onReady($('#modalBody'));
  }
  function closeModal() { if (modal.open) modal.close(); }
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  // Enter in a text field must not submit (and close) the dialog form.
  modal.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.preventDefault();
  });

  // ---------- render ----------
  var VIEWS = {
    dashboard: renderDashboard, pipeline: renderPipeline, leads: renderLeads, tasks: renderTasks,
    clients: renderClients, playbook: renderPlaybook, settings: renderSettings
  };

  function render() {
    $$('#tabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.view === currentView); });
    var m = CRM.computeMetrics(state, today());
    var badge = $('#taskBadge');
    var due = m.tasksToday + m.tasksOverdue;
    badge.hidden = !due;
    badge.textContent = due;
    $('#view').innerHTML = VIEWS[currentView](m);
    bindView();
  }

  $('#tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-view]');
    if (!b) return;
    currentView = b.dataset.view;
    render();
  });

  // ---------- dashboard ----------
  function kpi(label, value, sub) {
    return '<div class="kpi"><div class="kpi-label">' + esc(label) + '</div><div class="kpi-value">' + value +
      '</div>' + (sub ? '<div class="kpi-sub">' + sub + '</div>' : '') + '</div>';
  }

  function renderDashboard(m) {
    if (!state.leads.length) {
      return '<section class="empty"><h2>Welcome to Creativecut CRM</h2>' +
        '<p>Add your first lead, import a CSV of prospects, or load demo data to see how everything works.</p>' +
        '<div class="row"><button class="primary" data-act="add-lead">Add a lead</button>' +
        '<button data-act="goto" data-view="leads">Import CSV</button>' +
        '<button data-act="demo">Load demo data</button></div>' +
        '<p class="muted">Start with Settings: add your name, booking link and portfolio link so every email template is filled in.</p></section>';
    }
    var maxF = Math.max.apply(null, m.funnel.map(function (f) { return f.count; }).concat([1]));
    var tasks = openTasks().slice(0, 8);
    return '<section class="kpis">' +
      kpi('Monthly recurring revenue', money(m.mrr), m.activeClients + ' active client' + (m.activeClients === 1 ? '' : 's') + ' · ' + money(m.arr) + ' ARR') +
      kpi('Weighted pipeline', money(m.weightedPipeline), money(m.pipelineValue) + ' unweighted') +
      kpi('Win rate', pct(m.winRate), 'closed deals') +
      kpi('Reply rate', pct(m.replyRate), 'contacted → replied') +
      kpi('Follow-ups due', String(m.tasksToday + m.tasksOverdue), m.tasksOverdue ? '<span class="warn">' + m.tasksOverdue + ' overdue</span>' : 'none overdue') +
      kpi('Client churn', pct(m.churnRate), m.churnedClients + ' churned') +
      '</section>' +
      '<section class="grid2">' +
      '<div class="card"><h3>Funnel</h3>' + m.funnel.map(function (f, i) {
        var prev = i ? m.funnel[i - 1].count : null;
        var conv = prev ? ' <span class="muted">(' + pct(f.count / prev) + ')</span>' : '';
        return '<div class="bar-row"><span class="bar-label">' + esc(f.label) + '</span><span class="bar"><span style="width:' +
          (f.count / maxF * 100) + '%"></span></span><span class="bar-num">' + f.count + conv + '</span></div>';
      }).join('') +
      '<p class="muted small">Targets for cold outbound: reply 5–10%, replied → call 40%+, proposal → won 30%+.</p></div>' +
      '<div class="card"><h3>Today\'s follow-ups</h3>' + (tasks.length ? taskList(tasks, true) : '<p class="muted">Nothing due. Go find new leads.</p>') +
      '<button data-act="goto" data-view="tasks">All follow-ups →</button></div>' +
      '<div class="card"><h3>Lead sources</h3><table><thead><tr><th>Source</th><th>Leads</th><th>Clients</th><th>MRR</th></tr></thead><tbody>' +
      m.sources.map(function (s) {
        return '<tr><td>' + esc(s.source) + '</td><td>' + s.leads + '</td><td>' + s.won + '</td><td>' + money(s.mrr) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="card"><h3>Needs attention</h3>' +
      (m.renewalsSoon.length ? '<h4>Renewals in the next 30 days</h4><ul>' + m.renewalsSoon.map(function (r) {
        return '<li><a href="#" data-act="open-lead" data-id="' + r.id + '">' + esc(r.name) + '</a> — ' + esc(r.date) + ' · ' + money(r.value) + '/mo</li>';
      }).join('') + '</ul>' : '') +
      (m.staleDeals.length ? '<h4>Deals with no activity for 14+ days</h4><ul>' + m.staleDeals.map(function (r) {
        return '<li><a href="#" data-act="open-lead" data-id="' + r.id + '">' + esc(r.name) + '</a> — ' + r.days + ' days</li>';
      }).join('') + '</ul>' : '') +
      (!m.renewalsSoon.length && !m.staleDeals.length ? '<p class="muted">All clear.</p>' : '') +
      '</div></section>';
  }

  // ---------- pipeline ----------
  function renderPipeline() {
    return '<div class="toolbar"><button class="primary" data-act="add-lead">+ Lead</button>' +
      '<span class="muted">Drag cards between columns, or open a card to change stage. Moving a card triggers its follow-up automation.</span></div>' +
      '<section class="board">' + CRM.STAGES.map(function (s) {
        var leads = state.leads.filter(function (l) { return l.stage === s.id; });
        var total = leads.reduce(function (a, l) { return a + (l.value || 0); }, 0);
        return '<div class="col" data-stage="' + s.id + '"><div class="col-head"><strong>' + esc(s.label) + '</strong><span>' +
          leads.length + ' · ' + money(total) + '</span></div>' +
          leads.map(function (l) {
            return '<div class="lead-card" draggable="true" data-id="' + l.id + '"><div class="lc-name">' + esc(l.name || '(no name)') +
              '</div><div class="lc-co">' + esc(l.company) + '</div><div class="lc-meta">' + money(l.value) + '/mo' +
              (l.sequence && l.sequence.status === 'active' ? ' · <span class="pill">in sequence</span>' : '') +
              (l.client && l.client.churnedAt ? ' · <span class="pill bad">churned</span>' : '') + '</div></div>';
          }).join('') + '</div>';
      }).join('') + '</section>';
  }

  // ---------- leads ----------
  function renderLeads() {
    var q = leadFilter.q.toLowerCase();
    var leads = state.leads.filter(function (l) {
      if (leadFilter.stage && l.stage !== leadFilter.stage) return false;
      if (!q) return true;
      return [l.name, l.company, l.email, l.niche, l.source, l.channel].join(' ').toLowerCase().indexOf(q) !== -1;
    });
    return '<div class="toolbar"><button class="primary" data-act="add-lead">+ Lead</button>' +
      '<input id="leadSearch" type="search" placeholder="Search name, company, niche…" value="' + esc(leadFilter.q) + '">' +
      '<select id="leadStage"><option value="">All stages</option>' + stageOptions(leadFilter.stage) + '</select>' +
      '<label class="button">Import CSV<input id="csvFile" type="file" accept=".csv,text/csv" hidden></label>' +
      '<button data-act="export-csv">Export CSV</button></div>' +
      '<p class="muted small">CSV columns recognised: name, company, email, role, website, channel, niche, source, personalization, notes, value, phone, country. Duplicate emails are skipped.</p>' +
      (leads.length ? '<div class="table-wrap"><table class="leads"><thead><tr><th>Name</th><th>Company</th><th>Niche</th><th>Source</th><th>Stage</th><th>Value/mo</th><th>Updated</th></tr></thead><tbody>' +
        leads.map(function (l) {
          return '<tr data-act="open-lead" data-id="' + l.id + '"><td>' + esc(l.name) + '<div class="muted small">' + esc(l.email) + '</div></td><td>' +
            esc(l.company) + '</td><td>' + esc(l.niche) + '</td><td>' + esc(l.source) + '</td><td><span class="stage s-' + l.stage + '">' +
            esc(CRM.stageLabel(l.stage)) + '</span></td><td>' + money(l.value) + '</td><td>' + esc(l.updatedAt) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="muted">No leads match.</p>');
  }

  function leadForm(l) {
    l = l || {};
    function f(name, label, type, ph) {
      return '<label>' + label + '<input name="' + name + '" type="' + (type || 'text') + '" value="' + esc(l[name] == null ? '' : l[name]) +
        '" placeholder="' + esc(ph || '') + '"></label>';
    }
    return '<div class="form-grid">' +
      f('name', 'Name *', 'text', 'Jane Doe') + f('company', 'Company', 'text', 'Acme Consulting') +
      f('email', 'Email', 'email', 'jane@acme.com') + f('role', 'Role', 'text', 'Founder & host') +
      f('channel', 'Podcast / channel', 'text', 'The Acme Growth Show') + f('website', 'Website / channel URL', 'url', 'https://') +
      f('niche', 'Niche', 'text', 'B2B coaching') + f('source', 'Lead source', 'text', 'Cold email, LinkedIn, Referral…') +
      f('value', 'Expected value ($/month)', 'number', String(state.settings.defaultDealValue)) +
      f('country', 'Country', 'text', '') +
      '</div><label>Personalization line (used as {{personalization}} in emails)<textarea name="personalization" rows="2" placeholder="Loved your episode with … — the bit about … was a great take.">' +
      esc(l.personalization) + '</textarea></label>' +
      '<label>Notes<textarea name="notes" rows="3">' + esc(l.notes) + '</textarea></label>';
  }

  function readForm(root) {
    var data = {};
    $$('input[name], textarea[name], select[name]', root).forEach(function (el) { data[el.name] = el.value; });
    return data;
  }

  function addLeadModal() {
    openModal('<h2>New lead</h2>' + leadForm({ value: state.settings.defaultDealValue }) +
      '<label>Stage<select name="stage">' + stageOptions('new') + '</select></label>' +
      '<div class="row end"><button value="cancel" formnovalidate>Cancel</button><button class="primary" data-act="save-new-lead">Save lead</button></div>');
  }

  function leadModal(id) {
    var l = CRM.findLead(state, id);
    if (!l) return;
    var tasks = state.tasks.filter(function (t) { return t.leadId === id; })
      .sort(function (a, b) { return (a.done - b.done) || (a.due < b.due ? -1 : 1); });
    var acts = state.activities.filter(function (a) { return a.leadId === id; }).slice(0, 25);
    var seq = l.sequence;
    openModal('<div class="modal-head"><h2>' + esc(leadName(l)) + '</h2><button value="cancel" class="icon" aria-label="Close">✕</button></div>' +
      '<div class="row"><label class="inline">Stage <select id="stageSel">' + stageOptions(l.stage) + '</select></label>' +
      '<label class="inline">Sequence <select id="seqSel"><option value="">— choose —</option>' + C.SEQUENCES.map(function (s) {
        return '<option value="' + s.id + '">' + esc(s.name) + '</option>';
      }).join('') + '</select></label><button data-act="enroll" data-id="' + id + '">Enroll</button>' +
      (seq && seq.status === 'active' ? '<button data-act="stop-seq" data-id="' + id + '">Stop sequence</button>' : '') + '</div>' +
      (seq ? '<p class="muted small">Sequence: ' + esc((sequence(seq.id) || {}).name || seq.id) + ' — ' + esc(seq.status) + ' (started ' + esc(seq.startedAt) + ')</p>' : '') +
      '<details open><summary>Details</summary>' + leadForm(l) +
      '<div class="row end"><button class="danger" data-act="delete-lead" data-id="' + id + '">Delete</button><button class="primary" data-act="save-lead" data-id="' + id + '">Save details</button></div></details>' +
      '<details open><summary>Follow-ups (' + tasks.filter(function (t) { return !t.done; }).length + ' open)</summary>' +
      (tasks.length ? taskList(tasks, false) : '<p class="muted">No tasks.</p>') +
      '<div class="row"><input id="newTaskTitle" placeholder="Add a manual follow-up…"><input id="newTaskDue" type="date" value="' + CRM.addDays(today(), 1) + '">' +
      '<button data-act="add-task" data-id="' + id + '">Add</button></div></details>' +
      '<details><summary>Activity</summary><ul class="activity">' + acts.map(function (a) {
        return '<li><span class="muted">' + esc(a.at) + '</span> ' + esc(a.text) + '</li>';
      }).join('') + '</ul><div class="row"><input id="noteText" placeholder="Log a note, call outcome…"><button data-act="add-note" data-id="' + id + '">Log</button></div></details>');
    $('#stageSel').addEventListener('change', function (e) {
      CRM.moveStage(state, id, e.target.value, today());
      save(); render(); leadModal(id);
      toast('Moved to ' + CRM.stageLabel(e.target.value) + ' — follow-ups scheduled');
    });
  }

  // ---------- tasks ----------
  function openTasks() {
    var t = today();
    return state.tasks.filter(function (x) { return !x.done && x.due <= t; })
      .sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; });
  }

  function taskList(tasks, showLead) {
    var t = today();
    return '<ul class="tasks">' + tasks.map(function (task) {
      var lead = task.leadId ? CRM.findLead(state, task.leadId) : null;
      var cls = task.done ? 'done' : task.due < t ? 'overdue' : task.due === t ? 'due' : '';
      return '<li class="' + cls + '"><div><span class="ttype">' + esc(task.type) + '</span> ' + esc(task.title) +
        (showLead && lead ? ' — <a href="#" data-act="open-lead" data-id="' + lead.id + '">' + esc(leadName(lead)) + '</a>' : '') +
        '<div class="muted small">' + (task.done ? 'done ' + esc(task.doneAt) : 'due ' + esc(task.due)) + (task.auto ? ' · automated' : '') + '</div></div>' +
        (task.done ? '' : '<div class="row nowrap">' +
          (task.templateId ? '<button data-act="compose" data-id="' + task.id + '">Write</button>' : '') +
          '<button data-act="snooze" data-id="' + task.id + '" title="Snooze 2 days">+2d</button>' +
          '<button class="primary" data-act="done" data-id="' + task.id + '">Done</button></div>') + '</li>';
    }).join('') + '</ul>';
  }

  function renderTasks() {
    var t = today(), week = CRM.addDays(t, 7);
    var open = state.tasks.filter(function (x) { return !x.done; })
      .sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; });
    var groups = [
      ['Overdue', open.filter(function (x) { return x.due < t; })],
      ['Today', open.filter(function (x) { return x.due === t; })],
      ['Next 7 days', open.filter(function (x) { return x.due > t && x.due <= week; })],
      ['Later', open.filter(function (x) { return x.due > week; })]
    ];
    return '<p class="muted">Follow-ups are created automatically when you enroll a lead in a sequence or move it to a new stage. A reply (moving the lead to "Replied") stops the cold sequence.</p>' +
      groups.map(function (g) {
        return '<section class="card"><h3>' + g[0] + ' <span class="muted">(' + g[1].length + ')</span></h3>' +
          (g[1].length ? taskList(g[1], true) : '<p class="muted">Nothing here.</p>') + '</section>';
      }).join('');
  }

  function composeModal(taskId) {
    var task = state.tasks.filter(function (t) { return t.id === taskId; })[0];
    if (!task) return;
    var lead = CRM.findLead(state, task.leadId) || {};
    var tpl = template(task.templateId);
    if (!tpl) return;
    var subject = CRM.renderTemplate(tpl.subject, lead, state.settings);
    var body = CRM.renderTemplate(tpl.body, lead, state.settings);
    var missing = CRM.missingFields(tpl.subject + '\n' + tpl.body, lead);
    var placeholders = (subject + body).match(/\[[A-Za-z0-9 /+&'.-]{3,}\]/g) || [];
    openModal('<div class="modal-head"><h2>' + esc(tpl.name) + '</h2><button value="cancel" class="icon" aria-label="Close">✕</button></div>' +
      '<p class="muted">To: ' + esc(leadName(lead)) + ' &lt;' + esc(lead.email || 'no email') + '&gt;</p>' +
      (missing.length ? '<p class="warn">Missing on this lead: ' + esc(missing.join(', ')) + '. Fill them in before sending so the email isn\'t generic.</p>' : '') +
      (placeholders.length ? '<p class="warn">Replace before sending: ' + esc(placeholders.filter(function (p, i, a) { return a.indexOf(p) === i; }).join(' ')) + '</p>' : '') +
      '<label>Subject<input id="cSubject" value="' + esc(subject) + '"></label>' +
      '<label>Message<textarea id="cBody" rows="14">' + esc(body) + '</textarea></label>' +
      '<div class="row end"><button data-act="copy-email">Copy</button>' +
      (lead.email ? '<button data-act="mailto" data-email="' + esc(lead.email) + '">Open in email app</button>' : '') +
      '<button class="primary" data-act="done" data-id="' + task.id + '" data-close="1">Mark sent</button></div>');
  }

  // ---------- clients ----------
  function renderClients() {
    var clients = state.leads.filter(function (l) { return l.client; });
    if (!clients.length) return '<p class="muted">No clients yet. Move a lead to "Won" and onboarding starts automatically.</p>';
    return clients.map(function (l) {
      var c = l.client, doneCount = C.ONBOARDING.filter(function (i) { return c.onboarding[i.id]; }).length;
      return '<section class="card client"><div class="row between"><div><h3><a href="#" data-act="open-lead" data-id="' + l.id + '">' +
        esc(leadName(l)) + '</a> ' + (c.churnedAt ? '<span class="pill bad">churned ' + esc(c.churnedAt) + '</span>' : '<span class="pill good">active</span>') +
        '</h3><div class="muted">' + money(l.value) + '/mo · started ' + esc(c.startDate) + ' · term ends ' + esc(c.renewalDate) + '</div></div>' +
        '<div class="row"><label class="inline">Health <select data-act="health" data-id="' + l.id + '">' +
        ['good', 'at risk', 'unhappy'].map(function (h) { return '<option' + (c.health === h ? ' selected' : '') + '>' + h + '</option>'; }).join('') +
        '</select></label>' + (c.churnedAt ? '' : '<button class="danger" data-act="churn" data-id="' + l.id + '">Mark churned</button>') + '</div></div>' +
        '<details' + (doneCount < C.ONBOARDING.length && !c.churnedAt ? ' open' : '') + '><summary>Onboarding ' + doneCount + '/' + C.ONBOARDING.length + '</summary><ul class="checklist">' +
        C.ONBOARDING.map(function (i) {
          return '<li><label><input type="checkbox" data-act="onb" data-id="' + l.id + '" data-item="' + i.id + '"' +
            (c.onboarding[i.id] ? ' checked' : '') + '> ' + esc(i.label) + '</label></li>';
        }).join('') + '</ul></details></section>';
    }).join('');
  }

  // ---------- sales kit ----------
  function renderPlaybook() {
    var sample = { name: 'Jane Doe', company: 'Acme Consulting', channel: 'The Acme Growth Show', niche: 'B2B coaching',
      personalization: 'Your episode on pricing retainers was sharp — the "charge for outcomes" bit is a clip waiting to happen.', value: state.settings.defaultDealValue };
    var groups = {};
    C.TEMPLATES.forEach(function (t) { (groups[t.group] = groups[t.group] || []).push(t); });
    return '<section class="grid2"><div class="card"><h3>Sales call script</h3><ol class="script">' + C.CALL_SCRIPT.map(function (s) {
      return '<li><strong>' + esc(s.step) + '</strong><p>' + esc(s.text) + '</p></li>';
    }).join('') + '</ol></div>' +
      '<div class="card"><h3>Objection handling</h3><dl>' + C.OBJECTIONS.map(function (o) {
        return '<dt>' + esc(o.q) + '</dt><dd>' + esc(o.a) + '</dd>';
      }).join('') + '</dl></div></section>' +
      '<section class="card"><h3>Automation rules</h3><table><thead><tr><th>When a lead enters…</th><th>These follow-ups are scheduled</th></tr></thead><tbody>' +
      Object.keys(CRM.STAGE_RULES).map(function (k) {
        var rules = CRM.STAGE_RULES[k];
        var extra = k === 'won' ? ['Renewal call 14 days before the 3-month term ends'] : [];
        var items = rules.map(function (r) { return 'Day ' + r.day + ': ' + r.title; }).concat(extra);
        return '<tr><td>' + esc(CRM.stageLabel(k)) + '</td><td>' + (items.length ? esc(items.join(' · ')) : '<span class="muted">— (handled by sequences)</span>') + '</td></tr>';
      }).join('') +
      '<tr><td>Sequence enrolment</td><td>' + esc(C.SEQUENCES.map(function (s) {
        return s.name + ': ' + s.steps.map(function (st) { return 'day ' + st.day; }).join(', ');
      }).join(' · ')) + '</td></tr>' +
      '<tr><td>Client churned</td><td>Win-back email after 30 days</td></tr></tbody></table></section>' +
      Object.keys(groups).map(function (g) {
        return '<section class="card"><h3>' + esc(g) + ' templates</h3>' + groups[g].map(function (t) {
          return '<details><summary>' + esc(t.name) + '</summary><p class="muted small">Subject: ' + esc(CRM.renderTemplate(t.subject, sample, state.settings)) +
            '</p><pre>' + esc(CRM.renderTemplate(t.body, sample, state.settings)) + '</pre></details>';
        }).join('') + '</section>';
      }).join('') +
      '<p class="muted small">Previews use a sample lead. Strategy, pricing and the reasoning behind every template are in the <code>playbook/</code> folder of the repo.</p>';
  }

  // ---------- settings ----------
  function renderSettings() {
    var s = state.settings;
    function f(name, label, type) {
      return '<label>' + label + '<input name="' + name + '" type="' + (type || 'text') + '" value="' + esc(s[name]) + '"></label>';
    }
    return '<section class="card"><h3>Your details (fill these first — they go into every template)</h3><div class="form-grid" id="settingsForm">' +
      f('agencyName', 'Agency name') + f('senderName', 'Your name') + f('senderTitle', 'Your title') +
      f('bookingLink', 'Booking link (Calendly / Cal.com)', 'url') + f('portfolioLink', 'Portfolio / showreel link', 'url') +
      f('defaultDealValue', 'Default deal value ($/month)', 'number') +
      '</div><button class="primary" data-act="save-settings">Save settings</button></section>' +
      '<section class="card"><h3>Backup &amp; data</h3><p class="muted">Your data is stored only in this browser. Export a backup weekly, and before clearing browser data or switching computers.</p>' +
      '<div class="row"><button data-act="export-json">Export backup (.json)</button>' +
      '<label class="button">Restore backup<input id="jsonFile" type="file" accept=".json,application/json" hidden></label>' +
      '<button data-act="demo">Load demo data</button><button class="danger" data-act="reset">Erase all data</button></div></section>';
  }

  // ---------- demo data ----------
  function loadDemo() {
    var t = today();
    var d = function (n) { return CRM.addDays(t, n); };
    var mk = function (data, created) { return CRM.createLead(state, Object.assign({ source: 'Cold email' }, data), created); };
    var a = mk({ name: 'Maya Chen', company: 'Northbeam Advisory', email: 'maya@example.com', channel: 'Scale Without Burnout', niche: 'B2B consulting', value: 1997,
      personalization: 'Your episode on firing your first client was brutally honest — that cold open alone would do numbers on LinkedIn.' }, d(-40));
    CRM.enrollSequence(state, a.id, sequence('cold_podcast'), d(-40));
    CRM.moveStage(state, a.id, 'replied', d(-35));
    CRM.moveStage(state, a.id, 'call_booked', d(-33));
    CRM.moveStage(state, a.id, 'proposal', d(-31));
    CRM.moveStage(state, a.id, 'won', d(-28));
    ['contract', 'payment', 'form', 'assets', 'folder', 'kickoff', 'first_delivery'].forEach(function (i) { CRM.setOnboardingItem(state, a.id, i, true); });
    state.tasks.forEach(function (x) { if (x.leadId === a.id && x.due < t) { x.done = true; x.doneAt = x.due; } });

    var b = mk({ name: 'Diego Alvarez', company: 'Ledgerly', email: 'diego@example.com', channel: 'The SaaS CFO Hour', niche: 'SaaS founders', source: 'LinkedIn', value: 3997,
      personalization: 'The bit in your last episode about cutting burn 30% without layoffs is exactly what founders share.' }, d(-12));
    CRM.enrollSequence(state, b.id, sequence('social_dm'), d(-12));
    CRM.moveStage(state, b.id, 'replied', d(-10));
    CRM.moveStage(state, b.id, 'call_booked', d(-8));
    CRM.moveStage(state, b.id, 'proposal', d(-3));
    state.tasks.forEach(function (x) { if (x.leadId === b.id && x.due < d(-3)) { x.done = true; x.doneAt = x.due; } });

    var c = mk({ name: 'Priya Natarajan', company: 'Coach Collective', email: 'priya@example.com', channel: 'Coach to CEO', niche: 'Business coaching', value: 997,
      personalization: 'Loved your guest episode with the ex-McKinsey partner — the 3-question framework is a perfect 45-second clip.' }, d(-4));
    CRM.enrollSequence(state, c.id, sequence('cold_podcast'), d(-4));
    state.tasks.forEach(function (x) { if (x.leadId === c.id && x.due < t) { x.done = true; x.doneAt = x.due; } });

    mk({ name: 'Tom Becker', company: 'Becker Legal Growth', email: 'tom@example.com', channel: 'Law Firm Growth Podcast', niche: 'Legal marketing', source: 'Referral', value: 1997,
      personalization: '' }, t);
    var e = mk({ name: 'Sara Okafor', company: 'Brightpath HR', email: 'sara@example.com', channel: 'People First', niche: 'HR tech', value: 1997 }, d(-50));
    CRM.moveStage(state, e.id, 'contacted', d(-50));
    CRM.moveStage(state, e.id, 'lost', d(-30));
    commit();
    toast('Demo data loaded');
  }

  // ---------- events ----------
  function bindView() {
    var search = $('#leadSearch');
    if (search) search.addEventListener('input', function (e) {
      leadFilter.q = e.target.value;
      var pos = e.target.selectionStart;
      render();
      var s = $('#leadSearch'); s.focus(); s.setSelectionRange(pos, pos);
    });
    var stageF = $('#leadStage');
    if (stageF) stageF.addEventListener('change', function (e) { leadFilter.stage = e.target.value; render(); });
    var csv = $('#csvFile');
    if (csv) csv.addEventListener('change', function (e) {
      readFile(e.target.files[0], function (text) {
        var r = CRM.importCSV(state, text, today());
        commit();
        toast('Imported ' + r.added + ' lead' + (r.added === 1 ? '' : 's') + (r.skipped ? ', skipped ' + r.skipped + ' (duplicate/empty)' : ''));
      });
    });
    var json = $('#jsonFile');
    if (json) json.addEventListener('change', function (e) {
      readFile(e.target.files[0], function (text) {
        try {
          var parsed = JSON.parse(text);
          if (!confirm('Replace ALL current data with this backup?')) return;
          state = CRM.migrate(parsed);
          commit();
          toast('Backup restored');
        } catch (err) { toast('That file is not a valid backup'); }
      });
    });
    // drag & drop on pipeline
    $$('.lead-card').forEach(function (card) {
      card.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', card.dataset.id); });
      card.addEventListener('click', function () { leadModal(card.dataset.id); });
    });
    $$('.col').forEach(function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', function () { col.classList.remove('over'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        col.classList.remove('over');
        var id = e.dataTransfer.getData('text/plain');
        var lead = CRM.findLead(state, id);
        if (lead && lead.stage !== col.dataset.stage) {
          CRM.moveStage(state, id, col.dataset.stage, today());
          commit();
          toast('Moved to ' + CRM.stageLabel(col.dataset.stage) + ' — follow-ups scheduled');
        }
      });
    });
  }

  function readFile(file, cb) {
    if (!file) return;
    var r = new FileReader();
    r.onload = function () { cb(String(r.result)); };
    r.readAsText(file);
  }

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset.act === 'onb') {
      CRM.setOnboardingItem(state, el.dataset.id, el.dataset.item, el.checked);
      commit();
    } else if (el.dataset.act === 'health') {
      var l = CRM.findLead(state, el.dataset.id);
      if (l && l.client) { l.client.health = el.value; commit(); }
    }
  });

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
    var act = el.dataset.act, id = el.dataset.id;
    if (el.tagName === 'A' || el.tagName === 'BUTTON' || el.tagName === 'TR') e.preventDefault();
    switch (act) {
      case 'goto': currentView = el.dataset.view; render(); break;
      case 'add-lead': addLeadModal(); break;
      case 'open-lead': leadModal(id); break;
      case 'save-new-lead': {
        var data = readForm($('#modalBody'));
        if (!data.name.trim()) { toast('Name is required'); return; }
        var dupe = data.email && state.leads.some(function (l) { return l.email && l.email.toLowerCase() === data.email.trim().toLowerCase(); });
        if (dupe && !confirm('A lead with this email already exists. Add anyway?')) return;
        var lead = CRM.createLead(state, data, today());
        commit();
        leadModal(lead.id);
        toast('Lead added');
        break;
      }
      case 'save-lead': {
        var d2 = readForm($('#modalBody details'));
        if (!d2.name.trim()) { toast('Name is required'); return; }
        CRM.updateLead(state, id, d2, today());
        commit(); toast('Saved'); break;
      }
      case 'delete-lead':
        if (confirm('Delete this lead and all its tasks and history?')) { CRM.deleteLead(state, id); closeModal(); commit(); }
        break;
      case 'enroll': {
        var seq = sequence($('#seqSel').value);
        if (!seq) { toast('Choose a sequence first'); return; }
        var lead2 = CRM.findLead(state, id);
        if (lead2 && ['won', 'lost'].indexOf(lead2.stage) !== -1 && !confirm('This lead is ' + CRM.stageLabel(lead2.stage) + '. Enroll anyway?')) return;
        CRM.enrollSequence(state, id, seq, today());
        commit(); leadModal(id); toast('Enrolled — ' + seq.steps.length + ' follow-ups scheduled');
        break;
      }
      case 'stop-seq': CRM.stopSequence(state, id, 'stopped', today()); commit(); leadModal(id); break;
      case 'add-task': {
        var title = $('#newTaskTitle').value.trim(), due = $('#newTaskDue').value || today();
        if (!title) { toast('Describe the follow-up'); return; }
        CRM.addTask(state, { leadId: id, title: title, due: due, type: 'todo' });
        commit(); leadModal(id); break;
      }
      case 'add-note': {
        var note = $('#noteText').value.trim();
        if (!note) return;
        state.activities.unshift({ id: 'act_' + Date.now(), leadId: id, text: note, at: today() });
        var ln = CRM.findLead(state, id); if (ln) ln.updatedAt = today();
        commit(); leadModal(id); break;
      }
      case 'done': {
        var task = state.tasks.filter(function (t) { return t.id === id; })[0];
        CRM.completeTask(state, id, today());
        if (el.dataset.close) closeModal();
        commit();
        if (modal.open && task && task.leadId) leadModal(task.leadId);
        toast('Done');
        break;
      }
      case 'snooze': {
        var tk = state.tasks.filter(function (t) { return t.id === id; })[0];
        CRM.snoozeTask(state, id, 2); commit();
        if (modal.open && tk && tk.leadId) leadModal(tk.leadId);
        break;
      }
      case 'compose': composeModal(id); break;
      case 'copy-email': copy('Subject: ' + $('#cSubject').value + '\n\n' + $('#cBody').value); break;
      case 'mailto':
        window.location.href = 'mailto:' + encodeURIComponent(el.dataset.email) + '?subject=' + encodeURIComponent($('#cSubject').value) +
          '&body=' + encodeURIComponent($('#cBody').value);
        break;
      case 'churn':
        if (confirm('Mark this client as churned? Pending client tasks are cancelled and a win-back email is scheduled for 30 days out.')) {
          CRM.churnClient(state, id, today()); commit();
        }
        break;
      case 'save-settings': {
        var s = readForm($('#settingsForm'));
        s.defaultDealValue = Number(s.defaultDealValue) || 0;
        Object.assign(state.settings, s);
        commit(); toast('Settings saved'); break;
      }
      case 'export-json': download('creativecut-crm-backup-' + today() + '.json', JSON.stringify(state, null, 2), 'application/json'); break;
      case 'export-csv': download('creativecut-leads-' + today() + '.csv', CRM.exportCSV(state), 'text/csv'); break;
      case 'demo':
        if (state.leads.length && !confirm('Add demo leads alongside your existing data?')) return;
        loadDemo(); break;
      case 'reset':
        if (confirm('Erase ALL leads, tasks and settings from this browser? Export a backup first if unsure.')) {
          state = CRM.emptyState(); commit();
        }
        break;
    }
  });

  render();
})();
