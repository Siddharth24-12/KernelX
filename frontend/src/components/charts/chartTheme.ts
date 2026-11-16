import type { CSSProperties } from 'react'

/** Shared hover and tooltip tokens for the simulator's Recharts visualizations. */
export const kernelTooltipProps = {
  contentStyle: {
    backgroundColor: '#111511',
    border: '1px solid rgba(199,243,107,.24)',
    borderRadius: 5,
    padding: '8px 10px',
    boxShadow: '0 8px 22px rgba(0,0,0,.38)',
  } satisfies CSSProperties,
  labelStyle: {
    color: '#F1F0E8',
    fontFamily: '"JetBrains Mono", Consolas, monospace',
    fontSize: 10,
    marginBottom: 4,
  } satisfies CSSProperties,
  itemStyle: {
    color: '#C7CBC3',
    fontFamily: '"JetBrains Mono", Consolas, monospace',
    fontSize: 10,
  } satisfies CSSProperties,
  wrapperStyle: { outline: 'none', zIndex: 30 } satisfies CSSProperties,
  animationDuration: 110,
}

export const kernelChartCursor = {
  fill: 'rgba(199,243,107,.045)',
  stroke: 'rgba(199,243,107,.18)',
  strokeWidth: 1,
}

export const kernelActiveBar = {
  stroke: '#C7F36B',
  strokeWidth: 1,
}

export const kernelActiveDot = {
  r: 4,
  fill: '#C7F36B',
  stroke: '#0B0D0C',
  strokeWidth: 2,
}
