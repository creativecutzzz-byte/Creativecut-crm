// Country names -> ISO 3166-1 alpha-2, and a sensible default time zone per
// country (the capital / main business hub). A lead's own `timezone` column,
// when present, always wins.

const NAMES: Record<string, string> = {
  "india": "IN", "united states": "US", "united states of america": "US", "usa": "US", "us": "US", "america": "US",
  "canada": "CA", "united kingdom": "GB", "uk": "GB", "great britain": "GB", "england": "GB", "scotland": "GB", "wales": "GB",
  "australia": "AU", "new zealand": "NZ", "singapore": "SG", "united arab emirates": "AE", "uae": "AE", "dubai": "AE",
  "germany": "DE", "france": "FR", "netherlands": "NL", "ireland": "IE", "spain": "ES", "italy": "IT", "sweden": "SE",
  "south africa": "ZA", "saudi arabia": "SA", "israel": "IL", "japan": "JP", "brazil": "BR", "mexico": "MX",
};

const TIMEZONES: Record<string, string> = {
  IN: "Asia/Kolkata", US: "America/New_York", CA: "America/Toronto", GB: "Europe/London", AU: "Australia/Sydney",
  NZ: "Pacific/Auckland", SG: "Asia/Singapore", AE: "Asia/Dubai", DE: "Europe/Berlin", FR: "Europe/Paris",
  NL: "Europe/Amsterdam", IE: "Europe/Dublin", ES: "Europe/Madrid", IT: "Europe/Rome", SE: "Europe/Stockholm",
  ZA: "Africa/Johannesburg", SA: "Asia/Riyadh", IL: "Asia/Jerusalem", JP: "Asia/Tokyo", BR: "America/Sao_Paulo",
  MX: "America/Mexico_City",
};

export function countryCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (/^[A-Za-z]{2}$/.test(v)) {
    const up = v.toUpperCase();
    return up === "UK" ? "GB" : up;
  }
  return NAMES[v.toLowerCase()] ?? null;
}

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Lead time zone: explicit value if valid, else the country default, else the fallback (OUTREACH_DEFAULT_TIMEZONE or UTC). */
export function leadTimeZone(timezone: string | null | undefined, country: string | null | undefined) {
  if (timezone && isValidTimeZone(timezone)) return timezone;
  const code = countryCode(country);
  if (code && TIMEZONES[code]) return TIMEZONES[code]!;
  return process.env.OUTREACH_DEFAULT_TIMEZONE || "UTC";
}
