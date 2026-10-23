/*
 * Creativecut CRM — pure business logic (no DOM).
 * Loaded as a classic <script> in the browser (exposes window.CRM)
 * and via require() in Node for tests.
 */
(function (root) {
  'use strict';

  var STAGES = [
    { id: 'new', label: 'New lead', probability: 0 },
    { id: 'contacted', label: 'Contacted', probability: 0.05 },
    { id: 'replied', label: 'Replied', probability: 0.15 },
    { id: 'call_booked', label: 'Call booked', probability: 0.3 },
    { id: 'proposal', label: 'Proposal sent', probability: 0.5 },
    { id: 'won', label: 'Won (client)', probability: 1 },
    { id: 'lost', label: 'Lost', probability: 0 }
  ];
  var OPEN_STAGES = ['contacted', 'replied', 'call_booked', 'proposal'];
  var STAGE_ORDER = STAGES.map(function (s) { return s.id; });

  // ---------- dates (YYYY-MM-DD strings, computed in UTC to avoid DST drift) ----------
  function todayISO(now) {
    var d = now ? new Date(now) : new Date();
    var y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
    return y + '-' + pad(m) + '-' + pad(day);
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parseISO(s) {
    var p = String(s).split('-').map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]);
  }
  function fmtUTC(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function addDays(iso, n) { return fmtUTC(parseISO(iso) + n * 86400000); }
  function addMonths(iso, n) {
    var p = iso.split('-').map(Number);
    var y = p[0], m = p[1] - 1 + n, d = p[2];
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return fmtUTC(Date.UTC(y, m, Math.min(d, last)));
  }
  function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }

  // ---------- ids ----------
  var counter = 0;
  function uid(prefix) {
    counter += 1;
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + counter.toString(36) +
      Math.random().toString(36).slice(2, 6);
  }

  // ---------- state ----------
  function emptyState() {
    return {
      version: 1,
      settings: {
        agencyName: 'Creativecut',
        senderName: '',
        senderTitle: 'Founder',
        bookingLink: '',
        portfolioLink: '',
        defaultDealValue: 1997
      },
      leads: [],
      tasks: [],
      activities: []
    };
  }

  function migrate(state) {
    var base = emptyState();
    if (!state || typeof state !== 'object') return base;
    var s = {
      version: 1,
      settings: Object.assign({}, base.settings, state.settings || {}),
      leads: Array.isArray(state.leads) ? state.leads : [],
      tasks: Array.isArray(state.tasks) ? state.tasks : [],
      activities: Array.isArray(state.activities) ? state.activities : []
    };
    s.leads.forEach(function (l) {
      if (!Array.isArray(l.history)) l.history = [{ stage: l.stage || 'new', at: l.createdAt || todayISO() }];
      if (STAGE_ORDER.indexOf(l.stage) === -1) l.stage = 'new';
    });
    return s;
  }

  function findLead(state, id) {
    for (var i = 0; i < state.leads.length; i++) if (state.leads[i].id === id) return state.leads[i];
    return null;
  }

  function log(state, leadId, text, date) {
    state.activities.unshift({ id: uid('act'), leadId: leadId, text: text, at: date });
  }

  var LEAD_FIELDS = ['name', 'company', 'email', 'role', 'website', 'channel', 'niche', 'source',
    'personalization', 'notes', 'phone', 'country'];

  function createLead(state, data, today) {
    today = today || todayISO();
    var lead = { id: uid('lead'), stage: 'new', createdAt: today, updatedAt: today, value: 0 };
    LEAD_FIELDS.forEach(function (f) { lead[f] = data[f] ? String(data[f]).trim() : ''; });
    var v = Number(data.value);
    lead.value = isFinite(v) && v > 0 ? v : Number(state.settings.defaultDealValue) || 0;
    lead.history = [{ stage: 'new', at: today }];
    lead.sequence = null;
    lead.client = null;
    state.leads.push(lead);
    log(state, lead.id, 'Lead created', today);
    if (data.stage && data.stage !== 'new' && STAGE_ORDER.indexOf(data.stage) !== -1) {
      moveStage(state, lead.id, data.stage, today);
    }
    return lead;
  }

  function updateLead(state, id, data, today) {
    var lead = findLead(state, id);
    if (!lead) return null;
    LEAD_FIELDS.forEach(function (f) { if (f in data) lead[f] = String(data[f] || '').trim(); });
    if ('value' in data) {
      var v = Number(data.value);
      lead.value = isFinite(v) && v >= 0 ? v : lead.value;
    }
    lead.updatedAt = today || todayISO();
    return lead;
  }

  function deleteLead(state, id) {
    state.leads = state.leads.filter(function (l) { return l.id !== id; });
    state.tasks = state.tasks.filter(function (t) { return t.leadId !== id; });
    state.activities = state.activities.filter(function (a) { return a.leadId !== id; });
  }

  // ---------- tasks ----------
  function addTask(state, t) {
    var task = {
      id: uid('task'),
      leadId: t.leadId || null,
      type: t.type || 'todo',
      title: t.title,
      due: t.due,
      templateId: t.templateId || null,
      auto: !!t.auto,
      group: t.group || null,
      done: false,
      doneAt: null
    };
    state.tasks.push(task);
    return task;
  }

  /** Remove pending automated tasks for a lead (optionally only one group). Manual and done tasks are kept. */
  function cancelAutoTasks(state, leadId, group) {
    state.tasks = state.tasks.filter(function (t) {
      if (t.leadId !== leadId || t.done || !t.auto) return true;
      if (group && t.group !== group) return true;
      return false;
    });
  }

  function completeTask(state, taskId, today) {
    today = today || todayISO();
    var task = null;
    state.tasks.forEach(function (t) { if (t.id === taskId) task = t; });
    if (!task || task.done) return task;
    task.done = true;
    task.doneAt = today;
    if (task.leadId) {
      log(state, task.leadId, 'Done: ' + task.title, today);
      var lead = findLead(state, task.leadId);
      if (lead) lead.updatedAt = today;
    }
    return task;
  }

  function snoozeTask(state, taskId, days) {
    state.tasks.forEach(function (t) { if (t.id === taskId && !t.done) t.due = addDays(t.due, days); });
  }

  // ---------- sequences ----------
  function enrollSequence(state, leadId, sequence, today) {
    today = today || todayISO();
    var lead = findLead(state, leadId);
    if (!lead || !sequence) return null;
    cancelAutoTasks(state, leadId, 'sequence');
    lead.sequence = { id: sequence.id, startedAt: today, status: 'active' };
    sequence.steps.forEach(function (step, i) {
      addTask(state, {
        leadId: leadId,
        type: step.type || 'email',
        title: sequence.name + ' — step ' + (i + 1) + ': ' + step.label,
        due: addDays(today, step.day),
        templateId: step.templateId,
        auto: true,
        group: 'sequence'
      });
    });
    log(state, leadId, 'Enrolled in sequence "' + sequence.name + '"', today);
    if (lead.stage === 'new') moveStage(state, leadId, 'contacted', today);
    return lead.sequence;
  }

  function stopSequence(state, leadId, reason, today) {
    var lead = findLead(state, leadId);
    if (!lead || !lead.sequence || lead.sequence.status !== 'active') return;
    lead.sequence.status = reason || 'stopped';
    cancelAutoTasks(state, leadId, 'sequence');
    log(state, leadId, 'Sequence stopped (' + lead.sequence.status + ')', today || todayISO());
  }

  // ---------- stage automation ----------
  /**
   * Rules fired when a lead enters a stage. Each returns tasks relative to `today`.
   * Kept as data so the UI can show users exactly what will happen.
   */
  var STAGE_RULES = {
    contacted: [],
    replied: [
      { day: 0, type: 'email', title: 'Reply within 1 hour and offer 2 call times', templateId: 'reply_book_call' }
    ],
    call_booked: [
      { day: 0, type: 'todo', title: 'Prep call: watch 2 of their videos, fill call-prep notes' },
      { day: 0, type: 'email', title: 'Send call confirmation + agenda', templateId: 'call_confirm' }
    ],
    proposal: [
      { day: 2, type: 'email', title: 'Proposal follow-up #1 (questions?)', templateId: 'proposal_fu_1' },
      { day: 5, type: 'email', title: 'Proposal follow-up #2 (free sample clip)', templateId: 'proposal_fu_2' },
      { day: 9, type: 'email', title: 'Proposal follow-up #3 (close the loop)', templateId: 'proposal_fu_3' }
    ],
    won: [
      { day: 0, type: 'email', title: 'Send welcome email + onboarding form', templateId: 'onboard_welcome' },
      { day: 0, type: 'todo', title: 'Send invoice / start subscription billing' },
      { day: 2, type: 'call', title: 'Kickoff call (30 min): goals, style, access' },
      { day: 7, type: 'todo', title: 'Deliver first batch of edits' },
      { day: 14, type: 'email', title: '2-week check-in', templateId: 'checkin_2w' },
      { day: 45, type: 'email', title: 'Ask for testimonial + referral', templateId: 'referral_ask' },
      { day: 60, type: 'email', title: 'Request case-study permission + metrics', templateId: 'case_study_ask' }
    ],
    lost: [
      { day: 90, type: 'email', title: 'Re-engage lost lead', templateId: 'reengage_lost' }
    ]
  };

  function moveStage(state, leadId, stage, today) {
    today = today || todayISO();
    var lead = findLead(state, leadId);
    if (!lead || STAGE_ORDER.indexOf(stage) === -1 || lead.stage === stage) return lead;
    var from = lead.stage;
    lead.stage = stage;
    lead.updatedAt = today;
    lead.history.push({ stage: stage, at: today });
    log(state, leadId, 'Stage: ' + stageLabel(from) + ' → ' + stageLabel(stage), today);

    // Any reply or later movement ends the cold sequence; stage tasks from earlier stages are replaced.
    if (stage !== 'contacted') stopSequence(state, leadId, stage === 'lost' ? 'lost' : 'replied', today);
    cancelAutoTasks(state, leadId, 'stage');

    if (stage === 'won') {
      var term = 3;
      lead.client = lead.client && !lead.client.churnedAt ? lead.client : {
        startDate: today,
        termMonths: term,
        renewalDate: addMonths(today, term),
        onboarding: {},
        health: 'good',
        churnedAt: null
      };
      addTask(state, {
        leadId: leadId, type: 'call', auto: true, group: 'stage',
        title: 'Renewal call: show results, propose next term / upsell',
        due: addDays(lead.client.renewalDate, -14), templateId: 'renewal'
      });
    }

    (STAGE_RULES[stage] || []).forEach(function (r) {
      addTask(state, {
        leadId: leadId, type: r.type, title: r.title, templateId: r.templateId,
        due: addDays(today, r.day), auto: true, group: 'stage'
      });
    });
    return lead;
  }

  function churnClient(state, leadId, today) {
    today = today || todayISO();
    var lead = findLead(state, leadId);
    if (!lead || !lead.client || lead.client.churnedAt) return;
    lead.client.churnedAt = today;
    cancelAutoTasks(state, leadId);
    addTask(state, {
      leadId: leadId, type: 'email', auto: true, group: 'stage', templateId: 'winback',
      title: 'Win-back offer', due: addDays(today, 30)
    });
    log(state, leadId, 'Client churned', today);
  }

  function setOnboardingItem(state, leadId, itemId, done) {
    var lead = findLead(state, leadId);
    if (!lead || !lead.client) return;
    lead.client.onboarding[itemId] = !!done;
  }

  // ---------- templates ----------
  function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || 'there'; }

  function renderTemplate(text, lead, settings) {
    lead = lead || {};
    settings = settings || {};
    var vars = {
      first_name: firstName(lead.name),
      name: lead.name || '',
      company: lead.company || 'your brand',
      channel: lead.channel || 'your channel',
      niche: lead.niche || 'your space',
      personalization: lead.personalization || '',
      role: lead.role || '',
      value: lead.value ? '$' + Number(lead.value).toLocaleString('en-US') : '',
      sender_name: settings.senderName || '[Your name]',
      sender_title: settings.senderTitle || '',
      agency: settings.agencyName || 'Creativecut',
      booking_link: settings.bookingLink || '[booking link]',
      portfolio_link: settings.portfolioLink || '[portfolio link]'
    };
    return String(text).replace(/\{\{\s*(\w+)\s*\}\}/g, function (m, key) {
      return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : m;
    });
  }

  /** Lists merge fields a template needs that this lead is missing (so no email goes out with blanks). */
  function missingFields(text, lead) {
    var need = { first_name: 'name', company: 'company', channel: 'channel', personalization: 'personalization', niche: 'niche' };
    var missing = [];
    String(text).replace(/\{\{\s*(\w+)\s*\}\}/g, function (m, key) {
      var f = need[key];
      if (f && !(lead && String(lead[f] || '').trim()) && missing.indexOf(f) === -1) missing.push(f);
      return m;
    });
    return missing;
  }

  // ---------- metrics ----------
  function reached(lead, stage) {
    var idx = STAGE_ORDER.indexOf(stage);
    return lead.history.some(function (h) {
      var i = STAGE_ORDER.indexOf(h.stage);
      return h.stage === stage || (i > idx && h.stage !== 'lost');
    });
  }

  function computeMetrics(state, today) {
    today = today || todayISO();
    var leads = state.leads;
    var byStage = {};
    STAGES.forEach(function (s) { byStage[s.id] = 0; });
    leads.forEach(function (l) { byStage[l.stage] += 1; });

    var probability = {};
    STAGES.forEach(function (s) { probability[s.id] = s.probability; });

    var pipelineValue = 0, weightedPipeline = 0;
    leads.forEach(function (l) {
      if (OPEN_STAGES.indexOf(l.stage) !== -1) {
        pipelineValue += l.value || 0;
        weightedPipeline += (l.value || 0) * probability[l.stage];
      }
    });

    var clients = leads.filter(function (l) { return l.client; });
    var active = clients.filter(function (l) { return l.stage === 'won' && !l.client.churnedAt; });
    var churned = clients.filter(function (l) { return l.client.churnedAt; });
    var mrr = active.reduce(function (sum, l) { return sum + (l.value || 0); }, 0);

    var funnel = ['contacted', 'replied', 'call_booked', 'proposal', 'won'].map(function (s) {
      return { stage: s, label: stageLabel(s), count: leads.filter(function (l) { return reached(l, s); }).length };
    });
    function rate(a, b) { return b ? a / b : null; }
    var f = {};
    funnel.forEach(function (x) { f[x.stage] = x.count; });

    // Anyone who ever became a client counts as a win, even if they churned later.
    var won = clients.length;
    var closed = won + leads.filter(function (l) { return l.stage === 'lost' && !l.client; }).length;

    var sources = {};
    leads.forEach(function (l) {
      var k = l.source || 'Unknown';
      if (!sources[k]) sources[k] = { source: k, leads: 0, won: 0, mrr: 0 };
      sources[k].leads += 1;
      if (l.client) { sources[k].won += 1; if (!l.client.churnedAt && l.stage === 'won') sources[k].mrr += l.value || 0; }
    });

    var open = state.tasks.filter(function (t) { return !t.done; });
    var renewals = active.filter(function (l) {
      var d = daysBetween(today, l.client.renewalDate);
      return d >= 0 && d <= 30;
    });

    return {
      totalLeads: leads.length,
      byStage: byStage,
      pipelineValue: pipelineValue,
      weightedPipeline: Math.round(weightedPipeline),
      mrr: mrr,
      arr: mrr * 12,
      activeClients: active.length,
      churnedClients: churned.length,
      churnRate: rate(churned.length, clients.length),
      avgDeal: active.length ? Math.round(mrr / active.length) : 0,
      winRate: rate(won, closed),
      replyRate: rate(f.replied, f.contacted),
      callRate: rate(f.call_booked, f.replied),
      closeRate: rate(f.won, f.proposal),
      funnel: funnel,
      sources: Object.keys(sources).map(function (k) { return sources[k]; })
        .sort(function (a, b) { return b.mrr - a.mrr || b.won - a.won || b.leads - a.leads; }),
      tasksToday: open.filter(function (t) { return t.due === today; }).length,
      tasksOverdue: open.filter(function (t) { return t.due < today; }).length,
      renewalsSoon: renewals.map(function (l) { return { id: l.id, name: l.company || l.name, date: l.client.renewalDate, value: l.value }; }),
      staleDeals: leads.filter(function (l) {
        return OPEN_STAGES.indexOf(l.stage) !== -1 && daysBetween(l.updatedAt, today) >= 14;
      }).map(function (l) { return { id: l.id, name: l.company || l.name, days: daysBetween(l.updatedAt, today) }; })
    };
  }

  function stageLabel(id) {
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return STAGES[i].label;
    return id;
  }

  // ---------- CSV ----------
  function parseCSV(text) {
    var rows = [], row = [], field = '', inQuotes = false;
    text = String(text).replace(/^﻿/, '');
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
        } else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(function (x) { return x !== ''; })) rows.push(row);
        row = [];
      } else field += c;
    }
    row.push(field);
    if (row.some(function (x) { return x !== ''; })) rows.push(row);
    return rows;
  }

  var HEADER_ALIASES = {
    name: ['name', 'full name', 'contact', 'contact name', 'first name'],
    company: ['company', 'brand', 'organization', 'business', 'company name'],
    email: ['email', 'email address', 'e-mail'],
    role: ['role', 'title', 'job title', 'position'],
    website: ['website', 'url', 'site', 'domain'],
    channel: ['channel', 'youtube', 'podcast', 'channel url', 'instagram', 'tiktok'],
    niche: ['niche', 'industry', 'category'],
    source: ['source', 'lead source'],
    personalization: ['personalization', 'personalisation', 'hook', 'icebreaker', 'first line'],
    notes: ['notes', 'note', 'comments'],
    value: ['value', 'deal value', 'mrr', 'amount'],
    phone: ['phone', 'phone number'],
    country: ['country', 'location']
  };

  function importCSV(state, text, today) {
    var rows = parseCSV(text);
    if (rows.length < 2) return { added: 0, skipped: 0 };
    var header = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var map = {};
    Object.keys(HEADER_ALIASES).forEach(function (field) {
      var idx = -1;
      HEADER_ALIASES[field].some(function (alias) { idx = header.indexOf(alias); return idx !== -1; });
      if (idx !== -1) map[field] = idx;
    });
    var existing = {};
    state.leads.forEach(function (l) { if (l.email) existing[l.email.toLowerCase()] = true; });
    var added = 0, skipped = 0;
    rows.slice(1).forEach(function (r) {
      var data = {};
      Object.keys(map).forEach(function (f) { data[f] = (r[map[f]] || '').trim(); });
      var email = (data.email || '').toLowerCase();
      if ((!data.name && !data.company && !email) || (email && existing[email])) { skipped++; return; }
      if (email) existing[email] = true;
      createLead(state, data, today);
      added++;
    });
    return { added: added, skipped: skipped };
  }

  function csvCell(v) {
    var s = v == null ? '' : String(v);
    // Neutralise spreadsheet formula injection.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCSV(state) {
    var cols = ['name', 'company', 'email', 'role', 'website', 'channel', 'niche', 'source', 'stage',
      'value', 'personalization', 'notes', 'createdAt', 'updatedAt'];
    var lines = [cols.join(',')];
    state.leads.forEach(function (l) {
      lines.push(cols.map(function (c) { return csvCell(c === 'stage' ? stageLabel(l.stage) : l[c]); }).join(','));
    });
    return lines.join('\n');
  }

  var CRM = {
    STAGES: STAGES, OPEN_STAGES: OPEN_STAGES, STAGE_RULES: STAGE_RULES,
    todayISO: todayISO, addDays: addDays, addMonths: addMonths, daysBetween: daysBetween,
    emptyState: emptyState, migrate: migrate, findLead: findLead, stageLabel: stageLabel,
    createLead: createLead, updateLead: updateLead, deleteLead: deleteLead,
    addTask: addTask, completeTask: completeTask, snoozeTask: snoozeTask, cancelAutoTasks: cancelAutoTasks,
    enrollSequence: enrollSequence, stopSequence: stopSequence, moveStage: moveStage,
    churnClient: churnClient, setOnboardingItem: setOnboardingItem,
    renderTemplate: renderTemplate, missingFields: missingFields,
    computeMetrics: computeMetrics, parseCSV: parseCSV, importCSV: importCSV, exportCSV: exportCSV
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CRM;
  else root.CRM = CRM;
})(typeof window !== 'undefined' ? window : this);
