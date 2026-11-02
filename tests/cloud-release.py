import hashlib, importlib.util, io, json, pathlib, sys, tarfile, tempfile, types, unittest
from unittest.mock import patch
if sys.platform=='win32':sys.modules['fcntl']=types.SimpleNamespace(LOCK_EX=1,LOCK_NB=2,flock=lambda *a:None)
spec=importlib.util.spec_from_file_location('deploy',pathlib.Path(__file__).resolve().parents[1]/'deploy/cloud-release.py')
deploy=importlib.util.module_from_spec(spec);spec.loader.exec_module(deploy)

class ReleaseTest(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.temp.name);(self.root/'releases').mkdir()
  self.commit='a'*40;self.calls=[];self.switches=[];self.fail=False
  self.archive=self.root/'releases'/('editor-'+self.commit[:12]+'-1.tar.gz')
  self.build()
 def tearDown(self):self.temp.cleanup()
 def build(self,authenticated=True,unsafe=False):
  manifest={'commit':self.commit,'source':deploy.SOURCE,'loginImplemented':authenticated,'librarySyncedAt':'2026-10-26T00:21:05.446Z'}
  files={'release.json':json.dumps(manifest),'dist/data/library.json':'{}','compose.yaml':'services: {}'}
  if unsafe:files['../escape']='bad'
  with tarfile.open(self.archive,'w:gz') as tar:
   for name,text in files.items():
    data=text.encode();entry=tarfile.TarInfo(name);entry.size=len(data);tar.addfile(entry,io.BytesIO(data))
 def execute(self,digest=None):
  digest=digest or hashlib.sha256(self.archive.read_bytes()).hexdigest()
  def inspect(name,template):return 'behavior-editor:old' if template=='{{.Config.Image}}' else str(self.root/'releases/old')
  def ready(port,tls=False):
   if tls and self.fail:raise RuntimeError('simulated failed HTTPS')
  with patch.object(deploy,'ROOT',self.root),patch.object(sys,'argv',['deploy',self.archive.name,self.commit,digest]),patch.object(deploy,'inspect',inspect),patch.object(deploy,'run',lambda *a,**k:self.calls.append(a)),patch.object(deploy,'ready',ready),patch.object(deploy,'compose',lambda directory,image:self.switches.append(image)):
   deploy.main()
 def test_success(self):
  self.execute();self.assertEqual(self.switches,['behavior-editor:'+self.commit[:12]])
  self.assertEqual(json.loads((self.root/'deployment.json').read_text())['commit'],self.commit)
  self.assertEqual((self.root/'current-release').read_text().strip(),str(self.root/'releases'/self.commit[:12]))
 def test_rollback(self):
  self.fail=True
  with self.assertRaises(RuntimeError):self.execute()
  self.assertEqual(self.switches,['behavior-editor:'+self.commit[:12],'behavior-editor:old'])
  self.assertFalse((self.root/'deployment.json').exists())
 def test_checksum(self):
  with self.assertRaises(ValueError):self.execute('b'*64)
  self.assertEqual(self.calls,[])
 def test_code_release_preserves_newer_synced_library(self):
  (self.root/'shared').mkdir();(self.root/'shared/library.json').write_text('newest synced data')
  self.execute();self.assertEqual((self.root/'shared/library.json').read_text(),'newest synced data')
  self.assertTrue(any('/app/library-data/library.json' in part for args in self.calls for part in args))
 def test_requires_login(self):
  self.build(authenticated=False)
  with self.assertRaises(ValueError):self.execute()
  self.assertEqual(self.switches,[])
 def test_traversal(self):
  self.build(unsafe=True)
  with self.assertRaises(ValueError):self.execute()
  self.assertFalse((self.root/'releases/escape').exists())
 def test_https_probe_does_not_require_private_health(self):
  paths=[]
  def curl(*args,**kwargs):
   path=args[-1].removeprefix('https://behavior-editor.online');paths.append(path)
   return {'/healthz':'404','/login':'200','/':'303','/api/behaviors':'401','/data/library.json':'401'}[path]
  with patch.object(deploy,'run',curl):deploy.probe(443,True)
  self.assertNotIn('/healthz',paths)
  self.assertIn('/data/library.json',paths)

if __name__=='__main__':unittest.main()
