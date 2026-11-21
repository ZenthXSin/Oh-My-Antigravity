"""Install audited native startup and IPC adapters for the channel router."""
import json
import os
from pathlib import Path
from asar import Archive

ROOT=Path(__file__).resolve().parent.parent
APP=Path(os.environ['AGY_APP_ASAR'])
archive=Archive(APP)
marker='// OH_MY_ANTIGRAVITY_CHANNELS_V2'
legacy='// OH_MY_ANTIGRAVITY_CHANNELS_V1'
source=archive.read('dist/languageServer.js').decode('utf8')
if legacy in source:
    source=source.replace(legacy,marker,1)
    old="...(omaChannels.gateway ? ['--model_api_client_type=gemini','--api_server_url='+omaChannels.gateway.url] : [])"
    new="...(omaChannels.officialRouter ? ['--cloud_code_endpoint='+omaChannels.officialRouter.url] : omaChannels.gateway ? ['--model_api_client_type=gemini','--api_server_url='+omaChannels.gateway.url] : [])"
    if source.count(old)!=1:raise RuntimeError('Legacy channel startup changed.')
    source=source.replace(old,new,1)
    source=source.replace('if(omaChannels.gateway){env.GEMINI_API_KEY=', 'if(omaChannels.gateway&&!omaChannels.officialRouter){env.GEMINI_API_KEY=',1)
    APP.write_bytes(archive.rewrite({'dist/languageServer.js':source.encode('utf8')}))
    from hashlib import sha256
    manifest=ROOT/'backups/2.33.0/manifest.json'
    state=json.loads(manifest.read_text(encoding='utf8'))
    state['patched_sha256']=sha256(APP.read_bytes()).hexdigest()
    state['changed_entries']=list(dict.fromkeys([*state['changed_entries'],'dist/languageServer.js','dist/preload.js','dist/ipcHandlers.js']))
    manifest.write_text(json.dumps(state,indent=2),encoding='utf8')
elif marker not in source:
    anchor='    const loginShellEnv = await shellEnvReads.take();'
    if source.count(anchor)!=1:raise RuntimeError('Native startup integration changed.')
    loader="require('node:url').pathToFileURL(require('node:path').join(require('node:os').homedir(),'.gemini','config','plugins','oh-my-channels','runtime','service.mjs')).href"
    source=source.replace(anchor,anchor+'\n    '+marker+"\n    const omaChannels=await (await import("+loader+")).service(electron_1);",1)
    anchor="            '--enable_sidecars',"
    source=source.replace(anchor,anchor+"\n            ...(omaChannels.officialRouter ? ['--cloud_code_endpoint='+omaChannels.officialRouter.url] : omaChannels.gateway ? ['--model_api_client_type=gemini','--api_server_url='+omaChannels.gateway.url] : []),",1)
    anchor='        const env = { ...process.env, ...loginShellEnv };'
    source=source.replace(anchor,anchor+"\n        if(omaChannels.gateway&&!omaChannels.officialRouter){env.GEMINI_API_KEY=omaChannels.token;env.GOOGLE_GEMINI_BASE_URL=omaChannels.gateway.url;}",1)
    preload=archive.read('dist/preload.js').decode('utf8')+'\n'+marker+"\nelectron_1.contextBridge.exposeInMainWorld('ohMyChannels',{request:input=>electron_1.ipcRenderer.invoke('oh-my-antigravity:channels',input)});\n"
    ipc=archive.read('dist/ipcHandlers.js').decode('utf8')+'\n'+marker+"\nvoid import("+loader+").then(module=>module.installIpc(electron_1)).catch(error=>console.error('[Oh My Antigravity] Channels:',error.message));\n"
    APP.write_bytes(archive.rewrite({'dist/languageServer.js':source.encode('utf8'),'dist/preload.js':preload.encode('utf8'),'dist/ipcHandlers.js':ipc.encode('utf8')}))
    # Uninstall accepts exactly this archive hash, including the channel patch.
    from hashlib import sha256
    manifest=ROOT/'backups/2.33.0/manifest.json'
    state=json.loads(manifest.read_text(encoding='utf8'))
    state['patched_sha256']=sha256(APP.read_bytes()).hexdigest()
    state['changed_entries']=list(dict.fromkeys([*state['changed_entries'],'dist/languageServer.js','dist/preload.js','dist/ipcHandlers.js']))
    manifest.write_text(json.dumps(state,indent=2),encoding='utf8')
