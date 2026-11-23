"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { brl } from "@/lib/utils";

const axis = { stroke: "hsl(210 15% 45%)", fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: "hsl(220 45% 7%)", border: "1px solid hsl(200 50% 18%)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "hsl(200 30% 92%)" },
};

/** Receita realizada (área) x meta (linha tracejada). */
export function RevenueChart({ data }: { data: { month: string; receita: number; meta: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(188 95% 50%)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="hsl(188 95% 50%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="hsl(200 50% 18% / .4)" vertical={false} />
        <XAxis dataKey="month" {...axis} />
        <YAxis {...axis} tickFormatter={(v) => `${v / 1000}k`} />
        <Tooltip {...tooltipStyle} formatter={(v) => brl(Number(v))} />
        <Area type="monotone" dataKey="receita" name="Receita" stroke="hsl(188 95% 50%)" strokeWidth={2} fill="url(#rev)" />
        <Line type="monotone" dataKey="meta" name="Meta" stroke="hsl(262 83% 70%)" strokeDasharray="4 4" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Quantidade de conteúdos em cada etapa do pipeline. */
export function PipelineChart({ data }: { data: { status: string; qtd: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <CartesianGrid stroke="hsl(200 50% 18% / .4)" vertical={false} />
        <XAxis dataKey="status" {...axis} interval={0} fontSize={10} />
        <YAxis {...axis} allowDecimals={false} />
        <Tooltip {...tooltipStyle} cursor={{ fill: "hsl(188 95% 50% / .06)" }} />
        <Bar dataKey="qtd" name="Conteúdos" fill="hsl(188 95% 50%)" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
