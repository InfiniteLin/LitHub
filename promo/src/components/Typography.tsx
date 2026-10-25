import type {CSSProperties, ReactNode} from 'react';
import {useCurrentFrame} from 'remotion';
import {riseIn, progress, easeInOut} from '../lib/anim';
import {COLORS, LATIN, SERIF, SANS} from '../theme';

/** 小号英文编号，例如 “01 — LIBRARY”。 */
export const Kicker = ({
  children,
  style,
  delay = 0,
  color = COLORS.gold,
}: {
  children: ReactNode;
  style?: CSSProperties;
  delay?: number;
  color?: string;
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: LATIN,
        fontSize: 13,
        letterSpacing: '0.28em',
        color,
        textTransform: 'uppercase',
        ...style,
        ...riseIn(frame, delay, {distance: 12, duration: 22, blur: 0}),
      }}
    >
      {children}
    </div>
  );
};

/** 中文大标题，按行传入，保证断行可控。 */
export const Headline = ({
  lines,
  size = 56,
  delay = 0,
  align = 'left',
  color = COLORS.ink,
  lineHeight = 1.28,
  width,
  style,
}: {
  lines: string[];
  size?: number;
  delay?: number;
  align?: 'left' | 'right' | 'center';
  color?: string;
  lineHeight?: number;
  width?: number | string;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: SERIF,
        fontSize: size,
        lineHeight,
        letterSpacing: '0.015em',
        color,
        textAlign: align,
        width,
        ...style,
      }}
    >
      {lines.map((line, i) => {
        const enter = riseIn(frame, delay + i * 7, {distance: 34, duration: 30, blur: 5});
        return (
          <div key={line} style={{...enter, willChange: 'transform, opacity'}}>
            {line}
          </div>
        );
      })}
    </div>
  );
};

/** 正文说明，24–32px。 */
export const Body = ({
  children,
  size = 26,
  delay = 0,
  color = COLORS.inkSoft,
  style,
}: {
  children: ReactNode;
  size?: number;
  delay?: number;
  color?: string;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: SANS,
        fontSize: size,
        lineHeight: 1.85,
        color,
        ...style,
        ...riseIn(frame, delay, {distance: 20, duration: 26, blur: 3}),
      }}
    >
      {children}
    </div>
  );
};

/** 细线，可生长。 */
export const Rule = ({
  width = 64,
  delay = 0,
  color = COLORS.red,
  thickness = 1,
  style,
}: {
  width?: number;
  delay?: number;
  color?: string;
  thickness?: number;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const p = easeInOut(progress(frame, delay, 30));
  return (
    <div
      style={{
        width,
        height: thickness,
        backgroundColor: color,
        transform: `scaleX(${p})`,
        transformOrigin: 'left center',
        ...style,
      }}
    />
  );
};

/** 文献编号式条目：01 / 导入 PDF。 */
export const IndexItem = ({
  index,
  title,
  note,
  delay = 0,
  activeColor = COLORS.red,
  size = 28,
  style,
}: {
  index: string;
  title: string;
  note?: string;
  delay?: number;
  activeColor?: string;
  size?: number;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const enter = riseIn(frame, delay, {distance: 22, duration: 26, blur: 2});
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 18,
        ...style,
        ...enter,
      }}
    >
      <span
        style={{
          fontFamily: LATIN,
          fontSize: 13,
          color: activeColor,
          letterSpacing: '0.12em',
          minWidth: 28,
        }}
      >
        {index}
      </span>
      <span style={{fontFamily: SANS, fontSize: size, color: COLORS.ink, lineHeight: 1.4}}>
        {title}
        {note ? (
          <span style={{fontSize: size * 0.62, color: COLORS.muted, marginLeft: 10}}>{note}</span>
        ) : null}
      </span>
    </div>
  );
};

/** 右上角页码：03 / 05。 */
export const PageMark = ({current}: {current: string}) => (
  <div
    style={{
      position: 'absolute',
      top: 82,
      right: 84,
      fontFamily: LATIN,
      fontSize: 13,
      letterSpacing: '0.24em',
      color: COLORS.muted,
    }}
  >
    {current} <span style={{color: COLORS.lineStrong}}>/</span> 05
  </div>
);

/** 截图下方的小字图注。 */
export const ShotCaption = ({
  children,
  left,
  top,
  width,
  align = 'left',
}: {
  children: ReactNode;
  left: number;
  top: number;
  width?: number;
  align?: 'left' | 'right';
}) => (
  <div
    style={{
      position: 'absolute',
      left,
      top,
      width,
      textAlign: align,
      fontFamily: LATIN,
      fontSize: 12,
      letterSpacing: '0.22em',
      color: COLORS.muted,
      textTransform: 'uppercase',
    }}
  >
    {children}
  </div>
);
