import { cn, initials } from "@/lib/utils";

const palette = [
  "from-violet-500/80 to-indigo-500/80",
  "from-fuchsia-500/80 to-rose-500/80",
  "from-sky-500/80 to-cyan-500/80",
  "from-emerald-500/80 to-teal-500/80",
  "from-amber-500/80 to-orange-500/80",
];

function hash(value: string) {
  let h = 0;
  for (const char of value) h = (h * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const sizes = { sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-11 text-sm" };
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ring-1 ring-white/10",
        palette[hash(name) % palette.length],
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
