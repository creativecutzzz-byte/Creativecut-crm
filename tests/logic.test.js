'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const CRM = require('../assets/logic.js');
const C = require('../assets/content.js');

const T = '2026-10-22';
const seq = (id) => C.SEQUENCES.find((s) => s.id === id);
const pending = (s, leadId) => s.tasks.filter((t) => t.leadId === leadId && !t.done);

test('date helpers handle month ends and leap years', () => {
  assert.equal(CRM.addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(CRM.addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(CRM.addMonths('2027-11-30', 3), '2028-02-29');
  assert.equal(CRM.addMonths('2026-10-22', 3), '2027-01-22');
  assert.equal(CRM.daysBetween('2026-10-22', '2026-11-05'), 14);
});

test('createLead fills defaults and history', () => {
  const s = CRM.emptyState();
  const l = CRM.createLead(s, { name: ' Jane Doe ', value: '' }, T);
  assert.equal(l.name, 'Jane Doe');
  assert.equal(l.value, s.settings.defaultDealValue);
  assert.deepEqual(l.history, [{ stage: 'new', at: T }]);
});

test('every sequence and stage rule points at a real template', () => {
  const ids = new Set(C.TEMPLATES.map((t) => t.id));
  assert.equal(ids.size, C.TEMPLATES.length, 'template ids are unique');
  C.SEQUENCES.forEach((s) => s.steps.forEach((st) => assert.ok(ids.has(st.templateId), st.templateId)));
  Object.values(CRM.STAGE_RULES).flat().forEach((r) => { if (r.templateId) assert.ok(ids.has(r.templateId), r.templateId); });
  ['renewal', 'winback'].forEach((id) => assert.ok(ids.has(id)));
});

test('enrolling schedules every step and moves new → contacted', () => {
  const s = CRM.emptyState();
  const l = CRM.createLead(s, { name: 'A' }, T);
  CRM.enrollSequence(s, l.id, seq('cold_podcast'), T);
  const due = pending(s, l.id).map((t) => t.due);
  assert.deepEqual(due, ['2026-10-22', '2026-10-25', '2026-10-29', '2026-11-03', '2026-11-09']);
  assert.equal(l.stage, 'contacted');
  // Re-enrolling replaces rather than duplicates.
  CRM.enrollSequence(s, l.id, seq('cold_podcast'), T);
  assert.equal(pending(s, l.id).length, 5);
});

test('a reply stops the sequence but keeps completed and manual tasks', () => {
  const s = CRM.emptyState();
  const l = CRM.createLead(s, { name: 'A' }, T);
  CRM.enrollSequence(s, l.id, seq('cold_podcast'), T);
  CRM.completeTask(s, pending(s, l.id)[0].id, T);
  CRM.addTask(s, { leadId: l.id, title: 'manual', due: T });
  CRM.moveStage(s, l.id, 'replied', '2026-10-24');
  assert.equal(l.sequence.status, 'replied');
  const titles = pending(s, l.id).map((t) => t.title);
  assert.ok(titles.includes('manual'));
  assert.ok(titles.some((t) => /Reply within 1 hour/.test(t)));
  assert.ok(!titles.some((t) => /step/.test(t)), 'no sequence steps left');
  assert.equal(s.tasks.filter((t) => t.done).length, 1);
});

test('stage tasks are replaced on each move, and won creates onboarding + renewal', () => {
  const s = CRM.emptyState();
  const l = CRM.createLead(s, { name: 'A', value: 1997 }, T);
  CRM.moveStage(s, l.id, 'proposal', T);
  assert.equal(pending(s, l.id).length, 3);
  CRM.moveStage(s, l.id, 'won', T);
  const p = pending(s, l.id);
  assert.ok(!p.some((t) => /Proposal follow-up/.test(t.title)));
  assert.equal(p.length, CRM.STAGE_RULES.won.length + 1);
  assert.equal(l.client.renewalDate, '2027-01-22');
  assert.ok(p.some((t) => t.templateId === 'renewal' && t.due === '2027-01-08'));
});

test('moving to the same stage is a no-op', () => {
  const s = CRM.emptyState();
  const l = CRM.createLead(s, { name: 'A' }, T);
  CRM.moveStage(s, l.id, 'proposal', T);
  CRM.moveStage(s, l.id, 'proposal', T);
  assert.equal(pending(s, l.id).length, 3);
  assert.equal(l.history.length, 2);
});

test('churn cancels client tasks and schedules a win-back', () => {
  const s = CRM.emptyState();
  const l = CRM.createLead(s, { name: 'A' }, T);
  CRM.moveStage(s, l.id, 'won', T);
  CRM.churnClient(s, l.id, '2026-12-01');
  const p = pending(s, l.id);
  assert.equal(p.length, 1);
  assert.equal(p[0].templateId, 'winback');
  assert.equal(p[0].due, '2026-12-31');
});

test('renderTemplate fills fields, keeps unknown tokens, and flags missing data', () => {
  const lead = { name: 'Jane Doe', company: 'Acme', channel: 'Acme Show' };
  const out = CRM.renderTemplate('Hi {{first_name}} from {{ company }} {{unknown}} — {{sender_name}}', lead, { senderName: 'Sam' });
  assert.equal(out, 'Hi Jane from Acme {{unknown}} — Sam');
  assert.deepEqual(CRM.missingFields('{{personalization}} {{channel}} {{niche}}', lead), ['personalization', 'niche']);
  C.TEMPLATES.forEach((t) => {
    const r = CRM.renderTemplate(t.subject + t.body, { name: 'X', company: 'Y', channel: 'Z', niche: 'N', personalization: 'P' }, { senderName: 'S' });
    assert.ok(!/\{\{/.test(r), 'unrendered token in ' + t.id);
  });
});

test('metrics: funnel, MRR, win rate, churn, pipeline', () => {
  const s = CRM.emptyState();
  const a = CRM.createLead(s, { name: 'A', value: 2000, source: 'Cold email' }, T);
  const b = CRM.createLead(s, { name: 'B', value: 1000, source: 'Cold email' }, T);
  const c = CRM.createLead(s, { name: 'C', value: 4000, source: 'Referral' }, T);
  const d = CRM.createLead(s, { name: 'D', value: 1000, source: 'Referral' }, T);
  ['contacted', 'replied', 'call_booked', 'proposal', 'won'].forEach((st) => CRM.moveStage(s, a.id, st, T));
  CRM.moveStage(s, b.id, 'contacted', T); CRM.moveStage(s, b.id, 'lost', T);
  CRM.moveStage(s, c.id, 'proposal', T);
  CRM.moveStage(s, d.id, 'won', T); CRM.churnClient(s, d.id, T);
  const m = CRM.computeMetrics(s, T);
  assert.equal(m.mrr, 2000);
  assert.equal(m.activeClients, 1);
  assert.equal(m.churnRate, 0.5);
  assert.equal(m.winRate, 2 / 3);
  assert.equal(m.pipelineValue, 4000);
  assert.equal(m.weightedPipeline, 2000);
  const f = Object.fromEntries(m.funnel.map((x) => [x.stage, x.count]));
  assert.deepEqual(f, { contacted: 4, replied: 3, call_booked: 3, proposal: 3, won: 2 });
  assert.equal(m.sources[0].source, 'Cold email');
});

test('stale deals and renewals are detected', () => {
  const s = CRM.emptyState();
  const a = CRM.createLead(s, { name: 'A' }, '2026-09-01');
  CRM.moveStage(s, a.id, 'proposal', '2026-09-01');
  const b = CRM.createLead(s, { name: 'B' }, '2026-08-01');
  CRM.moveStage(s, b.id, 'won', '2026-08-01');
  const m = CRM.computeMetrics(s, T);
  assert.equal(m.staleDeals.length, 1);
  assert.equal(m.renewalsSoon.length, 1);
  assert.equal(m.renewalsSoon[0].date, '2026-11-01');
});

test('CSV import handles quotes, aliases, BOM and duplicates; export escapes formulas', () => {
  const s = CRM.emptyState();
  const csv = '﻿Full Name,Company,Email,Icebreaker,Lead Source\r\n' +
    '"Doe, Jane",Acme,jane@x.com,"Loved the ""pricing"" ep",Apollo\r\n' +
    'Bob,Beta,JANE@x.com,,Apollo\n' +
    ',,,,\n' +
    'Cara,"Multi\nline Co",cara@x.com,,\n';
  const r = CRM.importCSV(s, csv, T);
  assert.deepEqual(r, { added: 2, skipped: 1 }); // blank row is dropped by the parser; duplicate email skipped
  assert.equal(s.leads[0].name, 'Doe, Jane');
  assert.equal(s.leads[0].personalization, 'Loved the "pricing" ep');
  assert.equal(s.leads[1].company, 'Multi\nline Co');
  s.leads[0].notes = '=HYPERLINK("x")';
  const out = CRM.exportCSV(s);
  assert.ok(out.includes('"\'=HYPERLINK(""x"")"'));
  assert.equal(CRM.parseCSV(out).length, 3);
});

test('migrate repairs partial or invalid state', () => {
  assert.deepEqual(CRM.migrate(null).leads, []);
  const m = CRM.migrate({ leads: [{ id: 'x', stage: 'bogus' }], settings: { senderName: 'Sam' } });
  assert.equal(m.leads[0].stage, 'new');
  assert.equal(m.settings.senderName, 'Sam');
  assert.equal(m.settings.agencyName, 'Creativecut');
  assert.ok(Array.isArray(m.tasks));
});
