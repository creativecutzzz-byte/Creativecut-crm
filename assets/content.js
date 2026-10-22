/*
 * Creativecut CRM — sales & client-success content used by the app.
 * Merge fields: {{first_name}} {{company}} {{channel}} {{niche}} {{personalization}}
 *               {{sender_name}} {{sender_title}} {{agency}} {{booking_link}} {{portfolio_link}} {{value}}
 * Full rationale for each piece lives in /playbook.
 */
(function (root) {
  'use strict';

  var TEMPLATES = [
    // ---------- Cold email sequence (playbook/05-cold-email-sequences.md) ----------
    {
      id: 'cold_1', group: 'Cold email', name: 'Cold #1 — the observation',
      subject: 'clips from {{channel}}',
      body: [
        'Hi {{first_name}},',
        '',
        '{{personalization}}',
        '',
        'Most of that episode lives only on YouTube right now. Cut properly, one episode like it is 6–8 short clips for LinkedIn, Shorts, Reels and TikTok — the places your buyers actually scroll.',
        '',
        'We do exactly that for B2B founders and consultants with a podcast: you record, we hand back a full edit plus a week of captioned clips, within 48 hours.',
        '',
        'Want me to cut 2 clips from your latest episode, free, so you can see the difference before we talk?',
        '',
        '{{sender_name}}',
        '{{agency}}'
      ].join('\n')
    },
    {
      id: 'cold_2', group: 'Cold email', name: 'Cold #2 — the proof',
      subject: 'Re: clips from {{channel}}',
      body: [
        'Hi {{first_name}},',
        '',
        'Quick follow-up. Here is the kind of work I mean: {{portfolio_link}}',
        '',
        'Each clip has a hook in the first 2 seconds, burned-in captions (most people watch on mute) and a title written for the platform it is going to.',
        '',
        'Still happy to do 2 free clips from your newest episode. Just reply "yes".',
        '',
        '{{sender_name}}'
      ].join('\n')
    },
    {
      id: 'cold_3', group: 'Cold email', name: 'Cold #3 — the sample (send WITH a clip)',
      subject: 'made this from your episode',
      body: [
        'Hi {{first_name}},',
        '',
        'I went ahead and cut one clip from your latest episode — no strings: [LINK TO SAMPLE CLIP]',
        '',
        'If you like it, it is yours to post. If you want 8 of these every week without thinking about it, that is what we do.',
        '',
        '15 minutes to see if it is a fit? {{booking_link}}',
        '',
        '{{sender_name}}'
      ].join('\n')
    },
    {
      id: 'cold_4', group: 'Cold email', name: 'Cold #4 — the cost of doing nothing',
      subject: 'one question',
      body: [
        'Hi {{first_name}},',
        '',
        'Honest question: who edits {{company}}\'s podcast today, and how many hours a week does it cost you?',
        '',
        'Founders we talk to are usually spending 5–10 hours a week on it themselves, or paying a freelancer who disappears. We take the whole thing off your plate for a flat monthly fee.',
        '',
        'Worth a 15-minute look? {{booking_link}}',
        '',
        '{{sender_name}}'
      ].join('\n')
    },
    {
      id: 'cold_5', group: 'Cold email', name: 'Cold #5 — the breakup',
      subject: 'closing the loop',
      body: [
        'Hi {{first_name}},',
        '',
        'I will stop emailing after this one. If short-form is not a priority right now, totally fine.',
        '',
        'If it becomes one, reply to this thread any time and the 2 free clips offer still stands.',
        '',
        'Good luck with {{channel}}.',
        '',
        '{{sender_name}}'
      ].join('\n')
    },

    // ---------- Social DM sequence ----------
    {
      id: 'dm_1', group: 'Social DM', name: 'DM #1 — LinkedIn/X opener',
      subject: '(DM — no subject)',
      body: '{{first_name}} — {{personalization}} Do you repurpose the episodes into short clips, or is it all long-form for now?'
    },
    {
      id: 'dm_2', group: 'Social DM', name: 'DM #2 — sample offer',
      subject: '(DM — no subject)',
      body: 'Makes sense. I run {{agency}} — we turn podcast episodes into short clips for B2B founders. Happy to cut 2 from your latest episode for free so you can judge for yourself. Want them?'
    },
    {
      id: 'dm_3', group: 'Social DM', name: 'DM #3 — deliver + ask',
      subject: '(DM — no subject)',
      body: 'Here you go: [LINK]. Post them if you like them. If you want this every week, here is my calendar for a 15-min chat: {{booking_link}}'
    },

    // ---------- Pipeline stage templates ----------
    {
      id: 'reply_book_call', group: 'Sales', name: 'Positive reply → book the call',
      subject: 'Re: {{channel}}',
      body: [
        'Great to hear, {{first_name}}.',
        '',
        'Easiest next step is a 15-minute call so I can see your goals and show you a plan for {{channel}}. Pick any time here: {{booking_link}}',
        '',
        'If none of those work, send me two times and I will make one fit.',
        '',
        '{{sender_name}}'
      ].join('\n')
    },
    {
      id: 'call_confirm', group: 'Sales', name: 'Call confirmation + agenda',
      subject: 'Our call — agenda',
      body: [
        'Hi {{first_name}},',
        '',
        'Looking forward to our call. So we use the 15 minutes well:',
        '1. What you want the podcast to do for {{company}} (leads, authority, hiring?)',
        '2. What you are doing today and what is not working',
        '3. I will show you what a month with us looks like and what it costs',
        '',
        'If you can, send me links to 1–2 episodes you are proud of beforehand.',
        '',
        '{{sender_name}}'
      ].join('\n')
    },
    {
      id: 'post_call', group: 'Sales', name: 'After the call — recap + proposal',
      subject: '{{company}} x {{agency}} — proposal',
      body: [
        'Hi {{first_name}},',
        '',
        'Thanks for the time today. What I heard:',
        '- Goal: [THEIR GOAL IN THEIR WORDS]',
        '- Problem: [WHAT IS NOT WORKING]',
        '- Must-haves: [TURNAROUND / STYLE / PLATFORMS]',
        '',
        'Proposal attached. Recommended plan: [PLAN] at {{value}}/month, starting with a [DATE] kickoff.',
        '',
        'To start, reply "approved" and I will send the invoice and onboarding form the same day.',
        '',
        '{{sender_name}}'
      ].join('\n')
    },
    {
      id: 'proposal_fu_1', group: 'Sales', name: 'Proposal follow-up #1',
      subject: 'Re: {{company}} x {{agency}} — proposal',
      body: 'Hi {{first_name}}, did the proposal come through OK? Any questions I can answer, or anything you want changed in the plan?\n\n{{sender_name}}'
    },
    {
      id: 'proposal_fu_2', group: 'Sales', name: 'Proposal follow-up #2 (value add)',
      subject: 'Re: {{company}} x {{agency}} — proposal',
      body: [
        'Hi {{first_name}},',
        '',
        'While you think it over, I cut one more clip from your latest episode: [LINK]. This is the exact style you would get every week.',
        '',
        'If budget is the sticking point, the Clips plan is a lighter way to start and you can upgrade any month.',
        '',
        '{{sender_name}}'
      ].join('\n')
    },
    {
      id: 'proposal_fu_3', group: 'Sales', name: 'Proposal follow-up #3 (close the loop)',
      subject: 'should I close your file?',
      body: [
        'Hi {{first_name}},',
        '',
        'I have not heard back, so I am guessing the timing is not right. Should I close your file for now?',
        '',
        'A one-word reply is perfect: "later", "no", or "let\'s go".',
        '',
        '{{sender_name}}'
      ].join('\n')
    },

    // ---------- Onboarding & retention ----------
    {
      id: 'onboard_welcome', group: 'Client', name: 'Welcome + onboarding form',
      subject: 'Welcome to {{agency}} — 3 quick things',
      body: [
        'Hi {{first_name}},',
        '',
        'Welcome aboard — excited to work on {{channel}}. To get your first edits back within 7 days, I need three things:',
        '',
        '1. The onboarding form (10 minutes): [ONBOARDING FORM LINK]',
        '2. A shared folder where you drop raw recordings (we will create one if you prefer): [FOLDER LINK]',
        '3. A 30-minute kickoff call: {{booking_link}}',
        '',
        'How it works from here: you upload an episode → we deliver within 48 hours → you approve or request changes (2 revision rounds included) → you post, or we schedule it for you.',
        '',
        '{{sender_name}}'
      ].join('\n')
    },
    {
      id: 'checkin_2w', group: 'Client', name: '2-week check-in',
      subject: 'quick check-in',
      body: [
        'Hi {{first_name}},',
        '',
        'Two weeks in — how are the edits landing? On a scale of 1–10, how happy are you so far, and what would make it a 10?',
        '',
        'Early numbers I am seeing: [TOP CLIP + VIEWS]. Next week we will test [HOOK/FORMAT IDEA].',
        '',
        '{{sender_name}}'
      ].join('\n')
    },
    {
      id: 'referral_ask', group: 'Client', name: 'Testimonial + referral ask',
      subject: 'a small favour',
      body: [
        'Hi {{first_name}},',
        '',
        'Glad the clips are working. Two small asks, only if you are happy:',
        '1. Two sentences on what changed since we started — I will use it on our site.',
        '2. Do you know one other founder with a podcast who is drowning in editing? An intro would mean a lot. For every referral that signs, your next month is 20% off.',
        '',
        '{{sender_name}}'
      ].join('\n')
    },
    {
      id: 'case_study_ask', group: 'Client', name: 'Case-study permission',
      subject: 'can we feature {{company}}?',
      body: [
        'Hi {{first_name}},',
        '',
        'Your results are some of our best, and I would love to write them up as a short case study (I will send it to you for approval before anything goes live).',
        '',
        'Could you share: views/followers before vs now, any leads or deals you can trace to the clips, and how much time you have saved?',
        '',
        '{{sender_name}}'
      ].join('\n')
    },
    {
      id: 'renewal', group: 'Client', name: 'Renewal / upsell',
      subject: 'your next 3 months',
      body: [
        'Hi {{first_name}},',
        '',
        'Your current term ends soon, so here is a quick recap:',
        '- Delivered: [X long-form edits, Y clips]',
        '- Best result: [TOP CLIP + METRIC]',
        '- What we learned: [WHAT WORKS FOR YOUR AUDIENCE]',
        '',
        'For the next 3 months I recommend [PLAN], because [REASON]. Want me to roll it over, or should we talk it through? {{booking_link}}',
        '',
        '{{sender_name}}'
      ].join('\n')
    },
    {
      id: 'winback', group: 'Client', name: 'Win-back',
      subject: 'how is {{channel}} going?',
      body: [
        'Hi {{first_name}},',
        '',
        'It has been a month since we paused — how is the podcast going?',
        '',
        'If you want to restart, I will waive the setup and give you your first 2 weeks at half price. No pressure either way.',
        '',
        '{{sender_name}}'
      ].join('\n')
    },
    {
      id: 'reengage_lost', group: 'Sales', name: 'Re-engage lost lead (90 days)',
      subject: 'still recording {{channel}}?',
      body: [
        'Hi {{first_name}},',
        '',
        'We spoke a few months ago about clips for {{channel}}. Has anything changed on your side?',
        '',
        'Since then we have [NEW RESULT / CASE STUDY]. If the timing is better now, the free 2-clip sample is still on the table.',
        '',
        '{{sender_name}}'
      ].join('\n')
    }
  ];

  var SEQUENCES = [
    {
      id: 'cold_podcast', name: 'Cold email: podcast founders',
      description: '5 emails over 18 days. Stops automatically when the lead replies or changes stage.',
      steps: [
        { day: 0, label: 'Observation', templateId: 'cold_1' },
        { day: 3, label: 'Proof', templateId: 'cold_2' },
        { day: 7, label: 'Free sample clip', templateId: 'cold_3' },
        { day: 12, label: 'Cost of doing nothing', templateId: 'cold_4' },
        { day: 18, label: 'Breakup', templateId: 'cold_5' }
      ]
    },
    {
      id: 'social_dm', name: 'Social DM: LinkedIn / X',
      description: '3 touches over 6 days. Send DM #2 only after they answer DM #1.',
      steps: [
        { day: 0, label: 'Opener question', templateId: 'dm_1', type: 'dm' },
        { day: 2, label: 'Free sample offer', templateId: 'dm_2', type: 'dm' },
        { day: 6, label: 'Deliver sample + book', templateId: 'dm_3', type: 'dm' }
      ]
    }
  ];

  var ONBOARDING = [
    { id: 'contract', label: 'Agreement signed (scope, revisions, payment terms)' },
    { id: 'payment', label: 'First payment received / subscription active' },
    { id: 'form', label: 'Onboarding form completed (goals, audience, brand, examples they love/hate)' },
    { id: 'assets', label: 'Brand kit received (logo, fonts, colours, intro/outro, music preferences)' },
    { id: 'folder', label: 'Shared upload folder + naming convention set up' },
    { id: 'access', label: 'Platform access (YouTube Studio / scheduler) if we post for them' },
    { id: 'kickoff', label: 'Kickoff call held; style guide written and shared with editor' },
    { id: 'first_delivery', label: 'First batch delivered within 7 days' },
    { id: 'feedback', label: 'Feedback on first batch captured in style guide' },
    { id: 'cadence', label: 'Weekly delivery day + monthly report date agreed' }
  ];

  var CALL_SCRIPT = [
    { step: '1. Frame (1 min)', text: '"Thanks for making time. I\'d like to ask a few questions about the podcast, then if it makes sense I\'ll show you how we\'d handle it and what it costs. If it\'s not a fit, I\'ll tell you. Sound good?"' },
    { step: '2. Goal (3 min)', text: '"What do you want the podcast to do for the business in the next 6 months?" → "Why does that matter now?" → "How would you measure it?"' },
    { step: '3. Current state (3 min)', text: '"Walk me through what happens after you hit stop on a recording today." "Who edits it? How long does it take? What do you post besides the full episode?"' },
    { step: '4. Pain & cost (3 min)', text: '"What has that cost you — hours, missed posts, opportunities?" "If nothing changes, where is the show in 6 months?"' },
    { step: '5. Present (3 min)', text: 'Restate their goal in their words. Show ONE plan (not three): what they send, what they get back, by when. Show 2–3 examples in their niche.' },
    { step: '6. Price & close (2 min)', text: '"It\'s $X/month, 3-month initial term, then month-to-month. Based on what you told me, does this solve the problem?" Then stop talking. If yes: "Great — I\'ll send the agreement and invoice today, and we can kick off on [day]."' }
  ];

  var OBJECTIONS = [
    { q: '"It\'s too expensive."', a: 'Compared to what? "If we took 8 hours a week off your plate, what is your hour worth?" At $150/hr founder time, 32 hrs/mo = $4,800 of time. Offer the lighter Clips plan rather than discounting.' },
    { q: '"I already have an editor."', a: '"Great — what do they handle, and what still lands on you?" Most freelancers do the long-form only. Offer clips-only as an add-on that works alongside them.' },
    { q: '"I can do it with AI clipping tools."', a: '"You can — and we use them too, for speed. The difference is judgement: choosing the 8 moments worth posting, writing hooks, and making it look like your brand. Want to compare one of your AI clips with one of ours?"' },
    { q: '"Short-form doesn\'t work in my industry."', a: '"Which platforms have you tested, for how long?" Point to B2B accounts in their niche growing on LinkedIn video. Suggest the paid pilot to test it with low risk.' },
    { q: '"I need to think about it."', a: '"Of course. Usually that means something\'s unclear or it\'s the price — which is it for you?" Address it, then agree a specific follow-up date on the call.' },
    { q: '"Send me some info."', a: '"Happy to. So I don\'t send you a generic deck — what would you need to see to say yes?" Then book a 10-min follow-up to go through it.' },
    { q: '"Not right now / maybe next quarter."', a: '"What changes next quarter?" If real, set a task for that date. If not, offer the $500 pilot to start small now.' },
    { q: '"What if I don\'t like the edits?"', a: 'Two revision rounds per video, a style guide that improves every week, and a 3-month term with a 30-day out if we miss our turnaround promise.' }
  ];

  var CONTENT = { TEMPLATES: TEMPLATES, SEQUENCES: SEQUENCES, ONBOARDING: ONBOARDING, CALL_SCRIPT: CALL_SCRIPT, OBJECTIONS: OBJECTIONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = CONTENT;
  else root.CRM_CONTENT = CONTENT;
})(typeof window !== 'undefined' ? window : this);
