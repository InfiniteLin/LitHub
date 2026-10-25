import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {SceneShell} from '../components/Paper';
import {Screenshot} from '../components/Screenshot';
import {Headline, Kicker, Rule} from '../components/Typography';
import {easeInOut, progress, riseIn, staggerRise} from '../lib/anim';
import {COLORS, LATIN, SANS} from '../theme';

const SHOT = {left: 700, top: 196, width: 1120};
const SHOT_HEIGHT = SHOT.width * (1528 / 2560);

/**
 * 04 / 论文在左，讨论在右。
 * 展示论文与网页 AI 并排阅读，截图保持原始比例。
 */
export const Discussion = () => {
  const frame = useCurrentFrame();
  const zoom = 1 + 0.03 * easeInOut(progress(frame, 0, 280));
  const slide = riseIn(frame, 12, {distance: 34, duration: 34, blur: 8});

  return (
    <SceneShell duration={270} fadeIn={18} fadeOut={20}>
      <AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            left: SHOT.left,
            top: SHOT.top,
            width: SHOT.width,
            height: SHOT_HEIGHT,
            ...slide,
          }}
        >
          <Screenshot
            src="webai.png"
            left={0}
            top={0}
            width={SHOT.width}
            zoom={zoom}
            origin="34% 40%"
            shadow="lifted"
            radius={3}
          />
          {/* 只做标签，不画不确定的框 */}
          <div
            style={{
              position: 'absolute',
              left: 18,
              top: 20,
              display: 'flex',
              gap: 10,
              ...riseIn(frame, 96, {distance: 10, duration: 24, blur: 0}),
            }}
          >
            {['AI 总结', '网页 AI'].map((t) => (
              <div
                key={t}
                style={{
                  fontFamily: SANS,
                  fontSize: 15,
                  letterSpacing: '0.08em',
                  color: COLORS.ink,
                  backgroundColor: COLORS.paperLight,
                  border: `1px solid ${COLORS.gold}`,
                  padding: '5px 10px 6px',
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>

        <div style={{position: 'absolute', left: 96, top: 152}}>
          <Kicker delay={6}>04 — Web AI</Kicker>
        </div>

        <div style={{position: 'absolute', left: 96, top: 196, width: 540}}>
          <Headline lines={['论文在左，', '讨论在右。']} size={60} delay={16} />
        </div>

        <div style={{position: 'absolute', left: 96, top: 396}}>
          <Rule width={72} delay={34} color={COLORS.red} />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 96,
            top: 428,
            width: 512,
            fontFamily: SANS,
            fontSize: 23,
            lineHeight: 1.92,
            color: COLORS.inkSoft,
            ...riseIn(frame, 44, {distance: 18, duration: 26, blur: 2}),
          }}
        >
          复制 PDF 或提示词，把论文带到你常用的网页 AI 里继续追问。
        </div>

        <div style={{position: 'absolute', left: 96, top: 568, width: 530}}>
          {[
            {no: '01', title: 'AI 总结', note: '先看要点'},
            {no: '02', title: '网页 AI', note: '沿用你的工具'},
            {no: '03', title: '围绕论文继续提问', note: '原文在手边'},
          ].map((item, i) => {
            const enter = staggerRise(frame, 72, i, 18, {distance: 18, duration: 26, blur: 2});
            return (
              <div
                key={item.no}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 16,
                  paddingBottom: 15,
                  marginBottom: 15,
                  borderBottom: `1px solid ${COLORS.line}`,
                  ...enter,
                }}
              >
                <span style={{fontFamily: LATIN, fontSize: 12, letterSpacing: '0.14em', color: COLORS.red}}>
                  {item.no}
                </span>
                <span style={{fontFamily: SANS, fontSize: 23, color: COLORS.ink}}>{item.title}</span>
                <span style={{fontFamily: SANS, fontSize: 15, color: COLORS.muted, marginLeft: 'auto'}}>
                  {item.note}
                </span>
              </div>
            );
          })}
        </div>

        <div
          style={{
            position: 'absolute',
            left: 96,
            bottom: 92,
            fontFamily: SANS,
            fontSize: 22,
            color: COLORS.muted,
            letterSpacing: '0.04em',
            ...riseIn(frame, 104, {distance: 10, duration: 24, blur: 0}),
          }}
        >
          翻译与 AI 功能需连接相应服务
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
