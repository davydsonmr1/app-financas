import { View, Text } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme, spacing } from '@/constants/theme';
import { formatBRL } from '@/lib/dashboard-calc';
import type { PieSlice } from '@/lib/dashboard-calc';

const SIZE = 180;
const STROKE = 26;
const R = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;

function polarToCartesian(angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + R * Math.cos(angleRad), y: CENTER + R * Math.sin(angleRad) };
}

function arcPath(startAngle: number, endAngle: number): string {
  // Círculo completo não desenha via arc-flag sozinho; recorta 0.01° para evitar path degenerado.
  const clampedEnd = endAngle - startAngle >= 359.99 ? startAngle + 359.99 : endAngle;
  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(clampedEnd);
  const largeArc = clampedEnd - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function PieChart({
  slices,
  onSlicePress,
  centerLabel,
  centerValue,
}: {
  slices: PieSlice[];
  onSlicePress?: (slice: PieSlice) => void;
  centerLabel?: string;
  centerValue?: string;
}) {
  const t = useTheme();
  const total = slices.reduce((s, sl) => s + sl.value, 0);

  if (total <= 0) {
    return (
      <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg }}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={R}
            stroke={t.border}
            strokeWidth={STROKE}
            fill="none"
          />
        </Svg>
        <Text style={{ color: t.textMuted, fontSize: 13 }}>Sem lançamentos no período</Text>
      </View>
    );
  }

  let angle = 0;
  const arcs = slices.map((s) => {
    const sweep = (s.value / total) * 360;
    const startAngle = angle;
    angle += sweep;
    return { ...s, startAngle, endAngle: angle };
  });

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE}>
          {arcs.map((a) => (
            <Path
              key={a.key}
              d={arcPath(a.startAngle, a.endAngle)}
              stroke={a.color}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap={arcs.length > 1 ? 'butt' : 'round'}
              onPress={onSlicePress ? () => onSlicePress(a) : undefined}
            />
          ))}
        </Svg>
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          pointerEvents="none"
        >
          <Text style={{ color: t.textMuted, fontSize: 11, fontWeight: '600' }}>
            {centerLabel ?? 'Total'}
          </Text>
          <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>
            {centerValue ?? formatBRL(total)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function PieLegend({
  slices,
  total,
  onPress,
}: {
  slices: PieSlice[];
  total?: number;
  onPress?: (slice: PieSlice) => void;
}) {
  const t = useTheme();
  const sum = total ?? slices.reduce((s, sl) => s + sl.value, 0);

  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
      {slices.map((s) => {
        const pct = sum > 0 ? (s.value / sum) * 100 : 0;
        return (
          <View
            key={s.key}
            onTouchEnd={onPress ? () => onPress(s) : undefined}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 4,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
              <Text style={{ color: t.text, fontSize: 14 }} numberOfLines={1}>
                {s.label}
              </Text>
            </View>
            <Text style={{ color: t.textMuted, fontSize: 13, marginRight: spacing.sm }}>
              {pct.toFixed(0)}%
            </Text>
            <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>
              {formatBRL(s.value)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
