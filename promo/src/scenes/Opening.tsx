import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {SceneShell} from '../components/Paper';
import {Screenshot} from '../components/Screenshot';
import {Rule} from '../components/Typography';
import {easeOut, progress, riseIn, slowPan} from '../lib/anim';
import {COLORS, LATIN, SANS, SERIF} from '../theme';

/** 开场：标题 + 三张真实截图作为层叠流动的书页。 */
export const Opening = () => {
  const frame = useCurrentFrame();

  const mark = riseIn(frame, 6, {distance: 18, duration: 24, blur: 4});
  const title1 = riseIn(frame, 14, {distance: 42, duration: 34, blur: 8});
  const title2 = riseIn(frame, 24, {distance: 42, duration: 34, blur: 8});
  const sub = riseIn(frame, 44, {distance: 20, duration: 28, blur: 3});
  const footer = riseIn(frame, 58, {distance: 16, duration: 26, blur: 2});

  return (
    <SceneShell duration={180} fadeIn={12} fadeOut={24}>
      <AbsoluteFill>
      {/* 左侧文字区 */}
      <div style={{position: 'absolute', left: 96, top: 148, display: 'flex', alignItems: 'center', gap: 18, ...mark}}>
        <Img src={staticFile('icon.png')} alt="" style={{width: 54, height: 54, objectFit: 'contain'}} />
        <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
          <span style={{fontFamily: SERIF, fontSize: 30, letterSpacing: '0.12em', color: COLORS.ink}}>文枢</span>
          <span style={{fontFamily: LATIN, fontSize: 18, letterSpacing: '0.16em', color: COLORS.muted}}>LitHub</span>
        </div>
      </div>

      <div style={{position: 'absolute', left: 96, top: 268}}>
        <div style={{fontFamily: SERIF, fontSize: 82, lineHeight: 1.26, letterSpacing: '0.02em', color: COLORS.ink, ...title1}}>
          让论文阅读，
        </div>
        <div style={{fontFamily: SERIF, fontSize: 82, lineHeight: 1.26, letterSpacing: '0.02em', color: COLORS.ink, ...title2}}>
          连成一条思路。
        </div>
      </div>

      <div style={{position: 'absolute', left: 96, top: 500, width: 560, ...sub}}>
        <div style={{fontFamily: SANS, fontSize: 25, lineHeight: 1.9, color: COLORS.inkSoft}}>
          PDF、译文、笔记与讨论，
          <br />
          在一个窗口里连成阅读线索。
        </div>
      </div>

      <div style={{position: 'absolute', left: 96, top: 640}}>
        <Rule width={72} delay={52} color={COLORS.red} />
        <div
          style={{
            marginTop: 20,
            fontFamily: LATIN,
            fontSize: 12,
            letterSpacing: '0.3em',
            color: COLORS.gold,
            opacity: easeOut(progress(frame, 62, 24)),
          }}
        >
          READING, CONNECTED
        </div>
      </div>

      <div style={{position: 'absolute', left: 96, top: 892, display: 'flex', alignItems: 'center', gap: 20, ...footer}}>
        {['整理', '双语阅读', '笔记', 'AI 辅助'].map((word, i) => (
          <div key={word} style={{display: 'flex', alignItems: 'center', gap: 20}}>
            {i > 0 ? <span style={{color: COLORS.gold, fontSize: 12}}>·</span> : null}
            <span style={{fontFamily: SANS, fontSize: 24, letterSpacing: '0.14em', color: COLORS.inkSoft}}>{word}</span>
          </div>
        ))}
      </div>

      {/* 右侧：三张真实界面截图 */}
      <div style={{position: 'absolute', inset: 0}}>
        <PageCard
          src="library.png"
          left={1010}
          top={120}
          width={500}
          rotate={-3.4}
          delay={18}
          drift={slowPan(frame, 0, 180, 16, -12)}
          rise={slowPan(frame, 0, 180, 8, -6)}
          no="01"
        />
        <PageCard
          src="reader-dual.png"
          left={1150}
          top={352}
          width={520}
          rotate={2.2}
          delay={34}
          drift={slowPan(frame, 0, 180, 20, -10)}
          rise={slowPan(frame, 0, 180, 14, -2)}
          no="02"
        />
        <PageCard
          src="notes.png"
          left={1040}
          top={604}
          width={500}
          rotate={-1.8}
          delay={50}
          drift={slowPan(frame, 0, 180, 14, -8)}
          rise={slowPan(frame, 0, 180, 18, 4)}
          no="03"
        />
      </div>
      </AbsoluteFill>
    </SceneShell>
  );
};

const PageCard = ({
  src,
  left,
  top,
  width,
  rotate,
  delay,
  drift,
  rise,
  no,
}: {
  src: string;
  left: number;
  top: number;
  width: number;
  rotate: number;
  delay: number;
  drift: number;
  rise: number;
  no: string;
}) => {
  const frame = useCurrentFrame();
  const inP = easeOut(progress(frame, delay, 34));

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        opacity: inP,
        transform: `translate(${drift}px, ${rise}px) rotate(${rotate}deg)`,
        filter: `blur(${(1 - inP) * 8}px)`,
      }}
    >
      <Screenshot src={src} left={0} top={0} width={width} shadow="lifted" />
      <div
        style={{
          position: 'absolute',
          left: -16,
          top: -22,
          fontFamily: LATIN,
          fontSize: 11,
          letterSpacing: '0.22em',
          color: COLORS.gold,
        }}
      >
        {no}
      </div>
    </div>
  );
};
