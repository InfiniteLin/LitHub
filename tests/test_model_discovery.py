"""Only local HTTP fixtures, never real API keys or upstream requests."""
import json
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from model_discovery import discover_models, same_origin


class ModelDiscoveryTests(unittest.TestCase):
    def test_local_upstream_protocol_and_failure_modes(self):
        requests = []
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args): pass
            def do_GET(self):
                requests.append((self.path, self.headers.get('Authorization')))
                if self.path == '/v1/models':
                    data = {'data':[{'id':'z-model'},{'id':'a-model'},{'id':'a-model'},{'id':''},{'id':'x'*300},{'name':'missing-id'}]}
                    self.send_response(200);self.end_headers();self.wfile.write(json.dumps(data).encode())
                elif self.path == '/redirect/models':
                    self.send_response(302);self.send_header('Location','/v1/models');self.end_headers()
                else:
                    self.send_response(401 if self.path.startswith('/unauthorized') else 404);self.end_headers()
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            base=f'http://127.0.0.1:{server.server_port}'
            result=discover_models(base+'/v1','fictional-key')
            self.assertEqual(result['models'],['a-model','z-model'])
            self.assertEqual(requests,[('/v1/models','Bearer fictional-key')])
            for endpoint in ('/missing','/unauthorized','/redirect'):
                result=discover_models(base+endpoint,'fictional-key')
                self.assertFalse(result['ok']);self.assertEqual(result['models'],[])
                self.assertNotIn('fictional-key',json.dumps(result))
            self.assertEqual(len(requests),4,'no redirects and no hidden automatic retry')
            self.assertFalse(discover_models('file:///bad','fictional-key')['ok'])
            self.assertFalse(discover_models(base+'/v1?secret=query','fictional-key')['ok'])
            self.assertEqual(len(requests),4)
        finally:
            server.shutdown();server.server_close();thread.join()

    def test_saved_credentials_origin(self):
        self.assertTrue(same_origin('https://EXAMPLE.com:443/v1','https://example.com/v2'))
        self.assertFalse(same_origin('http://example.com','https://example.com'))
        self.assertFalse(same_origin('https://new.example.com','https://example.com'))
        self.assertFalse(same_origin('http://localhost:9000','http://localhost:8000'))


if __name__ == '__main__': unittest.main()
