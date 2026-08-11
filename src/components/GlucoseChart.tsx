import React, { Fragment } from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import type { GlucoseReading } from "../types";
import { usePalette } from "../hooks/useThemedStyles";

interface GlucoseChartProps {
  readings: GlucoseReading[]; // orden cronológico ascendente
  low: number;
  high: number;
  width: number;
  height?: number;
}

const PADDING = { top: 16, right: 12, bottom: 26, left: 36 };

function niceStep(range: number): number {
  const candidates = [10, 25, 50, 100];
  for (const step of candidates) {
    if (range / step <= 6) return step;
  }
  return 100;
}

export default function GlucoseChart({
  readings,
  low,
  high,
  width,
  height = 220,
}: GlucoseChartProps) {
  // Antes del return temprano: los hooks no pueden llamarse condicionalmente.
  const c = usePalette();

  if (readings.length < 2) return null;

  const values = readings.map((r) => r.value);
  const dataMin = Math.min(...values, low);
  const dataMax = Math.max(...values, high);
  const step = niceStep(dataMax - dataMin);
  const yMin = Math.floor(dataMin / step) * step;
  const yMax = Math.ceil(dataMax / step) * step;

  const times = readings.map((r) => r.timestampMs);
  const tMin = times[0];
  const tMax = times[times.length - 1];
  const tRange = Math.max(tMax - tMin, 1);

  const innerWidth = width - PADDING.left - PADDING.right;
  const innerHeight = height - PADDING.top - PADDING.bottom;

  const xFor = (t: number) => PADDING.left + ((t - tMin) / tRange) * innerWidth;
  const yFor = (v: number) =>
    PADDING.top + innerHeight - ((v - yMin) / (yMax - yMin)) * innerHeight;

  const points = readings.map((r) => ({ x: xFor(r.timestampMs), y: yFor(r.value) }));

  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    linePath += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
  }
  linePath += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;

  const floorY = PADDING.top + innerHeight;
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${floorY} L ${points[0].x} ${floorY} Z`;

  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax; v += step) yTicks.push(v);

  // Elegimos posiciones de etiqueta evenly-spaced en el eje X (no por índice de
  // lectura), y luego descartamos cualquiera que quede demasiado cerca de la
  // anterior ya aceptada — evita superposición cuando hay lecturas agrupadas.
  const MIN_LABEL_GAP_PX = 56;
  const targetLabelCount = Math.min(5, readings.length);
  const labelIndices: number[] = [];
  let lastAcceptedX = -Infinity;
  for (let i = 0; i < targetLabelCount; i++) {
    const targetX =
      PADDING.left + (innerWidth * i) / (targetLabelCount - 1 || 1);
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let j = 0; j < points.length; j++) {
      const dist = Math.abs(points[j].x - targetX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = j;
      }
    }
    const candidateX = points[bestIdx].x;
    if (candidateX - lastAcceptedX < MIN_LABEL_GAP_PX) continue;
    labelIndices.push(bestIdx);
    lastAcceptedX = candidateX;
  }

  const bandTop = yFor(high);
  const bandBottom = yFor(low);

  const last = readings[readings.length - 1];
  const lastColor =
    last.value < low ? c.status.error.fg : last.value > high ? c.status.warning.fg : c.status.success.fg;

  return (
    <View>
      <Svg width={width} height={height}>
        <Rect
          x={PADDING.left}
          y={bandTop}
          width={innerWidth}
          height={Math.max(bandBottom - bandTop, 0)}
          fill={c.status.success.surface}
        />

        {yTicks.map((v) => (
          <Fragment key={v}>
            <Line
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={yFor(v)}
              y2={yFor(v)}
              stroke={c.border}
              strokeWidth={1}
            />
            <SvgText
              x={PADDING.left - 6}
              y={yFor(v) + 4}
              fontSize={10}
              fill={c.textSecondary}
              textAnchor="end"
            >
              {v}
            </SvgText>
          </Fragment>
        ))}

        <Line
          x1={PADDING.left}
          x2={width - PADDING.right}
          y1={yFor(low)}
          y2={yFor(low)}
          stroke={c.status.error.fg}
          strokeWidth={1.5}
          strokeDasharray="4,4"
        />
        <Line
          x1={PADDING.left}
          x2={width - PADDING.right}
          y1={yFor(high)}
          y2={yFor(high)}
          stroke={c.status.warning.fg}
          strokeWidth={1.5}
          strokeDasharray="4,4"
        />

        <Path d={areaPath} fill={c.accentTranslucent} />
        <Path d={linePath} fill="none" stroke={c.accent} strokeWidth={2.5} />

        {points.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === points.length - 1 ? 5 : 2.5}
            fill={i === points.length - 1 ? lastColor : c.accent}
          />
        ))}

        {labelIndices.map((i) => (
          <SvgText
            key={i}
            x={Math.min(Math.max(points[i].x, PADDING.left + 16), width - PADDING.right - 16)}
            y={height - 8}
            fontSize={10}
            fill={c.textSecondary}
            textAnchor="middle"
          >
            {new Date(readings[i].timestampMs).toLocaleTimeString("es-MX", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
