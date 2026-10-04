import React from "react";
import { View } from "react-native";
import Svg, { Circle, G, Path, Line, Rect, Text as SvgText, Defs, Stop, LinearGradient as SvgGrad } from "react-native-svg";

import { useTheme } from "@/src/theme";

export function DonutChart({
  data,
  size = 160,
  thickness = 22,
}: { data: { value: number; color: string }[]; size?: number; thickness?: number }) {
  const { colors } = useTheme();
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2 - thickness / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <Svg width={size} height={size}>
      <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceTertiary} strokeWidth={thickness} fill="none" />
        {data.map((d, i) => {
          const len = (d.value / total) * c;
          const dash = `${len} ${c - len}`;
          const offset = -acc;
          acc += len;
          return (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={d.color}
              strokeWidth={thickness}
              strokeDasharray={dash}
              strokeDashoffset={offset}
              strokeLinecap="butt"
              fill="none"
            />
          );
        })}
      </G>
    </Svg>
  );
}

export function ProgressRing({
  value,
  size = 130,
  thickness = 12,
  color,
  bg,
}: { value: number; size?: number; thickness?: number; color?: string; bg?: string }) {
  const { colors } = useTheme();
  const col = color ?? colors.success;
  const pct = Math.max(0, Math.min(100, value));
  const r = size / 2 - thickness / 2;
  const c = 2 * Math.PI * r;
  const len = (pct / 100) * c;
  return (
    <Svg width={size} height={size}>
      <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={bg ?? colors.surfaceTertiary} strokeWidth={thickness} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={col}
          strokeWidth={thickness}
          strokeDasharray={`${len} ${c - len}`}
          strokeLinecap="round"
          fill="none"
        />
      </G>
    </Svg>
  );
}

export function LineDualChart({
  income,
  expense,
  labels,
  width = 320,
  height = 160,
}: { income: number[]; expense: number[]; labels: string[]; width?: number; height?: number }) {
  const { colors } = useTheme();
  const pad = { l: 28, r: 12, t: 14, b: 24 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const all = [...income, ...expense, 1];
  const max = Math.max(...all);
  const n = Math.max(income.length, 1);
  const x = (i: number) => pad.l + (n === 1 ? w / 2 : (i * w) / (n - 1));
  const y = (v: number) => pad.t + h - (v / max) * h;
  const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  return (
    <Svg width={width} height={height}>
      {[0, 0.5, 1].map((f, i) => (
        <Line key={i} x1={pad.l} x2={pad.l + w} y1={pad.t + h * f} y2={pad.t + h * f} stroke={colors.divider} strokeWidth={1} />
      ))}
      <Path d={path(income)} stroke={colors.success} strokeWidth={2.5} fill="none" />
      <Path d={path(expense)} stroke={colors.error} strokeWidth={2.5} fill="none" />
      {income.map((v, i) => (
        <Circle key={`i${i}`} cx={x(i)} cy={y(v)} r={3} fill={colors.success} />
      ))}
      {expense.map((v, i) => (
        <Circle key={`e${i}`} cx={x(i)} cy={y(v)} r={3} fill={colors.error} />
      ))}
      {labels.map((l, i) => (
        <SvgText key={l + i} x={x(i)} y={height - 6} fontSize={9} fill={colors.muted} textAnchor="middle">
          {l}
        </SvgText>
      ))}
    </Svg>
  );
}

export function GroupedBarChart({
  data,
  colorA,
  colorB,
  width = 320,
  height = 150,
  highlightLast = true,
}: {
  data: { label: string; a: number; b: number }[];
  colorA: string;
  colorB: string;
  width?: number;
  height?: number;
  highlightLast?: boolean;
}) {
  const { colors } = useTheme();
  const pad = { l: 8, r: 8, t: 12, b: 22 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = Math.max(1, ...data.map((d) => Math.max(d.a, d.b)));
  const n = Math.max(data.length, 1);
  const group = w / n;
  const bw = Math.min(10, group * 0.22);
  const gap = 4;
  const yOf = (v: number) => pad.t + h - (v / max) * h;
  return (
    <Svg width={width} height={height}>
      {[0, 0.5, 1].map((f, i) => (
        <Line key={i} x1={pad.l} x2={pad.l + w} y1={pad.t + h * f} y2={pad.t + h * f} stroke={colors.divider} strokeWidth={1} />
      ))}
      {data.map((d, i) => {
        const cx = pad.l + group * i + group / 2;
        const last = highlightLast && i === data.length - 1;
        const op = last ? 1 : 0.55;
        const aH = Math.max(2, pad.t + h - yOf(d.a));
        const bH = Math.max(2, pad.t + h - yOf(d.b));
        return (
          <G key={d.label + i}>
            <Rect x={cx - bw - gap / 2} y={yOf(d.a)} width={bw} height={aH} rx={bw / 2} fill={colorA} opacity={op} />
            <Rect x={cx + gap / 2} y={yOf(d.b)} width={bw} height={bH} rx={bw / 2} fill={colorB} opacity={op} />
            <SvgText x={cx} y={height - 6} fontSize={9} fontWeight={last ? "700" : "400"} fill={last ? colors.onSurface : colors.muted} textAnchor="middle">
              {d.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}


export function SavingsLineChart({
  data,
  labels,
  color,
  width = 320,
  height = 180,
}: { data: number[]; labels: string[]; color?: string; width?: number; height?: number }) {
  const { colors } = useTheme();
  const col = color ?? colors.brandPrimary;
  const pad = { l: 34, r: 14, t: 18, b: 24 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = Math.max(1, ...data);
  const n = Math.max(data.length, 1);
  const x = (i: number) => pad.l + (n === 1 ? w : (i * w) / (n - 1));
  const y = (v: number) => pad.t + h - (v / max) * h;
  const linePath = data.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  const areaPath = `${linePath} L ${x(data.length - 1)} ${pad.t + h} L ${x(0)} ${pad.t + h} Z`;
  const fmt = (v: number) => (v >= 1_000_000 ? `${Math.round(v / 1_000_000)} jt` : v >= 1000 ? `${Math.round(v / 1000)} rb` : `${Math.round(v)}`);
  const last = data[data.length - 1] ?? 0;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGrad id="savfill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={col} stopOpacity={0.35} />
          <Stop offset="1" stopColor={col} stopOpacity={0.02} />
        </SvgGrad>
      </Defs>
      {[0, 0.5, 1].map((f, i) => (
        <G key={i}>
          <Line x1={pad.l} x2={pad.l + w} y1={pad.t + h * f} y2={pad.t + h * f} stroke={colors.divider} strokeWidth={1} />
          <SvgText x={pad.l - 6} y={pad.t + h * f + 3} fontSize={8} fill={colors.muted} textAnchor="end">
            {fmt(max * (1 - f))}
          </SvgText>
        </G>
      ))}
      {data.length > 1 ? <Path d={areaPath} fill="url(#savfill)" /> : null}
      <Path d={linePath} stroke={col} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((v, i) => (
        <Circle key={i} cx={x(i)} cy={y(v)} r={i === data.length - 1 ? 4.5 : 3} fill={i === data.length - 1 ? col : colors.surface} stroke={col} strokeWidth={2} />
      ))}
      {data.length ? (
        <G>
          <Rect x={Math.min(x(data.length - 1) - 34, width - 72)} y={Math.max(2, y(last) - 26)} width={66} height={18} rx={9} fill={col} />
          <SvgText x={Math.min(x(data.length - 1) - 1, width - 39)} y={Math.max(2, y(last) - 26) + 12.5} fontSize={9} fontWeight="700" fill={colors.onBrandPrimary} textAnchor="middle">
            {`Rp${fmt(last)}`}
          </SvgText>
        </G>
      ) : null}
      {labels.map((l, i) => (
        <SvgText key={l + i} x={x(i)} y={height - 6} fontSize={9} fill={colors.muted} textAnchor="middle">
          {l}
        </SvgText>
      ))}
    </Svg>
  );
}
