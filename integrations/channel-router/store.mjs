import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export class ChannelStore {
  constructor(safeStorage,{directory=path.join(os.homedir(),'.gemini','oh-my-antigravity','channels')}={}) {
    this.safeStorage=safeStorage;this.directory=directory;this.file=path.join(directory,'config.json');this.queue=Promise.resolve();
  }
  async read() {
    try{return JSON.parse(await fs.readFile(this.file,'utf8'));}
    catch(error){if(error.code==='ENOENT')return {schema:1,enabled:false,defaultAlias:null,providers:[]};throw error;}
  }
  async write(config) {
    const operation=this.queue.then(async()=>{
      await fs.mkdir(this.directory,{recursive:true});
      const temporary=this.file+'.tmp';
      const handle=await fs.open(temporary,'w',0o600);
      try{await handle.writeFile(JSON.stringify(config,null,2)+'\n','utf8');await handle.sync();}finally{await handle.close();}
      await fs.rename(temporary,this.file);
    });
    this.queue=operation.catch(()=>{});return operation;
  }
  async setSecret(id,key) {
    if(typeof key!=='string'||!key.trim()||/[\r\n]/.test(key))throw new Error('API key must be a nonempty single-line value.');
    if(!this.safeStorage.isEncryptionAvailable())throw new Error('Windows credential encryption is unavailable.');
    await fs.mkdir(this.directory,{recursive:true});
    await fs.writeFile(path.join(this.directory,id+'.key'),this.safeStorage.encryptString(key),{mode:0o600});
  }
  async secret(id) {return this.safeStorage.decryptString(await fs.readFile(path.join(this.directory,id+'.key')));}
  async deleteSecret(id) {await fs.rm(path.join(this.directory,id+'.key'),{force:true});}
}
