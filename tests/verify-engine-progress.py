"""进度行协议解析：translate.py 与 engine_entry.py 的约定。"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))

import engine_progress


def test_own_protocol_lines():
    assert engine_progress.parse(engine_progress.progress_line(42)) == (42, '')
    assert engine_progress.parse(engine_progress.progress_line(7, 'Parse Page Layout')) == (7, 'Parse Page Layout')
    assert engine_progress.parse(engine_progress.stage_line('Parse Page Layout')) == (None, 'Parse Page Layout')
    print('PASS own protocol round-trips')


def test_rejects_non_progress_output():
    for line in ('', '   ', 'INFO translation engine: Bing', 'LITHUB-PROGRESS',
                 'LITHUB-STAGE', 'LITHUB-PROGRESS abc', 'LITHUB-PROGRESS²',
                 'LITHUB-PROGRESS ²', 'LITHUB-PROGRESS 1234', 'error: boom'):
        assert engine_progress.parse(line) is None, line
    print('PASS unrelated engine output is ignored')


def test_ignores_percentages_inside_rich_progress_bar():
    # rich 的 `translate ---- 30/100` 不含 `%|`，不能被误判成进度
    assert engine_progress.parse('translate              30/100 0:00:03 -:--:--') is None
    print('PASS rich bar without percent marker is not progress')


def test_legacy_tqdm_lines_still_parse():
    line = 'Translate Paragraphs (10/26):  42%|####      | 420/1000 [00:05<00:07]'
    assert engine_progress.parse(line) == (42, '')
    assert engine_progress.parse('  7%|          | 7/100 [00:00<?, ?it/s]') == (7, '')
    print('PASS legacy tqdm lines remain readable')


def test_stage_labels_are_localized():
    assert engine_progress.stage_label('Parse Page Layout') == '解析版面'
    assert engine_progress.stage_label('Translate Paragraphs') == '翻译正文'
    # 未收录的阶段名原样返回，不会丢信息
    assert engine_progress.stage_label('Some Future Stage') == 'Some Future Stage'
    print('PASS stage labels map to Chinese and fall back gracefully')


if __name__ == '__main__':
    test_own_protocol_lines()
    test_rejects_non_progress_output()
    test_ignores_percentages_inside_rich_progress_bar()
    test_legacy_tqdm_lines_still_parse()
    test_stage_labels_are_localized()
