import {Config} from '@remotion/cli/config';

/**
 * Remotion 渲染配置（标准 API，不使用 webpack/后端 hook）。
 *
 * 浏览器路径不写死：优先读取环境变量 REMOTION_BROWSER_EXECUTABLE，
 * 否则交给 Remotion 自己查找；也可在命令行用 --browser-executable 覆盖。
 * 例如 Windows：
 *   $env:REMOTION_BROWSER_EXECUTABLE="C:\Program Files\Google\Chrome\Application\chrome.exe"
 */
const browser = process.env.REMOTION_BROWSER_EXECUTABLE;
if (browser && browser.trim().length > 0) {
  Config.setBrowserExecutable(browser.trim());
}

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setConcurrency(4);
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setColorSpace('bt709');
Config.setCrf(17);
Config.setOverwriteOutput(true);
// Render frames before encoding for a stable Windows export path.
Config.setDisallowParallelEncoding(true);
