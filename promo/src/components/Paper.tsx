import type {ReactNode} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {envelope} from '../lib/anim';
import {COLORS} from '../theme';

/**
 * 纸面底：米白 + 极细纸纹 + 四角裁切标记。
 * 不用大面积渐变，保持印刷品的平面感。
 */
export const Paper = () => (
  <AbsoluteFill style={{backgroundColor: COLORS.paper}}>
    <AbsoluteFill
      style={{
        backgroundImage:
          'radial-gradient(circle at 1px 1px, rgba(41,41,34,0.10) 1px, transparent 0)',
        backgroundSize: '7px 7px',
        opacity: 0.22,
      }}
    />
    <CornerMarks />
  </AbsoluteFill>
);

const corner: React.CSSProperties = {
  position: 'absolute',
  width: 22,
  height: 22,
  opacity: 0.42,
};

const CornerMarks = () => (
  <>
    <div
      style={{
        ...corner,
        left: 44,
        top: 44,
        borderLeft: `1px solid ${COLORS.ink}`,
        borderTop: `1px solid ${COLORS.ink}`,
      }}
    />
    <div
      style={{
        ...corner,
        right: 44,
        top: 44,
        borderRight: `1px solid ${COLORS.ink}`,
        borderTop: `1px solid ${COLORS.ink}`,
      }}
    />
    <div
      style={{
        ...corner,
        left: 44,
        bottom: 44,
        borderLeft: `1px solid ${COLORS.ink}`,
        borderBottom: `1px solid ${COLORS.ink}`,
      }}
    />
    <div
      style={{
        ...corner,
        right: 44,
        bottom: 44,
        borderRight: `1px solid ${COLORS.ink}`,
        borderBottom: `1px solid ${COLORS.ink}`,
      }}
    />
  </>
);

/**
 * 段落容器：统一做淡入淡出，相邻场景在纸面上柔和交叠，不出现黑帧。
 * fadeIn / fadeOut 为帧数。
 */
export const SceneShell = ({
  duration,
  children,
  fadeIn = 16,
  fadeOut = 20,
}: {
  duration: number;
  children: ReactNode;
  fadeIn?: number;
  fadeOut?: number;
}) => {
  const frame = useCurrentFrame();
  const opacity = envelope(frame, 0, duration, fadeIn, fadeOut);
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
};
