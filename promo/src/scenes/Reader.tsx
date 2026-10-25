import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {SceneShell} from '../components/Paper';
import {Screenshot} from '../components/Screenshot';
import {Headline, Kicker} from '../components/Typography';
import {easeInOut, easeOut, progress, riseIn, wipe} from '../lib/anim';
import {COLORS, LATIN, SANS} from '../theme';

const SHOT = {left: 130, top: 336, width: 1660, crop: {x: 0, y: 0, w: 1, h: 0.66}};
const SHOT_HEIGHT = SHOT.width * (1528 / 2560) * (SHOT.crop.h / SHOT.crop.w);

/**
 * 02 / 原文与译文，放在一起读。
 * 全幅横向构图：标题在上、截图在下，作为全片海报画面（约第 600 帧）。
 */
export const Reader = () => {
  const frame = useCurrentFrame();
  const shotIn = wipe(frame, 18, 32, 'left');
  const zoom = 1 + 0.045 * easeInOut(progress(frame, 20, 276));

  return (
    <SceneShell duration={300} fadeIn={18} fadeOut={22}>
      <AbsoluteFill>
        <div style={{position: 'absolute', left: 96, top: 104}}>
          <Kicker delay={4}>02 — Bilingual Reader</Kicker>
        </div>

        <div style={{position: 'absolute', left: 96, top: 142}}>
          <Headline lines={['原文与译文，放在一起读。']} size={62} delay={12} />
        </div>

        {/* 右上：短语，形成与上一场不同的横向版式 */}
        <div style={{position: 'absolute', right: 96, top: 148, width: 470, textAlign: 'right'}}>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 24,
              letterSpacing: '0.06em',
              color: COLORS.ink,
              ...riseIn(frame, 30, {distance: 16, duration: 26, blur: 2}),
            }}
          >
            原文 / 译文 / 双语对照
          </div>
          <div
            style={{
              marginTop: 12,
              fontFamily: SANS,
              fontSize: 21,
              letterSpacing: '0.04em',
              color: COLORS.muted,
              ...riseIn(frame, 42, {distance: 14, duration: 26, blur: 2}),
            }}
          >
            保留论文版式，逐段对照
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 96,
            right: 96,
            top: 282,
            height: 1,
            backgroundColor: COLORS.lineStrong,
            transform: `scaleX(${easeInOut(progress(frame, 24, 40))})`,
            transformOrigin: 'left center',
          }}
        />

        <div
          style={{
            position: 'absolute',
            left: 96,
            top: 296,
            fontFamily: LATIN,
            fontSize: 12,
            letterSpacing: '0.24em',
            color: COLORS.muted,
            opacity: easeOut(progress(frame, 40, 24)),
          }}
        >
          READER · 双栏对照
        </div>
        {/* 全幅截图：擦拭入场 + 缓慢推近 */}
        <div
          style={{
            position: 'absolute',
            left: SHOT.left,
            top: SHOT.top,
            width: SHOT.width,
            height: SHOT_HEIGHT,
            ...shotIn,
          }}
        >
          <div style={{width: '100%', height: '100%'}}>
            <Screenshot
              src="reader-dual.png"
              left={0}
              top={0}
              width={SHOT.width}
              crop={SHOT.crop}
              zoom={zoom}
              origin="50% 18%"
              shadow="lifted"
              radius={3}
              outline
            />
          </div>

          <FocusFrame
            left={42}
            top={SHOT_HEIGHT * 0.3}
            width={SHOT.width * 0.34}
            height={SHOT_HEIGHT * 0.52}
            label="原文"
            index="A"
            delay={104}
            color={COLORS.inkSoft}
          />
          <FocusFrame
            left={SHOT.width * 0.62}
            top={SHOT_HEIGHT * 0.3}
            width={SHOT.width * 0.34}
            height={SHOT_HEIGHT * 0.52}
            label="译文"
            index="B"
            delay={118}
            color={COLORS.red}
          />
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};

const FocusFrame = ({
  left,
  top,
  width,
  height,
  label,
  index,
  delay,
  color,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  label: string;
  index: string;
  delay: number;
  color: string;
}) => {
  const frame = useCurrentFrame();
  const p = easeInOut(progress(frame, delay, 28));
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        border: `1px solid ${color}`,
        opacity: 0.9 * p,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: -30,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '3px 9px 4px',
          backgroundColor: COLORS.paperLight,
          border: `1px solid ${color}`,
        }}
      >
        <span style={{fontFamily: LATIN, fontSize: 11, letterSpacing: '0.12em', color}}>{index}</span>
        <span style={{fontFamily: SANS, fontSize: 15, letterSpacing: '0.12em', color: COLORS.ink}}>
          {label}
        </span>
      </div>
    </div>
  );
};
