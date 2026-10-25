import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Callout} from '../components/Callout';
import {SceneShell} from '../components/Paper';
import {Screenshot} from '../components/Screenshot';
import {Headline, Kicker, Rule} from '../components/Typography';
import {easeInOut, progress, riseIn, staggerRise} from '../lib/anim';
import {COLORS, LATIN, SANS} from '../theme';

const SHOT = {left: 780, top: 168, width: 1020};
const SHOT_HEIGHT = SHOT.width * (1528 / 2560);
const S = SHOT.width / 2560;

/** 截图内坐标 → 画布坐标（按展示宽度等比换算）。 */
const map = (x: number, y: number, w: number, h: number) => ({
  left: x * S,
  top: y * S,
  width: w * S,
  height: h * S,
});

/** 01 / 从散落的 PDF，到有序的文献库。 */
export const Library = () => {
  const frame = useCurrentFrame();
  const push = 1 + 0.03 * easeInOut(progress(frame, 0, 290));

  return (
    <SceneShell duration={270} fadeIn={18} fadeOut={20}>
      <AbsoluteFill>
        {/* 右侧大图 + 细线标注。
            搜索框 / 附件区域坐标由界面实测给出，按原始比例换算。 */}
        <div
          style={{
            position: 'absolute',
            left: SHOT.left,
            top: SHOT.top,
            width: SHOT.width,
            height: SHOT_HEIGHT,
            transform: `scale(${push})`,
            transformOrigin: '44% 40%',
          }}
        >
          <Screenshot
            src="library.png"
            left={0}
            top={0}
            width={SHOT.width}
            shadow="lifted"
            radius={3}
          />
          <Callout
            {...map(590, 240, 630, 55)}
            index="A"
            label="全文搜索"
            delay={92}
            labelPlace="above"
          />
          <Callout
            {...map(590, 326, 1740, 339)}
            index="B"
            label="展开附件"
            delay={122}
            labelPlace="right"
            accent={COLORS.gold}
          />
        </div>

        <div style={{position: 'absolute', left: SHOT.left, top: SHOT.top + SHOT_HEIGHT + 26}}>
          <div
            style={{
              fontFamily: LATIN,
              fontSize: 12,
              letterSpacing: '0.22em',
              color: COLORS.muted,
              ...riseIn(frame, 58, {distance: 12, duration: 24, blur: 0}),
            }}
          >
            LIBRARY · 文献库总览
          </div>
        </div>

        {/* 左侧文字列 */}
        <div style={{position: 'absolute', left: 96, top: 150}}>
          <Kicker delay={6}>01 — Library</Kicker>
        </div>

        <div style={{position: 'absolute', left: 96, top: 196, width: 620}}>
          <Headline lines={['从散落的 PDF，', '到有序的文献库。']} size={58} delay={16} />
        </div>

        <div style={{position: 'absolute', left: 96, top: 408}}>
          <Rule width={72} delay={34} color={COLORS.red} />
        </div>

        <div style={{position: 'absolute', left: 96, top: 440, width: 560}}>
          <BodyLine
            frame={frame}
            start={42}
            text="导入、归类、检索。让每篇论文都有自己的位置。"
          />
        </div>

        <div style={{position: 'absolute', left: 96, top: 584, width: 620}}>
          {[
            {no: '01', title: '导入 PDF', note: '整批拖入'},
            {no: '02', title: '分类与标签', note: '按主题归档'},
            {no: '03', title: '全文搜索', note: '一句话找到原文'},
          ].map((item, i) => {
            const enter = staggerRise(frame, 66, i, 16, {distance: 20, duration: 26, blur: 2});
            return (
              <div
                key={item.no}
                style={{
                  position: 'relative',
                  paddingBottom: 20,
                  marginBottom: 20,
                  borderBottom: `1px solid ${COLORS.line}`,
                  ...enter,
                }}
              >
                <div style={{display: 'flex', alignItems: 'baseline', gap: 20}}>
                  <span
                    style={{
                      fontFamily: LATIN,
                      fontSize: 12,
                      letterSpacing: '0.16em',
                      color: COLORS.red,
                    }}
                  >
                    {item.no}
                  </span>
                  <span style={{fontFamily: SANS, fontSize: 27, color: COLORS.ink}}>
                    {item.title}
                  </span>
                  <span
                    style={{
                      fontFamily: SANS,
                      fontSize: 17,
                      color: COLORS.muted,
                      marginLeft: 'auto',
                    }}
                  >
                    {item.note}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

      </AbsoluteFill>
    </SceneShell>
  );
};

const BodyLine = ({frame, start, text}: {frame: number; start: number; text: string}) => (
  <div
    style={{
      fontFamily: SANS,
      fontSize: 25,
      lineHeight: 1.9,
      color: COLORS.inkSoft,
      ...riseIn(frame, start, {distance: 18, duration: 26, blur: 3}),
    }}
  >
    {text}
  </div>
);
