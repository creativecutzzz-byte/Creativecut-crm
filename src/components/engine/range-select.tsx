import { cn } from "@/lib/utils";
import Link from "next/link";

export function RangeSelect({ range, filter }: { range: number; filter: string }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5 text-xs">
      {[7, 30, 90].map((d) => (
        <Link key={d} href={`/engine?range=${d}&feed=${filter}`} className={cn("rounded-md px-3 py-1.5", d === range ? "bg-surface-3 text-fg" : "text-muted hover:text-fg")}>
          {d}d
        </Link>
      ))}
    </div>
  );
}
