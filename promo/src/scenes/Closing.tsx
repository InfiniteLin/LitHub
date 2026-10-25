import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {SceneShell} from '../components/Paper';
import {Rule} from '../components/Typography';
import {easeInOut, easeOut, progress, riseIn, staggerRise} from '../lib/anim';

/**
 * 结束：品牌、流程、平台与开源信息。
 * GitHub 地址在本段第 110 帧完整出现，保持至第 209 帧（超过 3 秒）。
 */
export const Closing = () => {
  const frame = useCurrentFrame();

  return (
    <SceneShell duration={210} fadeIn={20} fadeOut={0}>
      <AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            left: 96,
            top: 150,
            display: 'flex',
            alignItems: 'center',
            gap: 22,
            ...riseIn(frame, 6, {distance: 18, duration: 26, blur: 4}),
          }}
        >
          <Img src={staticFile('icon.png')} alt="" style={{width: 66, height: 66, objectFit: 'contain'}} />
          <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
            <span style={{fontFamily: "'SimSun', serif", fontSize: 42, letterSpacing: '0.1em', color: '#292922'}}>
              文枢
            </span>
            <span style={{fontFamily: "'Georgia', serif", fontSize: 24, letterSpacing: '0.14em', color: '#7C7668'}}>
              LitHub
            </span>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 96,
            top: 286,
            fontFamily: "'SimSun', serif",
            fontSize: 76,
            lineHeight: 1.34,
            letterSpacing: '0.02em',
            color: '#292922',
            ...riseIn(frame, 14, {distance: 36, duration: 32, blur: 6}),
          }}
        >
          整理文献，
          <br />
          也整理思路。
        </div>

        <div style={{position: 'absolute', left: 96, top: 508}}>
          <Rule width={88} delay={30} color="#A7442D" />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 96,
            top: 556,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
          }}
        >
          {['收集', '阅读', '记录', '思考'].map((step, i) => {
            const enter = staggerRise(frame, 40, i, 9, {distance: 14, duration: 24, blur: 2});
            return (
              <div key={step} style={{display: 'flex', alignItems: 'center', gap: 18, ...enter}}>
                {i > 0 ? (
                  <span style={{fontFamily: "'Georgia', serif", fontSize: 18, color: '#9B7B4A'}}>→</span>
                ) : null}
                <span style={{fontFamily: "'Microsoft YaHei', sans-serif", fontSize: 27, letterSpacing: '0.08em', color: '#292922'}}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>

        <div
          style={{
            position: 'absolute',
            left: 96,
            top: 640,
            fontFamily: "'Microsoft YaHei', sans-serif",
            fontSize: 19,
            letterSpacing: '0.06em',
            color: '#7C7668',
            ...riseIn(frame, 64, {distance: 14, duration: 24, blur: 2}),
          }}
        >
          Windows · 开源 · 本地保存文献与笔记
        </div>

        <div style={{position: 'absolute', left: 96, top: 724}}>
          <div
            style={{
              fontFamily: "'Georgia', serif",
              fontSize: 12,
              letterSpacing: '0.3em',
              color: '#9B7B4A',
              marginBottom: 12,
              opacity: easeOut(progress(frame, 58, 26)),
            }}
          >
            OPEN SOURCE
          </div>
          <div
            style={{
              fontFamily: "'Georgia', 'Times New Roman', serif",
              fontSize: 38,
              letterSpacing: '0.01em',
              color: '#A7442D',
              borderBottom: '1px solid rgba(167,68,45,0.45)',
              paddingBottom: 6,
              ...riseIn(frame, 60, {distance: 16, duration: 28, blur: 3}),
            }}
          >
            github.com/InfiniteLin/LitHub
          </div>
        </div>

        {/* 右侧：极简“书页—索引”装饰，不使用卡片 */}
        <div
          style={{
            position: 'absolute',
            right: 96,
            top: 150,
            width: 560,
            height: 760,
            opacity: easeInOut(progress(frame, 20, 40)),
          }}
        >
          <div style={{position: 'absolute', inset: 0, border: '1px solid rgba(41,41,34,0.14)'}} />
          <div style={{position: 'absolute', left: 46, top: 46, right: 46, height: 1, backgroundColor: 'rgba(41,41,34,0.18)'}} />
          <div
            style={{
              position: 'absolute',
              left: 46,
              top: 78,
              fontFamily: "'Georgia', serif",
              fontSize: 12,
              letterSpacing: '0.26em',
              color: '#7C7668',
            }}
          >
            A READING LIFE, IN ORDER
          </div>

          {['文献库', '双语阅读', '笔记与批注', '网页 AI'].map((label, i) => {
            const enter = staggerRise(frame, 34, i, 10, {distance: 16, duration: 26, blur: 2});
            return (
              <div
                key={label}
                style={{
                  position: 'absolute',
                  left: 46,
                  right: 46,
                  top: 156 + i * 124,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  borderBottom: '1px solid rgba(41,41,34,0.14)',
                  paddingBottom: 16,
                  ...enter,
                }}
              >
                <span style={{fontFamily: "'Microsoft YaHei', sans-serif", fontSize: 25, color: '#292922'}}>{label}</span>
                <span style={{fontFamily: "'Georgia', serif", fontSize: 13, color: '#9B7B4A', letterSpacing: '0.16em'}}>
                  0{i + 1}
                </span>
              </div>
            );
          })}

          <div
            style={{
              position: 'absolute',
              left: 46,
              right: 46,
              bottom: 52,
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: "'Georgia', serif",
              fontSize: 11,
              letterSpacing: '0.22em',
              color: '#7C7668',
            }}
          >
            <span>LITHUB</span>
            <span>2026</span>
          </div>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
