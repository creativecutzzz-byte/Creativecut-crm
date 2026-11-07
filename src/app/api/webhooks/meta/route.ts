import { instagram } from "@/lib/integrations";
import { verifySignature } from "@/lib/integrations/meta";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";

// One callback URL for both products in the Meta app:
//   WhatsApp → Configuration → Webhook, subscribe to "messages"
//   Instagram → API setup with Instagram login → Webhooks, subscribe to "messages"
//
// GET  answers Meta's verification handshake (hub.verify_token).
// POST is signed by Meta (X-Hub-Signature-256); unsigned or wrongly signed
// requests are rejected before anything is parsed.

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (expected && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === expected) {
    return new NextResponse(params.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const supabase = createAdminClient();
  const workspace = process.env.META_WEBHOOK_WORKSPACE;
  if (!supabase || !workspace) {
    console.error("[meta webhook] SUPABASE_SERVICE_ROLE_KEY or META_WEBHOOK_WORKSPACE is not set; event dropped.");
    return NextResponse.json({ ok: true });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw) as WebhookPayload;
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }

  const ingest = async (args: { channel: "whatsapp" | "instagram"; from: string; name?: string; handle?: string; body: string; externalId?: string }) => {
    const { error } = await supabase.rpc("ingest_inbound_message", {
      p_org_slug: workspace,
      p_channel: args.channel,
      p_from: args.from,
      p_name: args.name ?? null,
      p_handle: args.handle ?? null,
      p_body: args.body,
      p_external_id: args.externalId ?? null,
    });
    if (error) console.error(`[meta webhook] ingest failed: ${error.message}`);
  };

  try {
    if (payload.object === "whatsapp_business_account") {
      for (const entry of payload.entry ?? []) {
        for (const change of entry.changes ?? []) {
          const value = change.value;
          if (!value) continue;
          const ownNumber = process.env.WHATSAPP_PHONE_NUMBER_ID;
          if (ownNumber && value.metadata?.phone_number_id && value.metadata.phone_number_id !== ownNumber) continue;

          for (const msg of value.messages ?? []) {
            const contact = value.contacts?.find((c) => c.wa_id === msg.from);
            await ingest({ channel: "whatsapp", from: msg.from, name: contact?.profile?.name, body: whatsappText(msg), externalId: msg.id });
          }
          for (const status of value.statuses ?? []) {
            if (!["sent", "delivered", "read", "failed"].includes(status.status)) continue;
            const errorText = status.errors?.map((e) => e.title || e.message).filter(Boolean).join("; ") || null;
            const { error } = await supabase.rpc("update_message_status", { p_external_id: status.id, p_status: status.status, p_error: errorText });
            if (error) console.error(`[meta webhook] status update failed: ${error.message}`);
          }
        }
      }
    } else if (payload.object === "instagram" || payload.object === "page") {
      for (const entry of payload.entry ?? []) {
        for (const event of entry.messaging ?? []) {
          const msg = event.message;
          const senderId = event.sender?.id;
          // Skip echoes of our own replies and non-message events (reads, reactions…).
          if (!msg || msg.is_echo || !senderId || senderId === entry.id) continue;
          const profile = await instagram.getProfile(senderId);
          const body = msg.text || (msg.attachments?.length ? `[${msg.attachments.map((a) => a.type).join(", ")}]` : "[message]");
          await ingest({ channel: "instagram", from: senderId, name: profile.name, handle: profile.username, body, externalId: msg.mid });
        }
      }
    }
  } catch (err) {
    console.error("[meta webhook] processing error", err instanceof Error ? err.message : err);
  }

  // Always 200 quickly so Meta doesn't retry and disable the subscription.
  return NextResponse.json({ ok: true });
}

function whatsappText(msg: WhatsAppMessage) {
  switch (msg.type) {
    case "text":
      return msg.text?.body ?? "";
    case "button":
      return msg.button?.text ?? "[button]";
    case "interactive":
      return msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? "[interactive]";
    case "image":
    case "video":
    case "document":
      return `[${msg.type}]${msg[msg.type]?.caption ? ` ${msg[msg.type]!.caption}` : ""}`;
    default:
      return `[${msg.type}]`;
  }
}

interface WhatsAppMessage {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { caption?: string };
}

interface WebhookPayload {
  object?: string;
  entry?: {
    id?: string;
    changes?: {
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { wa_id: string; profile?: { name?: string } }[];
        messages?: WhatsAppMessage[];
        statuses?: { id: string; status: string; errors?: { title?: string; message?: string }[] }[];
      };
    }[];
    messaging?: {
      sender?: { id: string };
      recipient?: { id: string };
      message?: { mid?: string; text?: string; is_echo?: boolean; attachments?: { type: string }[] };
    }[];
  }[];
}
