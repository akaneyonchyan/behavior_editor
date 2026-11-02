#!/usr/bin/env python3
"""Check the paired backend without printing secrets or creating a document."""
import json
from pathlib import Path
from urllib.request import Request, urlopen

token = (Path(__file__).resolve().parent / 'private/service-token').read_text().strip()
request = Request('https://behavior-editor.online/collaboration/rpc',
    method='POST', headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
    data=json.dumps({'user': {'id': 'deployment-health-check'}, 'input': {'action': 'health'}}).encode())
with urlopen(request, timeout=15) as response:
    result = json.load(response)
    if result != {'ready': True, 'mode': 'browser-direct'}:
        raise SystemExit('Unexpected service response')
    print('HTTPS pairing verified: browser-direct service ready; no document modified.')
