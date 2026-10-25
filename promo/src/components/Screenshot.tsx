import type {CSSProperties} from 'react';
import {Img, staticFile} from 'remotion';
import {SHOT_RATIO} from '../theme';

/** 源图中的裁切区域，取值为 0–1 的比例。 */
export type Crop = {x: number; y: number; w: number; h: number};

export const FULL: Crop = {x: 0, y: 0, w: 1, h: 1};

/**
 * 真实应用截图。
 *
 * - 始终按 2560×1528 的原始比例展示，不做拉伸；
 * - 通过 crop 裁出局部特写，容器尺寸自动按裁切比例推导，保证不越出画布；
 * - zoom / origin 用于缓慢推近，容器 overflow:hidden，因此推近只裁边、不溢出。
 */
export const Screenshot = ({
  src,
  left,
  top,
  width,
  crop = FULL,
  zoom = 1,
  origin = '50% 50%',
  rotate = 0,
  shadow = 'soft',
  radius = 2,
  outline = true,
  style,
}: {
  src: string;
  left: number;
  top: number;
  width: number;
  crop?: Crop;
  zoom?: number;
  origin?: string;
  rotate?: number;
  shadow?: 'soft' | 'lifted' | 'none';
  radius?: number;
  outline?: boolean;
  style?: CSSProperties;
}) => {
  const height = width * SHOT_RATIO * (crop.h / crop.w);
  const innerWidth = width / crop.w;
  const innerHeight = innerWidth * SHOT_RATIO;

  const boxShadow =
    shadow === 'lifted'
      ? '0 46px 110px -42px rgba(41,41,34,0.45), 0 8px 22px -12px rgba(41,41,34,0.22)'
      : shadow === 'soft'
        ? '0 26px 70px -34px rgba(41,41,34,0.32), 0 3px 10px -5px rgba(41,41,34,0.14)'
        : 'none';

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        overflow: 'hidden',
        borderRadius: radius,
        backgroundColor: '#FFFFFF',
        boxShadow,
        outline: outline ? '1px solid rgba(41,41,34,0.13)' : 'none',
        outlineOffset: 0,
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        ...style,
      }}
    >
      <Img
        src={staticFile(src)}
        alt=""
        style={{
          position: 'absolute',
          left: -crop.x * innerWidth,
          top: -crop.y * innerHeight,
          width: innerWidth,
          height: innerHeight,
          display: 'block',
          transform: `scale(${zoom})`,
          transformOrigin: origin,
          imageRendering: 'auto',
        }}
      />
    </div>
  );
};
