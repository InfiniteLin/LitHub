/**
 * 全局视觉常量。
 *
 * 本片为「学术编辑风」：米白纸面、墨色正文、朱红强调、金褐细节。
 * 所有字号、边距、颜色集中在这里，方便统一调整。
 */

export const WIDTH = 1920;
export const HEIGHT = 1080;
export const FPS = 30;
export const DURATION = 1500; // 50s
export const SAFE = 80; // 安全边距，正文与截图都不越过这条线

/** 应用截图的原始尺寸（所有素材一致）。 */
export const SHOT_WIDTH = 2560;
export const SHOT_HEIGHT = 1528;
export const SHOT_RATIO = SHOT_HEIGHT / SHOT_WIDTH;

export const COLORS = {
  paper: '#F5F1E9',
  paperDeep: '#EDE6D8',
  paperLight: '#FBF8F0',
  ink: '#292922',
  inkSoft: '#4B483E',
  muted: '#7C7668',
  red: '#A7442D',
  redDeep: '#85311F',
  gold: '#9B7B4A',
  line: 'rgba(41, 41, 34, 0.16)',
  lineStrong: 'rgba(41, 41, 34, 0.34)',
  white: '#FDFBF6',
} as const;

/** 中文衬线标题：本机宋体，不打包字体。 */
export const SERIF = "'SimSun', 'Songti SC', 'STSong', serif";
/** 中文无衬线正文：本机微软雅黑。 */
export const SANS = "'Microsoft YaHei', 'PingFang SC', 'Microsoft JhengHei', sans-serif";
/** 英文编号 / 拉丁文案：本机 Georgia。 */
export const LATIN = "'Georgia', 'Times New Roman', serif";
