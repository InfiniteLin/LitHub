import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {SceneShell} from '../components/Paper';
import {Screenshot} from '../components/Screenshot';
import {Headline, Kicker, Rule, ShotCaption} from '../components/Typography';
import {easeInOut, progress, riseIn, staggerRise} from '../lib/anim';

const SHOT = {left: 96, top: 212, width: 1256};
const SHOT_HEIGHT = SHOT.width * (1528 / 2560);

/**
 * 03 / 把读到的重点，变成自己的理解。
 * 与 01 左右互换：截图在左、文字在右，微推画面右侧的笔记区。
 */
export const Notes = () => {
  const frame = useCurrentFrame();
  const zoom = 1 + 0.038 * easeInOut(progress(frame, 0, 300));
  const appear = riseIn(frame, 14, {distance: 26, duration: 32, blur: 7});

  return (
    <SceneShell duration={270} fadeIn={18} fadeOut={20}>
      <AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            left: SHOT.left,
            top: SHOT.top,
            width: SHOT.width,
            ...appear,
          }}
        >
          <Screenshot
            src="notes.png"
            left={0}
            top={0}
            width={SHOT.width}
            zoom={zoom}
            origin="82% 48%"
            shadow="lifted"
            radius={3}
          />
        </div>

        <div style={{position: 'absolute', left: SHOT.left, top: SHOT.top + SHOT_HEIGHT + 18}}>
          <ShotCaption left={0} top={0} width={SHOT.width}>
            NOTES · 论文与笔记同屏
          </ShotCaption>
        </div>

        {/* 右侧文字列 */}
        <div style={{position: 'absolute', left: 1416, top: 150}}>
          <Kicker delay={8}>03 — Notes</Kicker>
        </div>

        <div style={{position: 'absolute', left: 1416, top: 196, width: 408}}>
          <Headline lines={['把读到的重点，', '变成自己的理解。']} size={44} delay={18} lineHeight={1.5} />
        </div>

        <div style={{position: 'absolute', left: 1416, top: 376}}>
          <Rule width={72} delay={40} color="#A7442D" />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 1416,
            top: 404,
            width: 396,
            fontFamily: "'Microsoft YaHei', sans-serif",
            fontSize: 21,
            lineHeight: 1.95,
            color: '#4B483E',
            ...riseIn(frame, 50, {distance: 18, duration: 26, blur: 2}),
          }}
        >
          高亮原文，写下批注；笔记与论文始终挨在一起。
        </div>

        <div style={{position: 'absolute', left: 1416, top: 596, width: 408}}>
          {[
            {no: '01', title: '高亮与批注', note: '随手标记'},
            {no: '02', title: 'Markdown 笔记', note: '结构化记录'},
            {no: '03', title: '自动保存', note: '不用记着保存'},
          ].map((item, i) => {
            const enter = staggerRise(frame, 78, i, 17, {distance: 18, duration: 26, blur: 2});
            return (
              <div
                key={item.no}
                style={{
                  paddingBottom: 18,
                  marginBottom: 18,
                  borderBottom: '1px solid rgba(41,41,34,0.14)',
                  ...enter,
                }}
              >
                <div style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
                  <span
                    style={{
                      fontFamily: "'Georgia', serif",
                      fontSize: 12,
                      letterSpacing: '0.14em',
                      color: '#A7442D',
                    }}
                  >
                    {item.no}
                  </span>
                  <span style={{fontFamily: "'Microsoft YaHei', sans-serif", fontSize: 24, color: '#292922'}}>
                    {item.title}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 4,
                    marginLeft: 42,
                    fontFamily: "'Microsoft YaHei', sans-serif",
                    fontSize: 16,
                    color: '#7C7668',
                  }}
                >
                  {item.note}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
