import type { SVGProps } from "react";

// Lightweight channel glyphs (lucide doesn't ship brand marks).

export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4z" />
      <path d="M9 8.8c0 3 2.6 6 5.9 6.3l1-1.3-1.8-.9-.8.8c-1-.4-2.2-1.6-2.6-2.6l.8-.8-.9-1.8-1.3 1" />
    </svg>
  );
}

export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" {...props}>
      <defs>
        <linearGradient id="cc-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a597ff" />
          <stop offset="1" stopColor="#6d5ce8" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#cc-g)" />
      <path d="M20.5 11.2a6 6 0 1 0 0 9.6" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M9 23 23 9" stroke="white" strokeOpacity=".55" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
