/**
 * 确定性动画工具。
 *
 * 全部基于 useCurrentFrame 的纯函数：同一个 frame 永远得到同一个画面，
 * 不依赖 Date/随机数/requestAnimationFrame，因此可被 Remotion 逐帧渲染。
 */

import {interpolate, spring} from 'remotion';
import {FPS} from '../theme';

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** 标准化进度：frame 在 [start, start+duration] 之间的 0→1。 */
export const progress = (frame: number, start: number, duration: number) =>
  duration <= 0 ? (frame >= start ? 1 : 0) : clamp01((frame - start) / duration);

export const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export const easeIn = (t: number) => t * t * t;

/** 缓入缓出的 0→1→0 透明度包络，用于段落间的柔和过渡。 */
export const envelope = (
  frame: number,
  start: number,
  end: number,
  fadeInFrames = 18,
  fadeOutFrames = 18,
) => {
  const inP = easeInOut(progress(frame, start, fadeInFrames));
  const outP = 1 - easeInOut(progress(frame, end - fadeOutFrames, fadeOutFrames));
  return Math.min(inP, outP);
};

export type EnterStyle = {
  opacity: number;
  transform: string;
  filter: string;
};

/** 上浮入场：透明 + 位移 + 轻微模糊，dur 帧内完成。 */
export const riseIn = (
  frame: number,
  start: number,
  {
    distance = 26,
    duration = 26,
    blur = 6,
  }: {distance?: number; duration?: number; blur?: number} = {},
): EnterStyle => {
  const p = easeOut(progress(frame, start, duration));
  return {
    opacity: p,
    transform: `translateY(${(1 - p) * distance}px)`,
    filter: blur > 0 ? `blur(${(1 - p) * blur}px)` : 'none',
  };
};

/** 淡入。 */
export const fadeIn = (frame: number, start: number, duration = 20): EnterStyle => {
  const p = easeOut(progress(frame, start, duration));
  return {opacity: p, transform: 'none', filter: 'none'};
};

/**
 * 推镜：从 start 到 end，scale 从 from 缓慢到 to，用于截图“慢推”。
 * 用 easeInOut 让起止更柔。
 */
export const slowPush = (
  frame: number,
  start: number,
  end: number,
  from = 1,
  to = 1.05,
) => from + (to - from) * easeInOut(progress(frame, start, end - start));

/** 横向慢移（用于 02 的左右分屏错位）。 */
export const slowPan = (frame: number, start: number, end: number, from: number, to: number) =>
  from + (to - from) * easeInOut(progress(frame, start, end - start));

/**
 * 弹簧入场（0→1），可指定 damping / stiffness / mass。
 * 只用于“小元素”的轻微弹入，避免整片廉价感。
 */
export const softSpring = (
  frame: number,
  start: number,
  {damping = 200, stiffness = 120, mass = 0.9} = {},
) => {
  const s = spring({
    frame: frame - start,
    fps: FPS,
    config: {damping, stiffness, mass},
    durationInFrames: 40,
  });
  return s;
};

/**
 * 分批入场：第 index 个元素相对基准 start 延后 stagger 帧。
 * 返回可直接展开到 style 的 {opacity, transform, filter}。
 */
export const staggerRise = (
  frame: number,
  start: number,
  index: number,
  stagger = 8,
  options: {distance?: number; duration?: number; blur?: number} = {},
) => riseIn(frame, start + index * stagger, options);

/** 逐字入场：返回某个字符的透明度与位移。 */
export const charIn = (
  frame: number,
  start: number,
  index: number,
  stagger = 2.4,
  distance = 30,
  duration = 24,
) => {
  const p = easeOut(progress(frame, start + index * stagger, duration));
  return {
    opacity: p,
    transform: `translateY(${(1 - p) * distance}px)`,
    filter: p < 0.95 ? `blur(${(1 - p) * 4}px)` : 'none',
  };
};

/** 竖直细线生长：0→1。 */
export const lineGrow = (frame: number, start: number, duration = 30) =>
  easeInOut(progress(frame, start, duration));

/**
 * 擦拭（wipe）：用于截图/强调色块的 reveal。
 * direction: 'left' 从左向右揭开，'right' 从右向左。
 */
export const wipe = (
  frame: number,
  start: number,
  duration = 26,
  direction: 'left' | 'right' = 'left',
) => {
  const p = easeInOut(progress(frame, start, duration));
  const hidden = 100 - p * 100;
  return {
    clipPath:
      direction === 'left'
        ? `inset(0 ${hidden}% 0 0)`
        : `inset(0 0 0 ${hidden}%)`,
  };
};

/** 多段插值封装的数字动画。 */
export const animate = (
  frame: number,
  input: number[],
  output: number[],
  easing: (t: number) => number = easeInOut,
) =>
  interpolate(frame, input, output, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });
