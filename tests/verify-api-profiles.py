"""API profile persistence, migration and consumers in a disposable library. No real AI calls."""
import contextlib
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import tempfile
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
with tempfile.TemporaryDirectory(prefix='lithub-api-profiles-') as temporary, contextlib.ExitStack() as cleanup:
    base = Path(temporary)
    library = base / 'library.json'
    library.write_text(json.dumps({'papers': {'p1': {'id':'p1','title':'test','translated':False}}, 'tasks':{}, 'settings':{}}), encoding='utf8')
    os.environ.update(LITHUB_DATA_DIR=str(base), LITHUB_PROGRAM_DIR=str(base), LITHUB_PDF_DEFAULT_DIR=str(base/'pdfs'))
    from fastapi.testclient import TestClient
    import main
    import secret
    import translate
    import search_index
    from store import Store
    from api_profiles import migrate_profiles
    cleanup.callback(search_index.close)
    client = TestClient(main.app)
    cleanup.callback(client.close)
    store = main.store
    initial = client.get('/api/settings').json()
    assert initial['api_profiles'] == [] and initial['provider'] == '' and not initial['has_key']
    assert client.post('/api/settings/test').status_code == 400
    profiles = [dict(id='alpha',name='论文总结',base_url='https://alpha.example/v1',model='model-alpha',temperature=0.2),
                dict(id='beta',name='推理服务',base_url='http://localhost:9876/v1',model='model-beta',temperature=0.8)]
    keys = {'alpha':'sk-fictional-alpha-key-123456', 'beta':'sk-fictional-beta-key-654321'}
    result = client.post('/api/settings',json={'api_profiles':profiles,'provider':'alpha','api_keys':keys})
    assert result.status_code == 200, result.text
    saved = result.json()
    for value in keys.values():
        assert value not in result.text and value not in library.read_text(encoding='utf8')
    assert secret.is_encrypted(json.loads(library.read_text(encoding='utf8'))['settings']['api_keys']['alpha'])
    reopened = Store()
    assert reopened.get_settings('beta')['api_key'] == keys['beta']
    assert reopened.get_settings('beta')['base_url'] == profiles[1]['base_url']
    assert reopened.get_settings('missing')['api_key'] == ''
    print('PASS empty defaults, independent profiles, encrypted persistence and no credential fallback')

    profiles[0]['name'] = '我的自定义名称'
    result = client.post('/api/settings',json={'api_profiles':profiles,'provider':'beta',
        'api_keys':{p:saved['keys'][p]['masked'] for p in keys}})
    assert result.status_code == 200, result.text
    assert store.get_settings()['api_key'] == keys['beta']
    assert store.get_settings()['model'] == 'model-beta'
    assert store.get_settings()['temperature'] == 0.8
    assert store.get_settings('alpha')['api_key'] == keys['alpha']
    with patch('openai.OpenAI') as connection:
        tested = client.post('/api/settings/test',json={'provider':'alpha','api_key':saved['keys']['alpha']['masked']})
        assert tested.status_code == 200, tested.text
        assert connection.call_args.kwargs['api_key'] == keys['alpha']
        assert connection.call_args.kwargs['base_url'] == profiles[0]['base_url']
        assert connection.return_value.chat.completions.create.call_args.kwargs['model'] == 'model-alpha'
        assert client.post('/api/settings/test',json={'provider':'missing','base_url':'https://example.test','model':'m','api_key':'******'}).status_code == 400
        assert client.post('/api/settings/test',json={'provider':'alpha','api_key':''}).status_code == 400
    with patch('model_discovery.discover_models', return_value={'ok':True,'models':['upstream-model'],'message':''}) as discovery:
        result = client.post('/api/settings/models',json={'provider':'alpha','api_key':saved['keys']['alpha']['masked']})
        assert result.json()['models'] == ['upstream-model']
        discovery.assert_called_once_with(profiles[0]['base_url'],keys['alpha'])
        before_probe=library.read_text(encoding='utf8')
        result=client.post('/api/settings/models',json={'provider':'alpha','base_url':'https://different.example/v1','api_key':saved['keys']['alpha']['masked']})
        assert not result.json()['ok'] and discovery.call_count == 1
        result=client.post('/api/settings/models',json={'provider':'alpha','api_key':''})
        assert not result.json()['ok'] and discovery.call_count == 1
        client.post('/api/settings/models',json={'provider':'unsaved-api','base_url':'https://draft.example/v1','api_key':'fictional-draft-key'}).raise_for_status()
        discovery.assert_called_with('https://draft.example/v1','fictional-draft-key')
        assert library.read_text(encoding='utf8') == before_probe,'model discovery must never save the draft or selected model'
    with patch.object(main,'_extract_text',return_value='isolated paper'), patch('openai.OpenAI') as ai:
        ai.return_value.chat.completions.create.return_value = [SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content='summary'))])]
        summary = client.post('/api/summaries',json={'paper_id':'p1','prompt_id':'d1','mode':'text'})
        assert summary.status_code == 200, summary.text
        assert ai.call_args.kwargs['base_url'] == profiles[1]['base_url']
        assert ai.return_value.chat.completions.create.call_args.kwargs['temperature'] == 0.8
    store.set_settings({'service':'openai'})
    task = store.add_task('p1')
    with patch.object(translate,'_pdf2zh_cmd',return_value=['fake-pdf2zh']), patch.object(translate.subprocess,'Popen') as process:
        process.return_value.stdout = []
        process.return_value.wait.return_value = 1
        translate._run_one(task['id'])
        env = process.call_args.kwargs['env']
        assert env['OPENAI_BASE_URL'] == profiles[1]['base_url'] and env['OPENAI_API_KEY'] == keys['beta']
    print('PASS rename preserves keys, masked saves, connection test and selected summary/translation configuration')

    before = library.read_text(encoding='utf8')
    with patch.object(store, '_flush', side_effect=OSError('isolated disk failure')):
        try:
            store.set_settings({'provider':'alpha'})
            raise AssertionError('expected a failed write')
        except OSError:
            pass
    assert store.get_settings()['provider'] == 'beta', 'failed writes must not switch the active API in memory'
    for invalid in [dict(api_profiles=[profiles[0],profiles[0]]), dict(api_profiles=[{**profiles[0],'name':''}]),
                    dict(api_profiles=[{**profiles[0],'base_url':'file:///private'}]), dict(provider='missing'),
                    dict(api_profiles=[{**profiles[0],'temperature':3}])]:
        assert client.post('/api/settings',json=invalid).status_code == 400
        assert library.read_text(encoding='utf8') == before, 'invalid input must not alter settings'
    deleted = client.post('/api/settings',json={'api_profiles':[profiles[0]],'provider':'alpha'}).json()
    assert 'beta' not in deleted['keys'] and store.get_settings('beta')['api_key'] == ''
    client.post('/api/settings',json={'provider':'alpha','api_keys':{'alpha':''}}).raise_for_status()
    assert not store.has_api_key()
    client.post('/api/settings',json={'api_profiles':[],'provider':''}).raise_for_status()
    assert store.get_settings()['api_key'] == '' and store.get_settings()['base_url'] == ''
    client.post('/api/settings',json={'web_ai_browser':'edge'}).raise_for_status()
    empty_again = Store().get_settings()
    assert empty_again['api_profiles'] == [] and empty_again['api_keys'] == {} and empty_again['provider'] == ''
    assert main._mask('tiny') == '****'
    print('PASS input validation, deletion, explicit key clearing and empty state after restart')

    legacy = dict(provider='deepseek',base_url='https://existing.example/v1',model='custom-old-model',api_key=secret.encrypt(keys['alpha']),
                  api_keys={'deepseek':secret.encrypt(keys['alpha']),'openai':secret.encrypt(keys['beta'])})
    assert migrate_profiles(legacy)
    assert len(legacy['api_profiles']) == 2 and legacy['base_url'] == 'https://existing.example/v1'
    assert legacy['model'] == 'custom-old-model' and secret.decrypt(legacy['api_keys']['openai']) == keys['beta']
    assert not migrate_profiles(legacy)
    no_legacy = {}; assert migrate_profiles(no_legacy) and no_legacy['api_profiles'] == []
    original_db = json.loads(library.read_text(encoding='utf8'))
    original_db['settings'] = dict(provider='deepseek',base_url='https://existing.example/v1',model='old-model',api_key=keys['alpha'])
    library.write_text(json.dumps(original_db),encoding='utf8')
    migrated_store = Store()
    assert migrated_store.get_settings()['api_key'] == keys['alpha']
    assert len(migrated_store.get_settings()['api_profiles']) == 1
    assert migrated_store.get_settings()['api_profiles'][0]['base_url'] == 'https://existing.example/v1'
    assert keys['alpha'] not in library.read_text(encoding='utf8')
    print('PASS one-time legacy configuration migration without seeding new providers')
