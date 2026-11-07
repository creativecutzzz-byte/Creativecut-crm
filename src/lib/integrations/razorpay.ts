import "server-only";

// Razorpay, read-only: payments for the Sales screen and the daily brief.
// Keys: Razorpay Dashboard → Account & Settings → API keys (Live mode, needs KYC).
// Only GET /v1/payments is used; nothing is captured, refunded or changed.

export interface Payment {
  id: string;
  amount: number; // rupees
  currency: string;
  status: string;
  method: string | null;
  email: string | null;
  contact: string | null;
  description: string | null;
  created_at: string;
}

export const razorpay = {
  isConfigured() {
    return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  },

  /** Captured payments between two dates (max 1,000). Cached for 15 minutes. */
  async payments(from: Date, to: Date): Promise<Payment[]> {
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const out: Payment[] = [];
    for (let skip = 0; skip < 1000; skip += 100) {
      const params = new URLSearchParams({ from: String(Math.floor(from.getTime() / 1000)), to: String(Math.floor(to.getTime() / 1000)), count: "100", skip: String(skip) });
      const res = await fetch(`https://api.razorpay.com/v1/payments?${params}`, {
        headers: { Authorization: `Basic ${auth}` },
        next: { revalidate: 900 },
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await res.json().catch(() => ({}))) as { items?: RawPayment[]; error?: { description?: string } };
      if (!res.ok) throw new Error(`Razorpay: ${json.error?.description ?? `HTTP ${res.status}`}`);
      const items = json.items ?? [];
      out.push(
        ...items.map((p) => ({
          id: p.id,
          amount: (p.amount ?? 0) / 100,
          currency: p.currency ?? "INR",
          status: p.status ?? "",
          method: p.method ?? null,
          email: p.email ?? null,
          contact: p.contact ?? null,
          description: p.description ?? null,
          created_at: new Date((p.created_at ?? 0) * 1000).toISOString(),
        })),
      );
      if (items.length < 100) break;
    }
    return out;
  },
};

interface RawPayment {
  id: string;
  amount?: number;
  currency?: string;
  status?: string;
  method?: string;
  email?: string;
  contact?: string;
  description?: string;
  created_at?: number;
}
