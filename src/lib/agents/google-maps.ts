import "server-only";

import { z } from "zod";
import { cleanUrl, createLead, existingCompanies, existingRefs, normalizeCompany } from "./leads";
import { defineAgent } from "./types";

// Google Maps agent: finds local businesses (default: the second niche,
// real-estate developers) through the official Places API (Text Search).

const config = z.object({
  queries: z.array(z.string().min(3)).min(1).max(10),
  per_query: z.number().int().min(1).max(20),
  min_reviews: z.number().int().min(0),
  require_website: z.boolean(),
});
type Config = z.infer<typeof config>;

interface Place {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  websiteUri?: string;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  primaryTypeDisplayName?: { text?: string };
}

const FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.websiteUri",
  "places.internationalPhoneNumber",
  "places.nationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.primaryTypeDisplayName",
].join(",");

export const googleMapsAgent = defineAgent<Config>({
  key: "google_maps",
  name: "Google Maps Agent",
  department: "lead_generation",
  description: "Searches Google Maps for businesses in your target niche and city, and adds them with phone, website and rating.",
  requires: ["GOOGLE_MAPS_API_KEY"],
  needsAi: false,
  configSchema: config,
  defaultConfig: {
    queries: ["real estate developers in Pune", "real estate developers in Bengaluru"],
    per_query: 10,
    min_reviews: 10,
    require_website: true,
  },
  configHelp: "queries: what you'd type into Google Maps. per_query: results per search (max 20). min_reviews: skip tiny listings. require_website: skip businesses without a website.",

  async run(ctx, cfg) {
    const companies = await existingCompanies(ctx);
    let created = 0;
    let found = 0;
    for (const query of cfg.queries) {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY!, "X-Goog-FieldMask": FIELDS },
        body: JSON.stringify({ textQuery: query, pageSize: cfg.per_query, languageCode: "en" }),
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Google Places failed (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
      const places = ((await res.json()) as { places?: Place[] }).places ?? [];
      found += places.length;
      const seen = await existingRefs(ctx, places.map((p) => `maps:${p.id}`));

      for (const p of places) {
        const name = p.displayName?.text?.trim();
        if (!name || seen.has(`maps:${p.id}`)) continue;
        if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;
        if ((p.userRatingCount ?? 0) < cfg.min_reviews) continue;
        if (cfg.require_website && !p.websiteUri) continue;
        if (companies.has(normalizeCompany(name))) continue;
        const ok = await createLead(ctx, {
          name,
          company: name,
          phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null,
          website: cleanUrl(p.websiteUri),
          source: "google_maps",
          external_ref: `maps:${p.id}`,
          ai_summary: [p.primaryTypeDisplayName?.text, p.formattedAddress, p.rating ? `★ ${p.rating} (${p.userRatingCount ?? 0} reviews)` : null].filter(Boolean).join(" · "),
          tags: ["google-maps", query],
          activity: `Found on Google Maps for “${query}”`,
        });
        if (ok) {
          created++;
          companies.add(normalizeCompany(name));
        }
      }
    }
    return { status: "success", summary: `Searched ${cfg.queries.length} queries, saw ${found} businesses, added ${created}.`, created, updated: 0 };
  },
});
