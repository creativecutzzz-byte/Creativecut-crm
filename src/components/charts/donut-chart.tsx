"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { sourcePalette, tooltipStyle } from "./theme";

export function DonutChart({ data, centerLabel, centerValue }: { data: { name: string; value: number }[]; centerLabel: string; centerValue: string }) {
  return (
    <div className="relative h-48 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Tooltip {...tooltipStyle} />
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="92%" paddingAngle={2} stroke="none">
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={sourcePalette[i % sourcePalette.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-2xl font-semibold tabular-nums">{centerValue}</p>
          <p className="text-[11px] text-muted">{centerLabel}</p>
        </div>
      </div>
    </div>
  );
}
