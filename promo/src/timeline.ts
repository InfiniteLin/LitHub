/**
 * 时间轴（单位：帧，30fps，总计 1500 帧 = 50 秒）。
 *
 * 六段严格首尾相接、互不重叠：
 *   开场   0 – 180
 *   01     180 – 450
 *   02     450 – 750
 *   03     750 – 1020
 *   04     1020 – 1290
 *   结束   1290 – 1500
 *
 * 想调整某段长度时，同时修改这里的 duration 和对应场景内部的
 * 动画延时（场景内全部使用“相对本段的局部帧”），并保证总和 1500。
 */

export const SCENES = {
  opening: {from: 0, duration: 180},
  library: {from: 180, duration: 270},
  reader: {from: 450, duration: 300},
  notes: {from: 750, duration: 270},
  discussion: {from: 1020, duration: 270},
  closing: {from: 1290, duration: 210},
} as const;

export const TOTAL_FRAMES = 1500;
