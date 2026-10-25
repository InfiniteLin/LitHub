import {Audio, AbsoluteFill, interpolate, Sequence, staticFile} from 'remotion';
import {Paper} from './components/Paper';
import {Opening} from './scenes/Opening';
import {Library} from './scenes/Library';
import {Reader} from './scenes/Reader';
import {Notes} from './scenes/Notes';
import {Discussion} from './scenes/Discussion';
import {Closing} from './scenes/Closing';
import {SCENES} from './timeline';
import {COLORS} from './theme';

/**
 * 文枢 LitHub 宣传片正片。
 *
 * 画面全部由确定性动画组成；底部纸面常驻，所以段落淡出时只会露出米白纸面，
 * 不会出现黑帧。配乐为原创程序化 WAV，随片淡入淡出，无配音。
 */
export const LitHubIntro = () => (
  <AbsoluteFill style={{backgroundColor: COLORS.paper}}>
    <Paper />

    <Sequence from={SCENES.opening.from} durationInFrames={SCENES.opening.duration} name="00 开场">
      <Opening />
    </Sequence>
    <Sequence from={SCENES.library.from} durationInFrames={SCENES.library.duration} name="01 文献库">
      <Library />
    </Sequence>
    <Sequence from={SCENES.reader.from} durationInFrames={SCENES.reader.duration} name="02 双语阅读">
      <Reader />
    </Sequence>
    <Sequence from={SCENES.notes.from} durationInFrames={SCENES.notes.duration} name="03 笔记">
      <Notes />
    </Sequence>
    <Sequence
      from={SCENES.discussion.from}
      durationInFrames={SCENES.discussion.duration}
      name="04 网页 AI"
    >
      <Discussion />
    </Sequence>
    <Sequence from={SCENES.closing.from} durationInFrames={SCENES.closing.duration} name="05 结束">
      <Closing />
    </Sequence>

    <Audio
      src={staticFile('soundtrack.wav')}
      volume={(frame) =>
        interpolate(frame, [0, 66, 1400, 1470, 1500], [0, 0.5, 0.5, 0.34, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      }
    />
  </AbsoluteFill>
);
