"""Deploy an authenticated release, check it, and roll back on failure. No secrets printed."""
import fcntl, hashlib, http.client, json, os, pathlib, re, shutil, subprocess, sys, tarfile, time
ROOT = pathlib.Path('/home/ubuntu/pps-editor')
SOURCE = 'https://git.xindong.com/petpals/shared/design_behavior_editor.git'

def run(*args, capture=False):
    return subprocess.run(args, check=True, text=True, stdout=subprocess.PIPE if capture else None).stdout

def inspect(name, template):
    return run('sudo','docker','inspect','--format',template,name,capture=True).strip()

def probe(port, tls=False):
    checks=[('/login',200),('/',303),('/api/behaviors',401),('/data/library.json',401)]
    # Nginx deliberately hides /healthz from the public HTTPS endpoint.
    if not tls:checks.insert(0,('/healthz',200))
    for path, expected in checks:
        if tls:
            result=run('curl','--silent','--show-error','--max-time','10','--resolve','behavior-editor.online:443:127.0.0.1','-o','/dev/null','-w','%{http_code}','https://behavior-editor.online'+path,capture=True)
            status=int(result)
        else:
            conn=http.client.HTTPConnection('127.0.0.1',port,timeout=10)
            conn.request('GET',path,headers={'Host':'behavior-editor.online'})
            response=conn.getresponse();status=response.status;response.read();conn.close()
        if status!=expected:raise RuntimeError('Health check failed: '+path+' '+str(status))

def ready(port,tls=False):
    for attempt in range(20):
        try:probe(port,tls);return
        except Exception:
            if attempt==19:raise
            time.sleep(1)

def compose(directory,image):
    run('sudo','env','EDITOR_IMAGE='+image,'docker','compose','--project-directory',str(directory),'-f',str(directory/'compose.yaml'),'-p','pps-editor-auth','up','-d','--no-build')

def main():
    filename,commit,digest=sys.argv[1:]
    if not re.fullmatch(r'[0-9a-f]{40}',commit) or not re.fullmatch(r'[0-9a-f]{64}',digest):raise ValueError('Invalid release identity')
    if not re.fullmatch(r'editor-'+commit[:12]+r'-[0-9]+\.tar\.gz',filename):raise ValueError('Invalid archive name')
    archive=ROOT/'releases'/filename
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=digest:raise ValueError('Archive checksum mismatch')
    with open(ROOT/'deploy.lock','a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        deploy_archive(archive,commit)

def deploy_archive(archive,commit):
    release=ROOT/'releases'/commit[:12]
    if release.exists():
        manifest=json.loads((release/'release.json').read_text())
        if manifest.get('commit')!=commit:raise ValueError('Release directory collision')
    else:
        stage=ROOT/'releases'/('staging-'+commit[:12]+'-'+str(os.getpid()))
        stage.mkdir(mode=0o700)
        with tarfile.open(archive) as tar:
            for member in tar.getmembers():
                target=(stage/member.name).resolve()
                if not target.is_relative_to(stage.resolve()) or not (member.isfile() or member.isdir()):raise ValueError('Unsafe archive member')
            tar.extractall(stage)
        stage.rename(release)
    manifest=json.loads((release/'release.json').read_text())
    if manifest.get('commit')!=commit or manifest.get('source')!=SOURCE or manifest.get('loginImplemented') is not True:raise ValueError('Not an authenticated release')
    previous_image=inspect('pps-editor-auth-editor-1','{{.Config.Image}}')
    previous_dir=pathlib.Path(inspect('pps-editor-auth-editor-1','{{index .Config.Labels "com.docker.compose.project.working_dir"}}'))
    if not previous_dir.resolve().is_relative_to((ROOT/'releases').resolve()):raise ValueError('Unknown rollback directory')
    image='behavior-editor:'+commit[:12]
    run('sudo','docker','build','--pull=false','-t',image,str(release))
    canary='pps-editor-check-'+commit[:12]
    started=False
    try:
        run('sudo','docker','run','-d','--name',canary,'--read-only','--tmpfs','/tmp','--cap-drop','ALL','--security-opt','no-new-privileges:true','-p','127.0.0.1:5112:5110','--env-file',str(ROOT/'private/auth.env'),'-e','AUTH_DB_PATH=/tmp/auth.sqlite','-e','AUTH_MEMBERS_FILE=/run/editor-secrets/members.json','-e','FEISHU_LOGIN_APP_SECRET_FILE=/run/editor-secrets/feishu-app-secret','-e','LIBRARY_SNAPSHOT_PATH=/app/library-data/library.json','-v',str(ROOT/'shared')+':/app/library-data:ro','-v',str(ROOT/'private')+':/run/editor-secrets:ro',image,'node','server/cloud-auth.mjs')
        started=True;ready(5112)
    finally:
        if started:run('sudo','docker','rm','-f',canary)
    try:
        compose(release,image)
        ready(5111);ready(443,True)
    except Exception:
        print('Deployment check failed; restoring previous image.',flush=True)
        compose(previous_dir,previous_image);ready(5111)
        raise
    shared=ROOT/'shared';shared.mkdir(mode=0o700,exist_ok=True)
    temp=shared/'library.json.next'
    # The server-side sync owns this file. A code release must not roll it back.
    if not (shared/'library.json').exists():
        shutil.copyfile(release/'dist/data/library.json',temp);temp.chmod(0o600);temp.replace(shared/'library.json')
    current=ROOT/'current-release.next'
    current.write_text(str(release)+'\n');current.replace(ROOT/'current-release')
    setup=ROOT/'configure-editor-https.sh'
    if setup.exists():
        setup.write_text(setup.read_text().replace(previous_image.split(':')[-1],commit[:12]))
    result={'commit':commit,'image':image,'previousImage':previous_image,'librarySyncedAt':manifest['librarySyncedAt'],'verified':'server HTTPS login and anonymous data gate'}
    (ROOT/'deployment.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))

if __name__=='__main__':main()
