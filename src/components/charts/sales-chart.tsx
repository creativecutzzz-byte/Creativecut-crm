"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartColors, tooltipStyle } from "./theme";

function rupees(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
  return `₹${v}`;
}

export function SalesChart({ data }: { data: { date: string; amount: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 0, left: -8, bottom: 0 }}>
          <CartesianGrid stroke={chartColors.grid} vertical={false} />
          <XAxis dataKey="date" stroke={chartColors.axis} tickLine={false} axisLine={false} fontSize={11} minTickGap={20} />
          <YAxis stroke={chartColors.axis} tickLine={false} axisLine={false} fontSize={11} tickFormatter={rupees} />
          <Tooltip {...tooltipStyle} formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Sales"]} />
          <Bar dataKey="amount" name="Sales" fill={chartColors.accent} radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
