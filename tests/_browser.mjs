/* 测试公用：找到本机可用的 Chromium 系浏览器。
 *
 * 为什么需要单独一个模块：16 个 verify-*.mjs 原本都把路径写死成
 * `C:/Program Files/Google/Chrome/Application/chrome.exe`。别人 clone 下来
 * 直接跑测试会全部失败（不是每个人都有 Chrome，也未必装在 C 盘）。
 *
 * 查找顺序：
 *   1. 环境变量 CHROME_PATH（显式指定，CI 上最省事）
 *   2. 注册表 App Paths（和产品代码 backend/browser_embed.py 用的是同一套思路，
 *      浏览器装在 D 盘也能找到）
 *   3. 常见安装位置（Chrome / Edge）
 *
 * 用法：
 *   import { findBrowser } from "./_browser.mjs";
 *   const browser = findBrowser();          // 找不到会抛错并给出清晰提示
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  `${process.env.LOCALAPPDATA || ""}/Google/Chrome/Application/chrome.exe`,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];

/* 从注册表 App Paths 读真实安装路径（Windows） */
function fromRegistry() {
  if (process.platform !== "win32") return [];
  const found = [];
  for (const exe of ["chrome.exe", "msedge.exe"]) {
    try {
      const out = execFileSync(
        "reg",
        ["query", `HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exe}`, "/ve"],
        // stderr 用 ignore：查不到注册表项时 reg.exe 会往 stderr 写一行错误，
        // 那一行对使用者毫无意义、还会被误认为测试失败，所以直接丢掉。
        { encoding: "utf8", timeout: 5000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] }
      );
      const m = out.match(/([A-Za-z]:\\[^\r\n]+?\.exe)/);
      if (m) found.push(m[1].replace(/\\/g, "/"));
    } catch {
      /* 没有这条注册表项，跳过 */
    }
  }
  return found;
}

/** 返回可用的浏览器可执行文件路径；找不到就抛错。 */
export function findBrowser() {
  const tried = [];

  if (process.env.CHROME_PATH) {
    if (existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
    tried.push(`CHROME_PATH=${process.env.CHROME_PATH}（不存在）`);
  }

  for (const p of [...fromRegistry(), ...CANDIDATES]) {
    tried.push(p);
    if (existsSync(p)) return p;
  }

  throw new Error(
    "找不到 Chrome / Edge，测试无法启动无头浏览器。\n" +
      "请安装其中一个，或设置环境变量 CHROME_PATH 指向可执行文件。\n已尝试：\n  " +
      tried.join("\n  ")
  );
}
