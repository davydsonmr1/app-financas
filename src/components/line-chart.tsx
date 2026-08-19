import { View, Text } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useTheme, spacing } from '@/constants/theme';

const WIDTH = 320;
const HEIGHT = 180;
const PAD = 28;

export type LineSeries = {
  label: string;
  color: string;
  dashed?: boolean;
  points: number[]; // valor acumulado por dia, índice 0 = dia 1
};

export function AccumulatedLineChart({
  series,
  cutoffDay,
}: {
  series: LineSeries[];
  /** dia em que a série "atual" para — depois disso é passado/projeção do mês de referência */
  cutoffDay?: number;
}) {
  const t = useTheme();
  const maxDays = Math.max(1, ...series.map((s) => s.points.length));
  const maxVal = Math.max(1, ...series.flatMap((s) => s.points));

  const x = (day: number) => PAD + (day / (maxDays - 1 || 1)) * (WIDTH - PAD * 2);
  const y = (val: number) => HEIGHT - PAD - (val / maxVal) * (HEIGHT - PAD * 2);

  const toPath = (points: number[]) =>
    points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');

  return (
    <View>
      <Svg width={WIDTH} height={HEIGHT}>
        {[0, 0.5, 1].map((f) => (
          <Line
            key={f}
            x1={PAD}
            x2={WIDTH - PAD}
            y1={PAD + f * (HEIGHT - PAD * 2)}
            y2={PAD + f * (HEIGHT - PAD * 2)}
            stroke={t.border}
            strokeWidth={1}
          />
        ))}

        {cutoffDay ? (
          <Line
            x1={x(cutoffDay)}
            x2={x(cutoffDay)}
            y1={PAD}
            y2={HEIGHT - PAD}
            stroke={t.textMuted}
            strokeWidth={1}
            strokeDasharray="3,3"
          />
        ) : null}

        {series.map((s) => (
          <Path
            key={s.label}
            d={toPath(s.points)}
            stroke={s.color}
            strokeWidth={2.5}
            fill="none"
            strokeDasharray={s.dashed ? '6,4' : undefined}
          />
        ))}

        {series.map((s) =>
          s.points.length > 0 ? (
            <Circle
              key={`${s.label}-end`}
              cx={x(s.points.length - 1)}
              cy={y(s.points[s.points.length - 1])}
              r={4}
              fill={s.color}
            />
          ) : null,
        )}
      </Svg>

      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap' }}>
        {series.map((s) => (
          <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 3, backgroundColor: s.color, opacity: s.dashed ? 0.6 : 1 }} />
            <Text style={{ color: t.textMuted, fontSize: 12 }}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
