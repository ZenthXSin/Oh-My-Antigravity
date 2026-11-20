import json
from pathlib import Path

root=Path(__file__).resolve().parent.parent
before=json.loads((root/'backups/initial/config.json').read_text(encoding='utf-8-sig'))
after=json.loads((Path.home()/'.gemini/config/config.json').read_text(encoding='utf-8-sig'))
before.setdefault('plugins',{})

def diff(a,b,p=''):
    if isinstance(a,dict) and isinstance(b,dict):
        result=[]
        for k in a.keys()|b.keys():
            if k not in a or k not in b:result.append(p+'/'+k)
            else:result+=diff(a[k],b[k],p+'/'+k)
        return result
    return [] if a==b else [p]

changed=diff(before,after)
allowed=['/plugins/agent-workflow-zh','/plugins/antigravity-pulse','/sidecars/antigravity-pulse/']
unexpected=[p for p in changed if not any(p.startswith(a) for a in allowed)]
if unexpected:raise RuntimeError('Unexpected configuration changes: '+str(unexpected))
print('PASS: models, providers, endpoints and user policies preserved; only intended plugin/sidecar registrations changed')
