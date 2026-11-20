import {randomUUID,randomBytes} from 'node:crypto';
import {ChannelStore} from './store.mjs';
import {validateProvider} from './contracts.mjs';
import {publicCatalog,routes} from './catalog.mjs';
import {startGateway} from './gateway.mjs';

let instance;
export async function service(electron) {
  if(!instance)instance=(async()=>{
    const store=new ChannelStore(electron.safeStorage);const config=await store.read();const token=randomBytes(32).toString('hex');
    const gateway=config.enabled?await startGateway(store,token):null;
    return new ChannelService(store,gateway,token,config);
  })();
  return instance;
}
export class ChannelService {
  constructor(store,gateway,token,config){this.store=store;this.gateway=gateway;this.token=token;this.catalogSnapshot=JSON.stringify(config?.providers??[]);this.queue=Promise.resolve();}
  async status(){const config=await this.store.read();return {...config,running:!!this.gateway,restartRequired:config.enabled!==!!this.gateway||!!this.gateway&&JSON.stringify(config.providers)!==this.catalogSnapshot};}
  mutate(action){const operation=this.queue.then(action);this.queue=operation.catch(()=>{});return operation;}
  async catalog(){const config=await this.store.read();return publicCatalog({...config,enabled:!!this.gateway},this.gateway?.url);}
  async save(input) {
    const provider=validateProvider(input);
    const operation=this.queue.then(async()=>{
      const config=await this.store.read();const previous=input.id?config.providers.find(provider=>provider.id===input.id):null;
      if(input.id&&!previous)throw new Error('Channel no longer exists.');
      const id=previous?.id??randomUUID();
      if(input.apiKey)await this.store.setSecret(id,input.apiKey);
      else if(!previous)throw new Error('API key is required for a new channel.');
      const row={id,...provider};config.providers=previous?config.providers.map(value=>value.id===id?row:value):[...config.providers,row];
      const available=routes(config);if(!available.some(route=>route.alias===config.defaultAlias))config.defaultAlias=available[0]?.alias??null;
      await this.store.write(config);return this.status();
    });this.queue=operation.catch(()=>{});return operation;
  }
  async remove(id){return this.mutate(async()=>{const config=await this.store.read();if(!config.providers.some(provider=>provider.id===id))throw new Error('Channel no longer exists.');config.providers=config.providers.filter(provider=>provider.id!==id);const available=routes(config);if(!available.some(route=>route.alias===config.defaultAlias))config.defaultAlias=available[0]?.alias??null;if(!available.length)config.enabled=false;await this.store.write(config);await this.store.deleteSecret(id);return this.status();});}
  async mode(enabled){return this.mutate(async()=>{if(typeof enabled!=='boolean')throw new Error('Invalid channel mode.');const config=await this.store.read();if(enabled&&!config.providers.length)throw new Error('Add a channel before enabling aggregation.');config.enabled=enabled;await this.store.write(config);return this.status();});}
  async models(input){const provider=validateProvider({...input,models:[{id:'discovery'}]});const config=await this.store.read();const key=input.apiKey||(input.id&&config.providers.some(provider=>provider.id===input.id)?await this.store.secret(input.id):null);if(!key)throw new Error('API key is required.');const gemini=provider.protocol==='gemini';const url=gemini?provider.baseUrl.replace(/\/v1beta\/?$/,'')+'/v1beta/models':provider.baseUrl+'/models';const response=await fetch(url,{headers:gemini?{'x-goog-api-key':key}:provider.protocol==='anthropic'?{'x-api-key':key,'anthropic-version':'2023-06-01'}:{authorization:'Bearer '+key},signal:AbortSignal.timeout(20000),redirect:'error'});if(!response.ok)throw new Error('Model discovery returned HTTP '+response.status);const body=await response.json();return (gemini?body.models:body.data).map(model=>({id:gemini?model.name.replace(/^models\//,''):model.id,label:model.displayName??model.id??model.name}));}
}
export async function installIpc(electron) {
  const target=await service(electron);
  electron.ipcMain.handle('oh-my-antigravity:channels',async(event,input)=>{
    if(event.senderFrame!==event.sender.mainFrame)throw new Error('Channel settings are only available in the main application.');
    const origin=new URL(event.senderFrame.url);if(!['127.0.0.1','localhost','[::1]'].includes(origin.hostname)||!['http:','https:'].includes(origin.protocol))throw new Error('Invalid channel settings origin.');
    if(!input||typeof input!=='object')throw new Error('Invalid channel request.');
    switch(input.action){case 'status':return target.status();case 'catalog':return target.catalog();case 'save':return target.save(input.provider);case 'remove':return target.remove(input.id);case 'mode':return target.mode(input.enabled);case 'models':return target.models(input.provider);default:throw new Error('Unknown channel settings action.');}
  });
}
