/* Creative Cut Founder OS — core: dates, formatting, constants, seed data, derived model.
   Every number the UI shows is computed here from records the founder entered. */
(function () {
  const CC = (window.CC = window.CC || {});
  const pad = (n) => String(n).padStart(2, '0');

  /* ---------- dates (YYYY-MM-DD strings, local time) ---------- */
  const D = {
    ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; },
    parse(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); },
    add(s, n) { const d = D.parse(s); d.setDate(d.getDate() + n); return D.ymd(d); },
    today() { return D.ymd(new Date()); },
    range(a, b) { const o = []; if (!a || !b) return o; let s = a, g = 0; while (s <= b && g < 800) { o.push(s); s = D.add(s, 1); g++; } return o; },
    week(s) { const d = D.parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return D.ymd(d); },
    diff(a, b) { return Math.round((D.parse(b) - D.parse(a)) / 86400000); },
    fmt(s, opt) { if (!s) return '—'; return D.parse(s).toLocaleDateString('en-IN', opt || { day: 'numeric', month: 'short' }); },
    long(s) { return D.fmt(s, { weekday: 'short', day: 'numeric', month: 'short' }); },
    dow(s) { return D.parse(s).toLocaleDateString('en-IN', { weekday: 'short' }); },
    month(s) { return String(s || '').slice(0, 7); },
    monthName(m) { return D.parse(m + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); },
    ago(ts) {
      if (!ts) return 'never';
      const s = Math.round((Date.now() - ts) / 1000);
      if (s < 45) return 'just now';
      if (s < 3600) return Math.round(s / 60) + ' min ago';
      if (s < 86400) return Math.round(s / 3600) + ' h ago';
      return new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    },
  };

  /* ---------- numbers ---------- */
  const inrF = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  const numF = new Intl.NumberFormat('en-IN');
  const has = (v) => v !== null && v !== undefined && v !== '' && !isNaN(+v);
  const n = (v) => (has(v) ? +v : 0);
  const sum = (arr, f) => arr.reduce((a, x) => a + n(f ? f(x) : x), 0);
  const div = (a, b) => (b > 0 && has(a) ? a / b : null);
  const F = {
    inr: (v) => (has(v) ? inrF.format(+v) : '—'),
    inr2: (v) => (has(v) ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(+v) : '—'),
    num: (v) => (has(v) ? numF.format(Math.round(+v * 10) / 10) : '—'),
    pct: (v, dp = 1) => (v == null || !isFinite(v) ? '—' : (v * 100).toFixed(dp) + '%'),
    x: (v) => (v == null || !isFinite(v) ? '—' : v.toFixed(2) + '×'),
  };
  const uid = (p = 'r') => p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

  /* ---------- constants ---------- */
  const STATUSES = ['Backlog', 'Brief Ready', 'Editing', 'Internal QC', 'Client Review', 'Revision Required', 'Approved', 'Delivered'];
  const ALL_STATUSES = [...STATUSES, 'Blocked'];
  const QC_ITEMS = [
    ['brief', 'Matches brief and topic'], ['hook', 'Hook and pacing reviewed'], ['audio', 'Audio levels clean'],
    ['captions', 'Captions accurate, no typos'], ['color', 'Colour and exposure consistent'],
    ['brand', 'Brand elements and CTA correct'], ['export', 'Export specs and aspect ratio'],
  ];
  const COMPLEXITY = { simple: { label: 'Simple (~1.5 h)', hours: 1.5 }, standard: { label: 'Standard (~3 h)', hours: 3 }, complex: { label: 'Complex (~6 h)', hours: 6 } };
  const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
  const PRI_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const TASK_STATUS = ['To do', 'In progress', 'Blocked', 'Done'];
  const TASK_KINDS = ['Top priority', 'Founder', 'Delegated', 'Client delivery'];
  const SPRINT_START = '2026-11-07', SPRINT_END = '2026-11-15';

  /* ---------- seed: only known configuration, names, targets, dates and planning tasks ---------- */
  function seed() {
    const now = Date.now();
    const roles = [
      { id: 'founder', title: 'Founder / Creative Director', responsibilities: 'Sales, strategy, product, creative direction, final quality calls.' },
      { id: 'pm', title: 'PM / Coordinator', responsibilities: 'Client communication, briefs, task assignment, follow-ups, deadline management.' },
      { id: 'senior', title: 'Senior Editor', responsibilities: 'Complex edits, internal QC, junior editor guidance.' },
      { id: 'junior', title: 'Junior Editor', responsibilities: 'Assigned production work and self-review before QC.' },
      { id: 'outreach', title: 'Outreach', responsibilities: 'Lead research, personalised contact, CRM updates.' },
    ];
    const team = [{ id: 'm_hemant', name: 'Hemant', roleIds: ['founder'], clientIds: ['c_mehak', 'c_maya', 'c_suri'], capacityHours: 3, workDays: 6, active: true, contact: '', notes: [] }];
    const clients = [
      { id: 'c_mehak', name: 'Mehak', company: '', status: 'Active', cadence: 'daily', minPerPeriod: 1, stretchPerPeriod: 2, configured: true,
        projectType: 'Short-form videos', contractValue: null, pricePerVideo: null, editorPoolPct: 70, frequencyNote: '1–2 videos per day',
        expectedOutputs: '', poc: '', pendingAssets: '', paymentTerms: '', nonWorkingDates: '', weekTargets: {}, notes: '' },
      { id: 'c_maya', name: 'Maya', company: 'Mantis India', status: 'Active', cadence: 'weekly', minPerPeriod: 1, stretchPerPeriod: 2, configured: true,
        projectType: 'Videos', contractValue: null, pricePerVideo: null, editorPoolPct: 70, frequencyNote: '1–2 videos per week. Weekday deadline not confirmed.',
        expectedOutputs: '', poc: 'Maya', pendingAssets: '', paymentTerms: '', nonWorkingDates: '', weekTargets: {}, notes: '' },
      { id: 'c_suri', name: 'Suri', company: '', status: 'Onboarding', cadence: 'unconfigured', minPerPeriod: null, stretchPerPeriod: null, configured: false,
        projectType: '', contractValue: null, pricePerVideo: null, editorPoolPct: 70, frequencyNote: '', expectedOutputs: '', poc: '',
        pendingAssets: '', paymentTerms: '', nonWorkingDates: '', weekTargets: {}, notes: 'Scope, frequency, financials and deadlines not yet confirmed.' },
    ];

    const days = [
      ['2026-11-07', 'Audit and first outreach', 'Business audit, client backlog, cash review, checkout testing, product demo and first personalised outreach.', 'Backlog fully listed · checkout verified end to end · 10 personalised messages sent · Mehak ≥1 video delivered'],
      ['2026-11-08', 'Tracking, then paid test', 'Prepare and verify Meta tracking, start the paid experiment only if checkout works, continue delivery and outreach.', 'Purchase event verified (Y/N) · campaign live only if verified · 20 total outreach'],
      ['2026-11-09', 'Team operating rhythm', 'Define responsibilities, production SOPs, delivery ownership, daily reporting and project visibility.', 'SOP shared · every open deliverable has owner + due date · daily report from each member'],
      ['2026-11-10', 'Customer interviews', 'Interview potential product users, identify objections, pursue service pilots, review funnel performance.', '3 user interviews · 3 pilot pitches · funnel reviewed'],
      ['2026-11-11', 'Second creative + page fixes', 'Test a second ad creative, optimise the landing page, track trials, clear delivery bottlenecks.', 'Creative B live (if A tracked correctly) · page updated · no item blocked >24 h'],
      ['2026-11-12', 'Pipeline and closing', 'Build the sales pipeline, practise closing and objections, send tailored outreach and proposals.', 'Every lead has stage + follow-up · 2 proposals sent · 10 tailored messages'],
      ['2026-11-13', 'Tutorial and distribution', 'Create a useful YouTube tutorial, repurpose shorts, organic distribution and creator partnerships.', 'Tutorial published · 3 shorts cut · 5 creators contacted'],
      ['2026-11-14', 'Launch validation and collection', 'Launch validation, customer support, follow-ups, payment collection, paid pilot closing attempts.', 'All support replied same day · every open proposal followed up · pending payments chased'],
      ['2026-11-15', 'Reconcile and plan', 'Revenue reconciliation, ROI evaluation, client and team review, next 30-day roadmap.', 'Cash reconciled to records · ad decision made · 30-day roadmap written'],
    ];
    const sprintDays = days.map(([date, theme, focus, targetKPIs], i) => ({ day: i + 1, date, theme, focus, targetKPIs, actualKPIs: '', blockers: '', notes: '' }));

    const T = [];
    const t = (day, kind, title, owner, estMins, extra = {}) => T.push({
      id: 'st_' + day + '_' + (T.length + 1), title, owner, status: 'To do', priority: kind === 'Top priority' ? 'High' : 'Medium',
      dueDate: days[day - 1][0], originalDueDate: days[day - 1][0], category: 'Sprint', sprintDay: day, kind, estMins,
      cost: null, actualCost: null, dependency: '', blocker: '', evidence: '', notes: '', carryCount: 0, completedDate: null, ...extra,
    });
    // Day 1
    t(1, 'Top priority', 'Audit client backlog: log every open Mehak, Maya and Suri deliverable in Production', 'm_hemant', 60);
    t(1, 'Top priority', 'Cash review: record pending invoices and every payment already received', 'm_hemant', 45);
    t(1, 'Top priority', 'Test Creative Captions checkout end to end (trial, paid, coupon, licence email)', 'm_hemant', 45);
    t(1, 'Founder', 'Record a 2-minute product demo of Creative Captions', 'm_hemant', 90);
    t(1, 'Founder', 'Send first 10 personalised outreach messages and log each lead in CRM', 'm_hemant', 60, { dependency: 'Prospect list in CRM' });
    t(1, 'Delegated', 'Confirm Mehak topics and assets for Nov 7–9', 'role:pm', 30);
    t(1, 'Delegated', 'Research 15 prospect profiles into CRM (public profile + pain point)', 'role:outreach', 120);
    // Day 2
    t(2, 'Top priority', 'Verify Meta Pixel and Purchase event with a real test purchase', 'm_hemant', 60, { dependency: 'Checkout verified (Day 1)' });
    t(2, 'Top priority', 'Launch Sales campaign at ₹300/day — only if checkout and Purchase event are verified', 'm_hemant', 45, { dependency: 'Purchase event verified', cost: 300 });
    t(2, 'Top priority', 'Write two ad creatives (hook-led screen recordings)', 'm_hemant', 120);
    t(2, 'Founder', 'Send 10 more personalised outreach messages', 'm_hemant', 60);
    t(2, 'Delegated', 'Export ad creatives in 4:5 and 9:16', 'role:senior', 90);
    t(2, 'Delegated', 'Add 15 qualified prospects to CRM', 'role:outreach', 120);
    // Day 3
    t(3, 'Top priority', 'Write role responsibilities and a delivery owner for every client', 'm_hemant', 60);
    t(3, 'Top priority', 'Draft production SOP: brief → edit → QC → client review → delivery', 'm_hemant', 90);
    t(3, 'Top priority', 'Start the daily team report (5 questions) in Meetings & Reviews', 'role:pm', 30);
    t(3, 'Founder', 'Run a 20-minute team kickoff on the new operating rhythm', 'm_hemant', 30);
    t(3, 'Founder', 'Clear all outreach follow-ups due today', 'm_hemant', 45);
    t(3, 'Delegated', 'Apply the QC checklist to every open video', 'role:senior', 60);
    t(3, 'Delegated', 'Add 10 qualified prospects to CRM', 'role:outreach', 90);
    // Day 4
    t(4, 'Top priority', 'Interview 3 After Effects editors about their captioning workflow', 'm_hemant', 90);
    t(4, 'Top priority', 'Write the top objections from interviews and trial users', 'm_hemant', 30);
    t(4, 'Top priority', 'Pitch the Two-Reel Retention Pilot to 3 warm leads', 'm_hemant', 60);
    t(4, 'Founder', 'Review funnel: visits → trials → purchases, and ad spend so far', 'm_hemant', 30);
    t(4, 'Delegated', 'Schedule interviews with trial users', 'role:pm', 45);
    t(4, 'Delegated', 'Clear any blocked deliverables', 'role:senior', 60);
    // Day 5
    t(5, 'Top priority', 'Launch second ad creative — only if creative A is tracking correctly', 'm_hemant', 45, { dependency: 'Creative A tracking verified' });
    t(5, 'Top priority', 'Update the product landing page from interview objections', 'm_hemant', 120);
    t(5, 'Top priority', 'Clear delivery bottlenecks: nothing blocked longer than 24 h', 'role:pm', 45);
    t(5, 'Founder', 'Log trial cohort conversions for Nov 8–10 signups', 'm_hemant', 20);
    t(5, 'Delegated', 'Edit creative B', 'role:senior', 90);
    t(5, 'Delegated', 'Follow up every lead that replied', 'role:outreach', 60);
    // Day 6
    t(6, 'Top priority', 'Clean pipeline: every lead has stage, value and follow-up date', 'm_hemant', 60);
    t(6, 'Top priority', 'Practise closing and objection handling (record it)', 'm_hemant', 30);
    t(6, 'Top priority', 'Send 2 tailored proposals (pilot or monthly support)', 'm_hemant', 90);
    t(6, 'Founder', 'Send 10 tailored outreach messages', 'm_hemant', 60);
    t(6, 'Delegated', 'Prepare portfolio links per niche', 'role:pm', 60);
    t(6, 'Delegated', 'Add 10 qualified prospects to CRM', 'role:outreach', 90);
    // Day 7
    t(7, 'Top priority', 'Record a YouTube tutorial: captions workflow in After Effects with Creative Captions', 'm_hemant', 180);
    t(7, 'Top priority', 'Cut 3 shorts from the tutorial', 'role:junior', 120);
    t(7, 'Top priority', 'Contact 5 creators about partnership or affiliate', 'm_hemant', 60);
    t(7, 'Founder', 'Publish the tutorial with the product link pinned', 'm_hemant', 30);
    t(7, 'Delegated', 'Thumbnail and upload for tutorial and shorts', 'role:junior', 60);
    // Day 8
    t(8, 'Top priority', 'Validate launch: checkout, licence delivery, install guide', 'm_hemant', 45);
    t(8, 'Top priority', 'Follow up every open proposal and pilot', 'm_hemant', 60);
    t(8, 'Top priority', 'Chase pending client payments with reminders', 'role:pm', 45);
    t(8, 'Founder', 'Answer every support issue the same day', 'm_hemant', 45);
    t(8, 'Founder', 'Closing attempts on paid pilots', 'm_hemant', 60);
    t(8, 'Delegated', 'Log support issues and install failures in Product', 'role:pm', 30);
    // Day 9
    t(9, 'Top priority', 'Revenue reconciliation: payments vs invoices vs product sales', 'm_hemant', 60);
    t(9, 'Top priority', 'Ads ROI evaluation and decision (continue / investigate / pause)', 'm_hemant', 30);
    t(9, 'Top priority', 'Write the next 30-day roadmap', 'm_hemant', 60);
    t(9, 'Founder', 'Client performance review: Mehak, Maya, Suri', 'm_hemant', 45);
    t(9, 'Founder', 'Team review: on-time %, revisions, blockers', 'm_hemant', 45);
    t(9, 'Delegated', 'Prepare the sprint delivery report', 'role:pm', 45);

    const speech = [
      'Founder introduction', 'Service pitch', 'Team leadership', 'Product explanation', 'Sales pitch',
      'Objection handling', 'Tutorial presentation', 'Discovery call', 'Founder strategy presentation',
    ].map((topic, i) => ({ id: 'sp_' + (i + 1), date: days[i][0], topic, done: null, mins: null, clarity: null, confidence: null, link: '', improvement: '', next: '' }));

    return {
      meta: { version: 1, createdAt: now, updatedAt: now },
      counters: { deliverable: 0, invoice: 0 },
      settings: { sprintStart: SPRINT_START, sprintEnd: SPRINT_END, sprintBudget: 5000, outreachTarget: 60 },
      roles, team, clients,
      deliverables: [],
      tasks: T,
      sprintDays,
      product: {
        config: {
          name: 'Creative Captions', url: 'https://tools.creativecut.in/captions', styles: 37, languages: 22, sfx: 24,
          trialDays: 7, coupon: 'CREATIVE20', couponPct: 20, refundDays: 14, licenseSeats: 2, proPrice: 699,
          verified: { price: false, coupon: false, trial: false, checkout: false, refund: false, licence: false },
        },
        daily: [], issues: [],
      },
      ads: {
        budget: { media: 3000, reserve: 1000, contingency: 1000 },
        tracking: { pixel: false, purchaseEvent: false, testPurchase: false, checkout: false, utm: false },
        campaigns: [{ id: 'cmp_1', name: 'CC Captions — Sales test', status: 'Draft', objective: 'Sales', conversion: 'Purchase', location: 'India',
          audience: 'After Effects editors and motion designers (hypothesis)', dailyBudget: 300, startDate: '2026-11-08', notes: 'Start no earlier than Nov 8, and only after checkout and Purchase event are verified.' }],
        entries: [],
      },
      crm: {
        stages: [
          { id: 'identified', label: 'Identified', type: 'open' }, { id: 'qualified', label: 'Qualified', type: 'open' },
          { id: 'contacted', label: 'Contacted', type: 'open' }, { id: 'replied', label: 'Replied', type: 'open' },
          { id: 'meeting', label: 'Meeting', type: 'open' }, { id: 'proposal', label: 'Proposal', type: 'open' },
          { id: 'won', label: 'Won', type: 'won' }, { id: 'lost', label: 'Lost', type: 'lost' },
        ],
        offers: [
          { id: 'of_pilot', name: 'Two-Reel Retention Pilot', price: 4000, advance: 2000, scope: 'Two defined edits from client-supplied footage.', revisions: 2 },
          { id: 'of_monthly', name: 'Monthly Short-Form Support', price: 15000, advance: 7500, scope: 'Example: eight short-form videos per month. 50% advance where commercially agreed.', revisions: 2 },
        ],
      },
      leads: [],
      finance: { invoices: [], payments: [], expenses: [] },
      personal: {
        routines: [
          { id: 'rt_english', label: 'English and client pitching', mins: 20 },
          { id: 'rt_sales', label: 'Sales / business learning', mins: 20 },
          { id: 'rt_move', label: 'Exercise or walking', mins: 25 },
          { id: 'rt_plan', label: 'Founder planning and review', mins: 15 },
        ],
        log: {}, speech,
      },
      meetings: { standups: [], logs: [], decisions: [] },
      goals: { thirtyDay: '' },
    };
  }

  /* ---------- derived model ---------- */
  const isMember = (s, id) => s.team.some((m) => m.id === id);
  function ownerName(s, id) {
    if (!id) return 'Unassigned';
    if (String(id).startsWith('role:')) { const r = s.roles.find((x) => x.id === id.slice(5)); return (r ? r.title.split(' / ')[0] : 'Role') + ' (role)'; }
    const m = s.team.find((x) => x.id === id); return m ? m.name : 'Removed member';
  }

  function annotateDel(d, t) {
    const done = d.status === 'Delivered';
    const due = d.dueDate;
    const daysLeft = due ? D.diff(t, due) : null;
    const overdue = !done && due && due < t;
    const late = done && d.completedDate && (d.originalDueDate || due) && d.completedDate > (d.originalDueDate || due);
    const hours = has(d.estHours) ? +d.estHours : (COMPLEXITY[d.complexity] || COMPLEXITY.standard).hours;
    const post = ['Internal QC', 'Client Review', 'Approved'].includes(d.status);
    const progress = post ? Math.max(90, n(d.editingProgress)) : n(d.editingProgress);
    const remainingHours = done ? 0 : Math.max(0.25, hours * (1 - progress / 100)) + (d.status === 'Revision Required' ? hours * 0.25 : 0);
    const risk = [];
    if (!done) {
      if (!d.assigneeId) risk.push('No editor assigned');
      if (!d.assetsReceived && daysLeft != null && daysLeft <= 2) risk.push('Client assets missing');
      if (d.status === 'Blocked') risk.push('Blocked: ' + (d.blockedReason || 'no reason given'));
      if (daysLeft != null && daysLeft >= 0 && daysLeft <= 1 && ['Backlog', 'Brief Ready'].includes(d.status)) risk.push('Due within a day, editing not started');
      if (d.status === 'Revision Required' && daysLeft != null && daysLeft <= 1) risk.push('Revision pending close to due date');
    }
    return { ...d, done, overdue, late, daysLeft, hours, remainingHours, risk, dueToday: !done && due === t };
  }

  function annotateTask(x, t) {
    const done = x.status === 'Done';
    return { ...x, done, overdue: !done && x.dueDate && x.dueDate < t, dueToday: !done && x.dueDate === t };
  }

  function nonWorking(c) { return String(c.nonWorkingDates || '').split(/[,\s]+/).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)); }

  /* Daily cadence plan: min / stretch per working day, delivered = Delivered with completedDate that day. */
  function dailyPlan(c, dels, from, to) {
    const off = new Set(nonWorking(c));
    let cumMin = 0, cumStretch = 0, cumDel = 0;
    return D.range(from, to).map((date) => {
      const working = !off.has(date);
      const min = working ? n(c.minPerPeriod) : 0, stretch = working ? n(c.stretchPerPeriod) : 0;
      const delivered = dels.filter((d) => d.clientId === c.id && d.done && d.completedDate === date).length;
      const scheduled = dels.filter((d) => d.clientId === c.id && d.dueDate === date).length;
      cumMin += min; cumStretch += stretch; cumDel += delivered;
      return { date, working, min, stretch, delivered, scheduled, cumMin, cumStretch, cumDel, carry: Math.max(0, cumMin - cumDel) };
    });
  }

  /* Weekly cadence plan: weeks start Monday; per-week override in client.weekTargets[weekStart] = {min, stretch}. */
  function weeklyPlan(c, dels, from, to) {
    const weeks = []; let w = D.week(from);
    while (w <= to && weeks.length < 60) { weeks.push(w); w = D.add(w, 7); }
    return weeks.map((ws) => {
      const we = D.add(ws, 6);
      const o = (c.weekTargets || {})[ws] || {};
      const min = has(o.min) ? +o.min : n(c.minPerPeriod), stretch = has(o.stretch) ? +o.stretch : n(c.stretchPerPeriod);
      const inWeek = (s) => s && s >= ws && s <= we;
      const mine = dels.filter((d) => d.clientId === c.id);
      return {
        weekStart: ws, weekEnd: we, min, stretch, overridden: has(o.min) || has(o.stretch),
        briefs: mine.filter((d) => inWeek(d.dueDate) && d.status !== 'Backlog').length,
        planned: mine.filter((d) => inWeek(d.dueDate)).length,
        approved: mine.filter((d) => inWeek(d.dueDate) && (d.status === 'Approved' || d.done)).length,
        revisions: mine.filter((d) => inWeek(d.dueDate)).reduce((a, d) => a + n(d.revisionCount), 0),
        delivered: mine.filter((d) => d.done && inWeek(d.completedDate)).length,
      };
    });
  }

  function model(s) {
    const t = D.today();
    const tomorrow = D.add(t, 1);
    const month = D.month(t);
    const dels = s.deliverables.map((d) => annotateDel(d, t));
    const tasks = s.tasks.map((x) => annotateTask(x, t));
    const openDels = dels.filter((d) => !d.done);
    const clientById = Object.fromEntries(s.clients.map((c) => [c.id, c]));
    const memberById = Object.fromEntries(s.team.map((m) => [m.id, m]));

    /* team capacity (next 7 days, working days per member) */
    const horizon = D.add(t, 6);
    const team = s.team.map((m) => {
      const mine = dels.filter((d) => d.assigneeId === m.id);
      const open = mine.filter((d) => !d.done);
      const myTasks = tasks.filter((x) => x.owner === m.id);
      const window = open.filter((d) => !d.dueDate || d.dueDate <= horizon);
      const taskHours = myTasks.filter((x) => !x.done && x.dueDate && x.dueDate <= horizon).reduce((a, x) => a + n(x.estMins) / 60, 0);
      const loadHours = window.reduce((a, d) => a + d.remainingHours, 0) + taskHours;
      const capacity = n(m.capacityHours) * Math.min(7, n(m.workDays || 6));
      const todayLoad = open.filter((d) => d.dueDate && d.dueDate <= t).reduce((a, d) => a + d.remainingHours, 0);
      const delivered = mine.filter((d) => d.done);
      const onTime = delivered.filter((d) => !d.late).length;
      return {
        ...m, assigned: mine.length + myTasks.length, open: open.length, dueToday: open.filter((d) => d.dueToday).length + myTasks.filter((x) => x.dueToday).length,
        overdue: open.filter((d) => d.overdue).length + myTasks.filter((x) => x.overdue).length,
        completed: delivered.length + myTasks.filter((x) => x.done).length, blocked: open.filter((d) => d.status === 'Blocked').length + myTasks.filter((x) => !x.done && x.status === 'Blocked').length,
        revisions: mine.reduce((a, d) => a + n(d.revisionCount), 0), onTimePct: delivered.length ? onTime / delivered.length : null,
        loadHours, capacity, utilisation: capacity > 0 ? loadHours / capacity : null, over: capacity > 0 ? loadHours > capacity : loadHours > 0,
        todayLoad, todayOver: n(m.capacityHours) > 0 && todayLoad > n(m.capacityHours),
      };
    });

    /* finance */
    const fin = s.finance;
    const paymentsClient = fin.payments.filter((p) => p.source !== 'Product');
    const clientsFin = s.clients.map((c) => {
      const inv = fin.invoices.filter((i) => i.clientId === c.id);
      const pays = fin.payments.filter((p) => p.clientId === c.id);
      const exps = fin.expenses.filter((e) => e.clientId === c.id);
      const invoiced = sum(inv, (i) => i.amount), received = sum(pays, (p) => p.amount);
      const advances = sum(pays.filter((p) => p.kind === 'Advance'), (p) => p.amount);
      const payout = sum(exps.filter((e) => e.category === 'Editor payout'), (e) => e.amount);
      const refunds = sum(exps.filter((e) => e.category === 'Refund'), (e) => e.amount);
      const other = sum(exps.filter((e) => !['Editor payout', 'Refund'].includes(e.category)), (e) => e.amount);
      const deliveredCount = dels.filter((d) => d.clientId === c.id && d.done).length;
      const earned = has(c.pricePerVideo) ? deliveredCount * +c.pricePerVideo : null;
      const refPayout = has(c.editorPoolPct) ? received * (+c.editorPoolPct / 100) : null;
      return { client: c, invoiced, received, advances, balance: invoiced - received, payout, refunds, other, deliveredCount, earned, refPayout,
        contribution: received - payout - other - refunds,
        overdueInvoices: inv.filter((i) => i.dueDate && i.dueDate < t).length };
    });
    const unbilledPayments = fin.payments.filter((p) => p.source !== 'Product' && !p.clientId);
    const pending = clientsFin.reduce((a, c) => a + Math.max(0, c.balance), 0) + sum(fin.invoices.filter((i) => !i.clientId), (i) => i.amount) - sum(fin.payments.filter((p) => !p.clientId && p.invoiceId), (p) => p.amount);
    const cashMonthClient = sum(paymentsClient.filter((p) => D.month(p.date) === month), (p) => p.amount);
    const prodDaysMonth = s.product.daily.filter((d) => D.month(d.date) === month);
    const productGrossMonth = sum(prodDaysMonth, (d) => d.gross), productRefundMonth = sum(prodDaysMonth, (d) => d.refundAmt);
    const productPaysMonth = sum(fin.payments.filter((p) => p.source === 'Product' && D.month(p.date) === month), (p) => p.amount);
    const expMonth = fin.expenses.filter((e) => D.month(e.date) === month);
    const adMonth = s.ads.entries.filter((e) => D.month(e.date) === month);
    const adSpendMonth = sum(adMonth, (e) => n(e.spend) + n(e.taxes));
    const invoicedMonth = sum(fin.invoices.filter((i) => D.month(i.issueDate) === month), (i) => i.amount);
    const expensesMonth = sum(expMonth, (e) => e.amount);
    const operatingEstimate = invoicedMonth + productGrossMonth - productRefundMonth - expensesMonth - adSpendMonth;
    const cashResultMonth = cashMonthClient + Math.max(productGrossMonth, productPaysMonth) - productRefundMonth - expensesMonth - adSpendMonth;

    /* ads */
    const A = s.ads.entries;
    const ads = {
      spend: sum(A, (e) => e.spend), taxes: sum(A, (e) => e.taxes), impressions: sum(A, (e) => e.impressions), reach: sum(A, (e) => e.reach),
      clicks: sum(A, (e) => e.clicks), lpv: sum(A, (e) => e.lpv), trials: sum(A, (e) => e.trials), purchases: sum(A, (e) => e.purchases), revenue: sum(A, (e) => e.revenue),
      entries: A.length, verified: A.filter((e) => e.verified).length,
    };
    ads.cost = ads.spend + ads.taxes;
    ads.ctr = div(ads.clicks, ads.impressions); ads.cpc = div(ads.spend, ads.clicks); ads.cpa = div(ads.cost, ads.purchases);
    ads.roas = div(ads.revenue, ads.cost); ads.net = ads.revenue - ads.cost; ads.remaining = n(s.ads.budget.media) - ads.cost;
    ads.usedPct = n(s.ads.budget.media) > 0 ? ads.cost / n(s.ads.budget.media) : null;
    ads.trackingDone = Object.values(s.ads.tracking).every(Boolean);
    ads.lpvRate = div(ads.lpv, ads.clicks); ads.costPerTrial = div(ads.cost, ads.trials);
    ads.decision = adsDecision(s, ads);
    const sprintSpend = sum(fin.expenses.filter((e) => e.sprintBudget), (e) => e.amount) + sum(A.filter((e) => e.date >= s.settings.sprintStart && e.date <= s.settings.sprintEnd), (e) => n(e.spend) + n(e.taxes));

    /* product */
    const P = s.product.daily;
    const prod = {
      visits: sum(P, (d) => d.visits), engaged: sum(P, (d) => d.engaged), trials: sum(P, (d) => d.trials), activations: sum(P, (d) => d.activations),
      checkouts: sum(P, (d) => d.checkouts), purchases: sum(P, (d) => d.purchases), refunds: sum(P, (d) => d.refunds), gross: sum(P, (d) => d.gross),
      refundAmt: sum(P, (d) => d.refundAmt), support: sum(P, (d) => d.supportIssues), installFail: sum(P, (d) => d.installFailures),
      paid: sum(P, (d) => d.paidPurchases), organic: sum(P, (d) => d.organicPurchases),
    };
    prod.net = prod.gross - prod.refundAmt; prod.rpb = div(prod.net, prod.purchases - prod.refunds > 0 ? prod.purchases - prod.refunds : 0);
    prod.trialsMonth = sum(prodDaysMonth, (d) => d.trials); prod.purchasesMonth = sum(prodDaysMonth, (d) => d.purchases);
    const trialDays = n(s.product.config.trialDays) || 7;
    prod.cohorts = P.filter((d) => n(d.trials) > 0).sort((a, b) => (a.date < b.date ? 1 : -1)).map((d) => {
      const mature = D.add(d.date, trialDays + 1);
      return { date: d.date, trials: n(d.trials), converted: d.cohortConverted, mature, isMature: t >= mature, daysLeft: Math.max(0, D.diff(t, mature)), rate: has(d.cohortConverted) ? div(+d.cohortConverted, n(d.trials)) : null };
    });

    /* CRM */
    const stages = s.crm.stages;
    const stageIdx = Object.fromEntries(stages.map((x, i) => [x.id, i]));
    const stageType = Object.fromEntries(stages.map((x) => [x.id, x.type]));
    const leads = s.leads.map((l) => ({ ...l, type: stageType[l.stage] || 'open', followOverdue: l.followUp && l.followUp < t && (stageType[l.stage] || 'open') === 'open', followToday: l.followUp === t && (stageType[l.stage] || 'open') === 'open' }));
    const openLeads = leads.filter((l) => l.type === 'open');
    const crm = {
      total: leads.length,
      qualified: leads.filter((l) => l.stage !== 'identified' && l.type !== 'lost').length,
      pipeline: sum(openLeads, (l) => l.value), weighted: sum(openLeads, (l) => n(l.value) * n(l.probability) / 100),
      won: leads.filter((l) => l.type === 'won').length, wonValue: sum(leads.filter((l) => l.type === 'won'), (l) => l.value),
      cash: sum(leads, (l) => l.cash), followOverdue: leads.filter((l) => l.followOverdue), followToday: leads.filter((l) => l.followToday),
      outreachToday: leads.filter((l) => l.outreachDate === t).length,
      repliesToday: leads.filter((l) => (l.history || []).some((h) => h.date === t && h.stage === 'replied')).length,
      wonToday: leads.filter((l) => (l.history || []).some((h) => h.date === t && stageType[h.stage] === 'won')).length,
      sprintOutreach: leads.filter((l) => l.outreachDate && l.outreachDate >= s.settings.sprintStart && l.outreachDate <= s.settings.sprintEnd).length,
      byStage: stages.map((st) => ({ ...st, count: leads.filter((l) => l.stage === st.id).length, value: sum(leads.filter((l) => l.stage === st.id), (l) => l.value) })),
    };

    /* sprint */
    const sprintTasks = tasks.filter((x) => x.sprintDay);
    const sprint = {
      total: sprintTasks.length, done: sprintTasks.filter((x) => x.done).length,
      days: s.sprintDays.map((d) => { const ts = sprintTasks.filter((x) => x.sprintDay === d.day); return { ...d, total: ts.length, done: ts.filter((x) => x.done).length, est: sum(ts, (x) => x.estMins), cost: sum(ts, (x) => x.cost), actualCost: sum(ts, (x) => x.actualCost) }; }),
    };
    sprint.pct = sprint.total ? sprint.done / sprint.total : null;

    /* personal */
    const R = s.personal.routines; const log = s.personal.log || {};
    const dayPct = (d) => (R.length ? R.filter((r) => (log[d] || {})[r.id]).length / R.length : 0);
    let streak = 0; { let d = dayPct(t) >= 0.75 ? t : D.add(t, -1); while (dayPct(d) >= 0.75 && streak < 400) { streak++; d = D.add(d, -1); } }
    const last7 = D.range(D.add(t, -6), t);
    const routinePct7 = last7.reduce((a, d) => a + dayPct(d), 0) / 7;
    const founderDue = tasks.filter((x) => x.owner === 'm_hemant' && x.dueDate && x.dueDate >= last7[0] && x.dueDate <= t);
    const founderDone = founderDue.filter((x) => x.done && (!x.completedDate || x.completedDate <= x.dueDate));
    const speechDue = s.personal.speech.filter((x) => x.date >= last7[0] && x.date <= t);
    const anyLog = last7.some((d) => Object.values(log[d] || {}).some(Boolean));
    const parts = [];
    if (anyLog) parts.push([routinePct7, 0.5]);
    if (founderDue.length) parts.push([founderDone.length / founderDue.length, 0.3]);
    if (speechDue.length) parts.push([speechDue.filter((x) => x.done === true).length / speechDue.length, 0.2]);
    const wsum = parts.reduce((a, p) => a + p[1], 0);
    const discipline = wsum ? Math.round((parts.reduce((a, p) => a + p[0] * p[1], 0) / wsum) * 100) : null;
    const personal = { todayPct: dayPct(t), streak, routinePct7, discipline, dayPct, founderDue: founderDue.length, founderDone: founderDone.length, speechDue: speechDue.length };

    /* warnings — all derived */
    const W = [];
    dels.filter((d) => d.overdue).forEach((d) => W.push({ level: 'crit', text: `${d.id} for ${clientById[d.clientId]?.name || 'client'} is overdue (due ${D.fmt(d.dueDate)})`, to: 'production', ref: d.id }));
    const group = (arr, one, many) => { if (arr.length > 2) W.push({ level: 'warn', text: many(arr), to: 'production' }); else arr.forEach((d) => W.push({ level: 'warn', text: one(d), to: 'production', ref: d.id })); };
    group(openDels.filter((d) => !d.assigneeId), (d) => `${d.id} has no editor assigned`, (a) => `${a.length} open deliverables have no editor assigned (${a.slice(0, 3).map((d) => d.id).join(', ')}…)`);
    group(openDels.filter((d) => !d.assetsReceived && d.daysLeft != null && d.daysLeft <= 2), (d) => `${d.id}: client assets not received, due ${D.fmt(d.dueDate)}`, (a) => `${a.length} deliverables due within 2 days are missing client assets`);
    openDels.filter((d) => d.status === 'Blocked').forEach((d) => W.push({ level: 'crit', text: `${d.id} blocked — ${d.blockedReason || 'no reason given'}`, to: 'production', ref: d.id }));
    team.filter((m) => m.over).forEach((m) => W.push({ level: 'warn', text: `${m.name} is over capacity: ${m.loadHours.toFixed(1)} h planned vs ${m.capacity} h available this week`, to: 'team' }));
    if (ads.usedPct != null && ads.usedPct >= 1) W.push({ level: 'crit', text: `Ad media budget exhausted: ${F.inr(ads.cost)} of ${F.inr(s.ads.budget.media)}`, to: 'ads' });
    else if (ads.usedPct != null && ads.usedPct >= 0.8) W.push({ level: 'warn', text: `Ad media budget ${F.pct(ads.usedPct, 0)} used — ${F.inr(ads.remaining)} left`, to: 'ads' });
    if (ads.cost > 0 && !ads.trackingDone) W.push({ level: 'warn', text: 'Ad money spent while tracking checklist is incomplete', to: 'ads' });
    if (A.some((e) => e.date < '2026-11-08')) W.push({ level: 'warn', text: 'Ad spend recorded before Nov 8 start rule', to: 'ads' });
    if (crm.followOverdue.length) W.push({ level: 'warn', text: `${crm.followOverdue.length} follow-up${crm.followOverdue.length > 1 ? 's' : ''} overdue`, to: 'crm' });
    fin.invoices.forEach((i) => {
      const paid = sum(fin.payments.filter((p) => p.invoiceId === i.id), (p) => p.amount);
      if (paid < n(i.amount)) W.push({ level: i.dueDate && i.dueDate < t ? 'crit' : 'info', text: `Invoice ${i.number || ''} ${i.dueDate && i.dueDate < t ? 'overdue' : 'outstanding'}: ${F.inr(n(i.amount) - paid)} (${clientById[i.clientId]?.name || 'no client'})`, to: 'finance' });
    });
    const overdueTasks = tasks.filter((x) => x.overdue);
    if (overdueTasks.length) W.push({ level: 'warn', text: `${overdueTasks.length} task${overdueTasks.length > 1 ? 's' : ''} past due`, to: 'sprint' });
    const order = { crit: 0, warn: 1, info: 2 };
    W.sort((a, b) => order[a.level] - order[b.level]);

    /* founder top 3 */
    const founderOpen = tasks.filter((x) => !x.done && x.owner === 'm_hemant').sort((a, b) => {
      const ka = [a.overdue ? 0 : 1, a.dueDate || '9999', a.kind === 'Top priority' ? 0 : 1, PRI_RANK[a.priority] ?? 2];
      const kb = [b.overdue ? 0 : 1, b.dueDate || '9999', b.kind === 'Top priority' ? 0 : 1, PRI_RANK[b.priority] ?? 2];
      for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1; return 0;
    });

    return {
      t, tomorrow, month, dels, openDels, tasks, team, clientById, memberById, clientsFin, pending, cashMonthClient, productGrossMonth, productRefundMonth,
      expensesMonth, adSpendMonth, invoicedMonth, operatingEstimate, cashResultMonth, ads, sprintSpend, prod, crm, leads, sprint, personal, warnings: W,
      founderTop: founderOpen.slice(0, 3), founderOpen, unbilledPayments,
      counts: {
        activeClients: s.clients.filter((c) => c.status === 'Active').length,
        active: openDels.length, dueToday: openDels.filter((d) => d.dueToday).length,
        editing: openDels.filter((d) => d.status === 'Editing').length, qc: openDels.filter((d) => d.status === 'Internal QC').length,
        review: openDels.filter((d) => d.status === 'Client Review').length, overdue: openDels.filter((d) => d.overdue).length,
        revisions: openDels.filter((d) => d.status === 'Revision Required').length, revisionTotal: sum(dels, (d) => d.revisionCount),
        deliveredToday: dels.filter((d) => d.done && d.completedDate === t).length,
      },
    };
  }

  function adsDecision(s, a) {
    const price = n(s.product.config.proPrice) || 699;
    if (!Object.values(s.ads.tracking).every(Boolean)) return { key: 'Tracking Incomplete', level: 'info', why: 'Finish the tracking checklist (pixel, Purchase event, test purchase, checkout, UTMs) before judging results. Spend without verified tracking cannot be evaluated.' };
    if (!a.entries) return { key: 'Tracking Incomplete', level: 'info', why: 'Tracking is verified but no ad results have been entered yet. Enter figures from Ads Manager to get a recommendation.' };
    if (a.verified < a.entries) return { key: 'Investigate', level: 'warn', why: `${a.entries - a.verified} entr${a.entries - a.verified > 1 ? 'ies are' : 'y is'} not marked as verified against Ads Manager. Verify before deciding.` };
    if (a.purchases > 0 && a.roas != null && a.roas >= 1) return { key: 'Continue', level: 'ok', why: `Attributed revenue covers ad cost (ROAS ${F.x(a.roas)}). Keep the budget capped and watch refunds; attribution is an estimate, not proof of causation.` };
    if (a.cost >= price * 3 && a.purchases === 0) return { key: 'Pause', level: 'crit', why: `${F.inr(a.cost)} spent (≈${(a.cost / price).toFixed(1)}× the product price) with zero attributed purchases. Pause and review page, offer and audience before spending more.` };
    if (a.cost >= price * 1.5 && a.purchases === 0) return { key: 'Investigate', level: 'warn', why: `${F.inr(a.cost)} spent with no purchases yet. Check landing page views vs clicks (${F.pct(a.lpvRate)}) and trial starts before adding budget. Cheap clicks do not guarantee sales.` };
    if (a.purchases > 0 && a.roas != null && a.roas < 1) return { key: 'Investigate', level: 'warn', why: `Purchases are coming in but ROAS is ${F.x(a.roas)}. Account for trials still maturing before pausing.` };
    return { key: 'Continue', level: 'ok', why: 'Spend is still below the point where a judgement is meaningful. Keep collecting data within the capped budget.' };
  }

  CC.D = D; CC.F = F; CC.n = n; CC.has = has; CC.sum = sum; CC.div = div; CC.uid = uid;
  CC.STATUSES = STATUSES; CC.ALL_STATUSES = ALL_STATUSES; CC.QC_ITEMS = QC_ITEMS; CC.COMPLEXITY = COMPLEXITY;
  CC.PRIORITIES = PRIORITIES; CC.PRI_RANK = PRI_RANK; CC.TASK_STATUS = TASK_STATUS; CC.TASK_KINDS = TASK_KINDS;
  CC.seed = seed; CC.model = model; CC.dailyPlan = dailyPlan; CC.weeklyPlan = weeklyPlan; CC.ownerName = ownerName; CC.isMember = isMember; CC.nonWorking = nonWorking;
})();
