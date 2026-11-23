r"""引擎 stdout 的进度行协议：写端（engine_entry）与读端（translate）共用一份定义。

为什么需要自定义协议：
  pdf2zh-next 2.10.x 的 `do_translate_file_async()` 把 `use_rich_pbar` 硬编码成
  True，而 rich 的 `Progress` 在 stdout 不是终端（我们用管道读子进程输出）时
  不会逐帧刷新 —— 整个翻译只在结束时打印一行。旧的 `(\d{1,3})%\|` 正则匹配的是
  tqdm 的输出格式，于是**一条也匹配不到**，界面就永远停在 0%。

  所以由 engine_entry 按固定格式汇报：
      LITHUB-STAGE    解析版面
      LITHUB-PROGRESS 30 解析版面

  解析函数也保留 tqdm 兼容分支，方便临时换回 `-m pdf2zh_next.main` 排查。
"""

import re

PROGRESS_PREFIX = "LITHUB-PROGRESS"
STAGE_PREFIX = "LITHUB-STAGE"
_LEGACY_PERCENT = re.compile(r"(?<![0-9])([0-9]{1,3})%\|")

# 引擎的阶段名是英文标识符，直接显示给用户不友好；未收录的按原样显示。
STAGE_LABELS = {
    "Parse PDF and Create Intermediate Representation": "解析 PDF",
    "DetectScannedFile": "检测扫描页",
    "Parse Page Layout": "解析版面",
    "Parse Table": "解析表格",
    "Parse Paragraphs": "解析段落",
    "Parse Formulas and Styles": "解析公式与样式",
    "Automatic Term Extraction": "提取专业术语",
    "Translate Paragraphs": "翻译正文",
    "Typesetting": "排版",
    "Add Fonts": "嵌入字体",
    "Generate drawing instructions": "生成绘制指令",
    "Subset font": "裁剪字体",
    "Save PDF": "保存 PDF",
}


def stage_label(stage: str) -> str:
    return STAGE_LABELS.get(stage, stage)


def progress_line(percent: int, stage: str = "") -> str:
    """总进度行；换行符由 print 补。"""
    text = f"{PROGRESS_PREFIX} {int(percent)}"
    return f"{text} {stage}" if stage else text


def stage_line(stage: str) -> str:
    """阶段切换行：只要阶段名，不带百分比。"""
    return f"{STAGE_PREFIX} {stage}"


def parse(line: str) -> tuple[int | None, str] | None:
    """解析一行引擎输出。

    返回 `(百分比, 阶段名)`：阶段行只有阶段名（百分比为 None），其余行两者都有。
    不是进度行则返回 None。
    """
    text = line.strip()
    prefix, _, content = text.partition(" ")
    if prefix == PROGRESS_PREFIX:
        parts = content.split(maxsplit=1)
        if parts and re.fullmatch(r"[0-9]{1,3}", parts[0]):
            return int(parts[0]), (parts[1] if len(parts) > 1 else "")
        return None

    if prefix == STAGE_PREFIX:
        stage = content.strip()
        return (None, stage) if stage else None

    match = _LEGACY_PERCENT.search(text)
    return (int(match[1]), "") if match else None
