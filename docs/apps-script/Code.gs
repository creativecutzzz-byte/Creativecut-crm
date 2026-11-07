/**
 * Creative Cut CRM ↔ Google (free, no Google Cloud project).
 *
 * Deploy: script.google.com → New project → paste this file and appsscript.json
 * → Project Settings → Script properties → add SECRET (same value as
 * GOOGLE_SCRIPT_SECRET in Vercel) → Deploy → New deployment → Web app,
 * Execute as: Me, Who has access: Anyone → copy the /exec URL into
 * GOOGLE_SCRIPT_URL. Full guide: docs/google-apps-script-setup.md
 *
 * Every request must carry the SECRET. The script can: read free/busy, list
 * and create events on your primary calendar (with Google Meet), and send
 * plain-text emails from your account. Nothing else.
 */

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (!secret || req.secret !== secret) return reply_({ ok: false, error: 'unauthorized' });

    switch (req.action) {
      case 'ping':
        return reply_({ ok: true, data: { email: Session.getEffectiveUser().getEmail() } });

      case 'freeBusy': {
        var fb = Calendar.Freebusy.query({ timeMin: req.timeMin, timeMax: req.timeMax, timeZone: 'Asia/Kolkata', items: [{ id: 'primary' }] });
        var cals = fb.calendars || {};
        var busy = [];
        Object.keys(cals).forEach(function (k) { busy = busy.concat(cals[k].busy || []); });
        return reply_({ ok: true, data: busy });
      }

      case 'listEvents': {
        var opts = { timeMin: req.timeMin, timeMax: req.timeMax, singleEvents: true, showDeleted: true, maxResults: 250, orderBy: 'startTime' };
        if (req.updatedMin) opts.updatedMin = req.updatedMin;
        var list = Calendar.Events.list('primary', opts);
        return reply_({ ok: true, data: list.items || [] });
      }

      case 'createEvent': {
        var event = {
          summary: req.summary,
          description: req.description || '',
          start: { dateTime: req.start, timeZone: 'Asia/Kolkata' },
          end: { dateTime: req.end, timeZone: 'Asia/Kolkata' },
          attendees: (req.attendees || []).map(function (a) { return { email: a }; }),
          conferenceData: { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
          reminders: { useDefault: true },
        };
        var created = Calendar.Events.insert(event, 'primary', { conferenceDataVersion: 1, sendUpdates: 'all' });
        return reply_({ ok: true, data: created });
      }

      case 'sendEmail': {
        MailApp.sendEmail({ to: req.to, subject: req.subject, body: req.text, name: req.name || undefined });
        return reply_({ ok: true, data: { sent: true, remaining: MailApp.getRemainingDailyQuota() } });
      }

      default:
        return reply_({ ok: false, error: 'unknown action' });
    }
  } catch (err) {
    return reply_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
