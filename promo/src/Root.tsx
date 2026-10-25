import {Composition} from 'remotion';
import {LitHubIntro} from './LitHubIntro';
import {DURATION, FPS, HEIGHT, WIDTH} from './theme';

export const RemotionRoot = () => (
  <Composition
    id="LitHubIntro"
    component={LitHubIntro}
    durationInFrames={DURATION}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);
