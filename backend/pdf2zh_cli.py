"""pdf2zh 的命令行入口（打包版用）。

为什么需要这个文件：
  `pip install --target` **不会**生成 console_scripts（那是普通 venv 安装才会做的），
  而 pdf2zh 1.x 没有 `__main__.py`，所以 `python -m pdf2zh` 跑不起来。
  backend/translate.py 找的是「名为 pdf2zh 的可执行文件」；
  打包版里我们用内置运行时跑这个脚本，并由 translate.py 支持「python -m」式的调用。

和 `pdf2zh = pdf2zh.pdf2zh:main` 这个官方入口完全一致，只是换成一个能直接
`python pdf2zh_cli.py <args>` 跑的文件。
"""

import sys


def main() -> int:
    from pdf2zh.pdf2zh import main as pdf2zh_main

    return pdf2zh_main()


if __name__ == "__main__":
    sys.exit(main())
