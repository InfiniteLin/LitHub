import {useCurrentFrame} from 'remotion';
import {easeInOut, progress, riseIn} from '../lib/anim';
import {COLORS, LATIN, SANS} from '../theme';

/**
 * 截图内的细线标注框。
 *
 * 只画 1px 细线 + 角落小号编号；标签默认放在框外，
 * 避免遮住真实界面文字。坐标以截图容器左上角为原点。
 */
export const Callout = ({
  left,
  top,
  width,
  height,
  index,
  label,
  delay = 0,
  labelPlace = 'above',
  accent = COLORS.red,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  index: string;
  label?: string;
  delay?: number;
  labelPlace?: 'above' | 'below' | 'right' | 'left';
  accent?: string;
}) => {
  const frame = useCurrentFrame();
  const p = easeInOut(progress(frame, delay, 24));
  const enter = riseIn(frame, Math.max(0, delay - 4), {distance: 8, duration: 22, blur: 0});

  const chip =
    labelPlace === 'above'
      ? {left: 0, top: -30}
      : labelPlace === 'below'
        ? {left: 0, top: height + 8}
        : labelPlace === 'right'
          ? {left: width + 12, top: 0}
          : {left: -12, top: 0, transform: 'translateX(-100%)'};

  return (
    <div style={{position: 'absolute', left, top, width, height, opacity: enter.opacity}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1.5px solid ${accent}`,
          clipPath: `inset(0 ${100 - p * 100}% 0 0)`,
          boxShadow: '0 0 0 3px rgba(245,241,233,0.4)',
        }}
      />

      {/* 角标：小号编号，压在框线上 */}
      <div
        style={{
          position: 'absolute',
          left: -1,
          top: -1,
          padding: '2px 7px 3px',
          backgroundColor: COLORS.paperLight,
          border: `1px solid ${accent}`,
          fontFamily: LATIN,
          fontSize: 11,
          lineHeight: 1.1,
          letterSpacing: '0.12em',
          color: accent,
        }}
      >
        {index}
      </div>

      {label ? (
        <div
          style={{
            position: 'absolute',
            ...chip,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 9px 5px',
            backgroundColor: COLORS.paperLight,
            border: `1px solid ${accent}`,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{fontFamily: SANS, fontSize: 14, letterSpacing: '0.08em', color: COLORS.ink}}>
            {label}
          </span>
        </div>
      ) : null}
    </div>
  );
};
