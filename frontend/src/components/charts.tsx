import React from "react";
import { View } from "react-native";
import Svg, { Circle, G, Path, Line, Text as SvgText } from "react-native-svg";
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
