import io
from pathlib import Path
import sys
import unittest
import zipfile
import tempfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from note_import import prepare_import, decode_markdown
from note_export import export_note

def archive(files):
    data=io.BytesIO()
    with zipfile.ZipFile(data,'w') as z:
        for name,content in files:z.writestr(name,content)
    return data.getvalue()

class NoteImportTests(unittest.TestCase):
    def test_encodings_and_original_filename(self):
        for encoding in ('utf-8-sig','utf-16','gb18030'):
            result=prepare_import('测试.md','# 标题\n\n正文'.encode(encoding))
            self.assertEqual(result['title'],'测试')
            self.assertEqual(result['content'],'# 标题\n\n正文')
        with self.assertRaises(ValueError):decode_markdown(b'\x00binary')

    def test_images_zip_and_missing_asset_warning(self):
        result=prepare_import('note.zip',archive([('folder/Paper.md','![x](images/a.png)\n<img src="images/a.png" width="200">\n![remote](https://example.com/x.png)'),('folder/images/a.png',b'image')]))
        self.assertEqual(result['title'],'Paper')
        self.assertEqual(len(result['images']),1)
        self.assertIn('/api/notes/image/',result['content'])
        self.assertIn('https://example.com/x.png',result['content'])
        self.assertFalse(result['warnings'])
        plain=prepare_import('note.md',b'![x](images/a.png)')
        self.assertTrue(plain['warnings'])
        self.assertIn('images/a.png',plain['content'])

    def test_image_names_with_spaces_parentheses_and_html_entities(self):
        result=prepare_import('notes.zip',archive([
            ('note.md','![截图](<images/截图 1.png>)\n![plot](images/plot(1).png)\n<img src="images/a&amp;b.png" width="64">'),
            ('images/截图 1.png',b'screenshot'),('images/plot(1).png',b'plot'),('images/a&b.png',b'html')]))
        self.assertFalse(result['warnings'])
        self.assertEqual(set(result['images'].values()),{b'screenshot',b'plot',b'html'})
        self.assertEqual(result['content'].count('/api/notes/image/'),3)
        self.assertIn('width="64"',result['content'])

    def test_code_examples_are_not_rewritten_as_attachments(self):
        example='![example](images/diagram.png)'
        result=prepare_import('notes.zip',archive([('note.md',f'```md\n{example}\n```\n\n`{example}`\n\n![actual](images/diagram.png)'),('images/diagram.png',b'png')]))
        self.assertEqual(result['content'].count(example),2)
        self.assertEqual(result['content'].count('/api/notes/image/'),1)
        self.assertEqual(len(result['images']),1)

    def test_bad_zip_paths_and_ambiguous_notes(self):
        for files in [[('../x.md','bad')],[('/x.md','bad')],[('a.md','a'),('b.md','b')],[('images/x.png',b'png')]]:
            with self.assertRaises(ValueError):prepare_import('notes.zip',archive(files))
        with self.assertRaises(ValueError):prepare_import('a.pdf',b'data')
        with self.assertRaises(ValueError):prepare_import('a.zip',b'bad zip')
        with self.assertRaises(ValueError):prepare_import('a.md',b'x'*(5*1024*1024+1))

    def test_lithub_export_round_trip_keeps_image_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            images=Path(directory)
            name='a'*32+'.png'
            (images/name).write_bytes(b'round trip image bytes')
            note={'title':'Round trip','content':f'# Heading\n\n![Picture](/api/notes/image/{name})'}
            result=prepare_import('note.zip',export_note(note,images))
            self.assertEqual(result['title'],note['title'])
            self.assertEqual(list(result['images'].values()),[b'round trip image bytes'])
            self.assertFalse(result['warnings'])

if __name__=='__main__':unittest.main()
