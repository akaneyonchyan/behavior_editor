"""Run the read-only Feishu sync using the last successfully deployed image."""
import fcntl,json,pathlib,re,subprocess
root=pathlib.Path('/home/ubuntu/pps-editor')
with open(root/'library-sync.lock','a') as lock:
    fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    image=json.loads((root/'deployment.json').read_text())['image']
    if not re.fullmatch(r'behavior-editor:[a-f0-9]{12}',image):raise ValueError('Unexpected deployed image')
    subprocess.run(['docker','run','--rm','--name','pps-editor-library-sync','--read-only','--tmpfs','/tmp','--cap-drop','ALL','--security-opt','no-new-privileges:true','--stop-timeout','10','-v',str(root/'private')+':/run/editor-secrets:ro','-v',str(root/'shared')+':/app/library-data','-e','LIBRARY_SYNC_CONFIG_FILE=/run/editor-secrets/library-sync.json','-e','LIBRARY_OUTPUT_DIR=/app/library-data',image,'node','server/library-sync.mjs'],check=True)
