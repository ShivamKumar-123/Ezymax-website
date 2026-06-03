import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { vantage } from '../../theme/vantageTheme';

export default function Sparkline({
  data = [],
  width = 80,
  height = 28,
  strokeWidth = 1.5,
  color,
}) {
  const { path, autoColor } = useMemo(() => {
    if (!Array.isArray(data) || data.length < 2) {
      return { path: '', autoColor: vantage.textMuted };
    }
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);

    let d = '';
    data.forEach((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2) + ' ';
    });
    const up = data[data.length - 1] >= data[0];
    return { path: d.trim(), autoColor: up ? vantage.up : vantage.down };
  }, [data, width, height]);

  const stroke = color || autoColor;

  return (
    <View style={{ width, height }}>
      {path ? (
        <Svg width={width} height={height}>
          <Path d={path} stroke={stroke} strokeWidth={strokeWidth} fill="none" />
        </Svg>
      ) : null}
    </View>
  );
}
