"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartColors, tooltipStyle } from "./theme";

const usd = (v: number) => `$${Math.round(v / 1000)}k`;

export function RevenueChart({ data }: { data: { month: string; revenue: number; pipeline: number }[] }) {
  return (
    <div className="h-64 w-full xl:h-full xl:min-h-64">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColors.accent} stopOpacity={0.45} />
              <stop offset="100%" stopColor={chartColors.accent} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="pipe" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColors.accent2} stopOpacity={0.18} />
              <stop offset="100%" stopColor={chartColors.accent2} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={chartColors.grid} vertical={false} />
          <XAxis dataKey="month" stroke={chartColors.axis} tickLine={false} axisLine={false} fontSize={12} />
          <YAxis stroke={chartColors.axis} tickLine={false} axisLine={false} fontSize={12} tickFormatter={usd} />
          <Tooltip {...tooltipStyle} formatter={(v) => `$${Number(v).toLocaleString()}`} />
          <Area type="monotone" dataKey="pipeline" name="Pipeline" stroke={chartColors.accent2} strokeWidth={1.5} strokeDasharray="4 4" fill="url(#pipe)" />
          <Area type="monotone" dataKey="revenue" name="Closed revenue" stroke={chartColors.accent} strokeWidth={2} fill="url(#rev)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
