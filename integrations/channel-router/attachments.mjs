import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const guid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const extensions={'application/zip':'.zip','application/pdf':'.pdf','image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','text/plain':'.txt'};
const hash=data=>createHash('sha256').update(data).digest('hex');
const localPath=uri=>uri.startsWith('file:')?fileURLToPath(uri):path.isAbsolute(uri)?uri:null;
function attachmentError(message){const error=new Error('Attachment: '+message);error.status=400;return error;}
function sessionId(body) {
  const text=(body.systemInstruction?.parts??[]).map(p=>p.text??'').join('\n');
  const id=/^Conversation ID: ([a-f0-9-]{36})\s*$/im.exec(text)?.[1]??body.labels?.cascade_id??body.sessionId;
  return typeof id==='string'&&guid.test(id)?id:null;
}
export class Attachments {
  constructor(native){this.native=native;this.contexts=new Map();}
  async context(cascadeId) {
    if(!guid.test(cascadeId??''))throw attachmentError('A conversation is required to save files.');
    if(!this.contexts.has(cascadeId)) {
      const pending=(async()=>{
        const trajectory=await this.native.trajectory(cascadeId);
        const uri=trajectory.metadata?.workspaceUris?.[0]??trajectory.metadata?.workspaces?.[0]?.workspaceFolderAbsoluteUri;
        const workspace=uri?localPath(uri):path.join(os.homedir(),'.gemini','antigravity','brain',cascadeId);
        if(!workspace)throw attachmentError('The selected workspace is not a local directory.');
        const directory=path.join(workspace,'.antigravity','attachments',cascadeId);
        const context={directory,files:new Map(),sources:new Map()};
        const media=(trajectory.steps??[]).flatMap(step=>step.userInput?.media??[]);
        for(const item of media)await this.copy(context,item);
        return context;
      })();
      this.contexts.set(cascadeId,pending);pending.catch(()=>this.contexts.delete(cascadeId));
      if(this.contexts.size>64)this.contexts.delete(this.contexts.keys().next().value);
    }
    return this.contexts.get(cascadeId);
  }
  async save(context,data,name,mimeType) {
    const digest=hash(data);
    if(context.files.has(digest))return context.files.get(digest);
    const filename=path.basename(name||'attachment-'+digest.slice(0,16)+(extensions[mimeType]??'.bin')).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_');
    await fs.mkdir(context.directory,{recursive:true});
    let target=path.join(context.directory,filename);
    try{const previous=await fs.readFile(target);if(hash(previous)!==digest){const parsed=path.parse(filename);target=path.join(context.directory,parsed.name+'-'+digest.slice(0,12)+parsed.ext);}}
    catch(error){if(error.code!=='ENOENT')throw error;}
    await fs.writeFile(target,data,{flag:'wx'}).catch(async error=>{if(error.code!=='EEXIST'||hash(await fs.readFile(target))!==digest)throw error;});
    const result=target.replaceAll('\\','/');context.files.set(digest,result);return result;
  }
  async copy(context,media) {
    if(media.uri&&context.sources.has(media.uri))return context.sources.get(media.uri);
    const source=media.uri&&localPath(media.uri);
    const data=media.data?Buffer.from(media.data,'base64'):source?await fs.readFile(source):null;
    if(!data)throw attachmentError('The uploaded file is missing. Upload it again.');
    const target=await this.save(context,data,media.displayName??(source&&path.basename(source)),media.mimeType);
    if(media.uri)context.sources.set(media.uri,target);return target;
  }
  async prepare(cascadeId,media) {
    const context=await this.context(cascadeId);
    const paths=[];for(const item of media)paths.push(await this.copy(context,item));
    return {paths};
  }
  async request(body) {
    const attached=(body.contents??[]).filter(content=>content.role!=='model'&&!content.parts?.some(part=>part.functionResponse)&&content.parts?.some(part=>part.inlineData||part.fileData));
    if(!attached.length)return body;
    const id=sessionId(body);if(!id)throw attachmentError('Cannot identify the conversation workspace.');
    const context=await this.context(id);
    for(const content of attached) {
      const parts=[];
      for(const part of content.parts) {
        if(part.inlineData) {
          const data=Buffer.from(part.inlineData.data,'base64');const target=context.files.get(hash(data))??await this.save(context,data,null,part.inlineData.mimeType);
          parts.push({text:target});
        } else if(part.fileData) {
          const target=await this.copy(context,{uri:part.fileData.fileUri,mimeType:part.fileData.mimeType});parts.push({text:target});
        } else parts.push(part);
      }
      content.parts=parts;
    }
    return body;
  }
}
