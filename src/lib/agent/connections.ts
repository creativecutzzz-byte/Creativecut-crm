// Builds the four rows of Settings → Connections from the stored slot states.
// Each row states its real connection method, status and the single next action.

import type { AgentSnapshot, ApiProvider, ApiSlot, Connection, ConnectionStatus } from "./types";

export const PROVIDERS: Record<ApiProvider, { name: string; purpose: string; keyHelp: string; keyUrl: string }> = {
  web_research: {
    name: "Web Research",
    purpose: "Finds hiring posts on LinkedIn, Reddit, Google and job boards (through Apify).",
    keyHelp: "Apify → Settings → API & Integrations → Personal API token",
    keyUrl: "https://console.apify.com/settings/integrations",
  },
  apollo: {
    name: "Apollo",
    purpose: "Looks up a business email when a post doesn't include one (1 Apollo credit per email found).",
    keyHelp: "Apollo → Settings → Integrations → API → Create new key",
    keyUrl: "https://app.apollo.io/#/settings/integrations/api",
  },
  vibe: {
    name: "Vibe Prospecting",
    purpose: "Second email lookup through Explorium's API (about 2 credits per email found).",
    keyHelp: "Explorium Admin Portal (admin.explorium.ai) → Access & Authentication → Show Key",
    keyUrl: "https://admin.explorium.ai",
  },
};

export const VIBE_SHUTDOWN = "Vibe Prospecting shuts down on 2 Dec 2026 (announced by Vibe). It stops working after that date.";

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  connected: "Connected",
  setup_required: "Setup Required",
  needs_reconnect: "Needs reconnecting",
  checking: "Checking…",
};

function apiRow(slot: ApiSlot | undefined, provider: ApiProvider): Connection {
  const p = PROVIDERS[provider];
  const status = slot?.status ?? "setup_required";
  const details: Connection["details"] = [
    { label: "Connection method", value: "API Key, stored in Google Secret Manager. The key never appears on this page." },
    { label: "Credential slot", value: `Slot ${slot?.slot ?? "—"}` },
    { label: "Saved key", value: slot?.hint ?? "None" },
    { label: "Balance / usage", value: slot?.usage ?? (provider === "apollo" ? "Apollo doesn't report a balance over its API" : "Not available yet") },
    { label: "Where to find the key", value: p.keyHelp },
  ];
  if (provider === "web_research") details.splice(1, 0, { label: "Also uses", value: "Direct Connection: reads brand websites and creativecut.in samples directly (no key)." });
  if (provider === "vibe") details.unshift({ label: "Notice", value: VIBE_SHUTDOWN });
  if (slot?.error) details.push({ label: "Last error", value: slot.error });
  if (slot?.checkedAt) details.push({ label: "Last checked", value: slot.checkedAt });
  return {
    key: provider,
    name: p.name,
    purpose: p.purpose,
    method: "API Key",
    status,
    statusText: STATUS_TEXT[status],
    nextAction: status === "connected" ? "Manage" : status === "needs_reconnect" ? "Reconnect" : "Add API Key",
    details,
  };
}

export function buildConnections(s: Pick<AgentSnapshot, "apiSlots" | "senders">): Connection[] {
  const bySlot = (p: ApiProvider) => s.apiSlots.find((a) => a.provider === p);
  const connected = s.senders.filter((x) => x.status === "connected");
  const broken = s.senders.some((x) => x.status === "needs_reconnect");
  const gmailStatus: ConnectionStatus = broken ? "needs_reconnect" : connected.length ? "connected" : "setup_required";
  const gmail: Connection = {
    key: "gmail",
    name: "Gmail",
    purpose: "Sends your approved emails from up to three Gmail addresses, and watches for replies and bounces.",
    method: "Google sign-in",
    status: gmailStatus,
    statusText: gmailStatus === "connected" ? `${connected.length} of 3 senders connected` : STATUS_TEXT[gmailStatus],
    nextAction: broken ? "Reconnect" : connected.length < 3 ? "Add a sender" : "Manage",
    details: [
      { label: "Connection method", value: "Google sign-in. Permissions: send email, and read message headers to spot replies and bounces. Message bodies aren't read." },
      ...s.senders.map((x) => ({
        label: `Sender ${x.slot}`,
        value: x.email ? `${x.email} — ${Math.max(0, x.dailyCap - x.sentToday)} of ${x.dailyCap} sends left today` : "Empty slot",
      })),
    ],
  };
  return [apiRow(bySlot("web_research"), "web_research"), apiRow(bySlot("vibe"), "vibe"), apiRow(bySlot("apollo"), "apollo"), gmail];
}
