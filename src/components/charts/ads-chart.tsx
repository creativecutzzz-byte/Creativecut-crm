"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartColors, tooltipStyle } from "./theme";

export function AdsChart({ data }: { data: { date: string; spend: number; revenue: number; leads: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 0, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={chartColors.grid} vertical={false} />
          <XAxis dataKey="date" stroke={chartColors.axis} tickLine={false} axisLine={false} fontSize={11} minTickGap={24} />
          <YAxis yAxisId="usd" stroke={chartColors.axis} tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
          <YAxis yAxisId="count" orientation="right" stroke={chartColors.axis} tickLine={false} axisLine={false} fontSize={11} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12, color: chartColors.axis }} iconType="circle" iconSize={8} />
          <Bar yAxisId="usd" dataKey="spend" name="Spend" fill={chartColors.accent} radius={[4, 4, 0, 0]} maxBarSize={14} />
          <Line yAxisId="usd" type="monotone" dataKey="revenue" name="Attributed revenue" stroke={chartColors.accent2} strokeWidth={2} dot={false} />
          <Line yAxisId="count" type="monotone" dataKey="leads" name="Leads" stroke={chartColors.accent4} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
