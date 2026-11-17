"use client";

import { chartColors, sourcePalette, tooltipStyle } from "@/components/charts/theme";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function SendsChart({ data }: { data: { day: string; sent: number; replies: number; interested: number; meetings: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 0, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={chartColors.grid} vertical={false} />
          <XAxis dataKey="day" stroke={chartColors.axis} tickLine={false} axisLine={false} fontSize={11} minTickGap={16} />
          <YAxis stroke={chartColors.axis} tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="sent" name="Sent" fill={chartColors.accent} radius={[3, 3, 0, 0]} maxBarSize={16} />
          <Bar dataKey="replies" name="Replies" fill={chartColors.accent5} radius={[3, 3, 0, 0]} maxBarSize={16} />
          <Bar dataKey="interested" name="Interested" fill={chartColors.accent2} radius={[3, 3, 0, 0]} maxBarSize={16} />
          <Bar dataKey="meetings" name="Meetings" fill={chartColors.accent4} radius={[3, 3, 0, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ModelChainChart({ models, data }: { models: string[]; data: Record<string, number | string>[] }) {
  if (!data.length) return <p className="py-10 text-center text-xs text-muted">No research yet.</p>;
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={chartColors.grid} vertical={false} />
          <XAxis dataKey="day" stroke={chartColors.axis} tickLine={false} axisLine={false} fontSize={11} />
          <YAxis stroke={chartColors.axis} tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {models.map((m, i) => (
            <Line key={m} type="monotone" dataKey={m} stroke={sourcePalette[i % sourcePalette.length]} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
