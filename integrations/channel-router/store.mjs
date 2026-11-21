import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {isWindowsSecret,encryptWindowsSecret,decryptWindowsSecret} from './windows-secret.mjs';

export class ChannelStore {
  constructor(safeStorage,{directory=path.join(os.homedir(),'.gemini','oh-my-antigravity','channels')}={}) {
    this.safeStorage=safeStorage;this.directory=directory;this.file=path.join(directory,'config.json');this.queue=Promise.resolve();
  }
  async read() {
    try{return JSON.parse(await fs.readFile(this.file,'utf8'));}
    catch(error){if(error.code==='ENOENT')return {schema:1,connectionMode:'local',enabled:false,defaultAlias:null,providers:[]};throw error;}
  }
  async write(config) {
    const operation=this.queue.then(async()=>{
      await fs.mkdir(this.directory,{recursive:true});
      const temporary=this.file+'.tmp';
      const handle=await fs.open(temporary,'w',0o600);
      try{await handle.writeFile(JSON.stringify(config,null,2)+'\n','utf8');await handle.sync();}finally{await handle.close();}
      try {await fs.rename(temporary,this.file);}
      catch(error) {
        if(process.platform!=='win32'||error.code!=='EXDEV')throw error;
        await fs.copyFile(temporary,this.file);
        await fs.unlink(temporary);
      }
    });
    this.queue=operation.catch(()=>{});return operation;
  }
  async setSecret(id,key) {
    if(typeof key!=='string'||!key.trim()||/[\r\n]/.test(key))throw new Error('API key must be a nonempty single-line value.');
    if(process.platform!=='win32'&&!this.safeStorage.isEncryptionAvailable())throw new Error('Windows credential encryption is unavailable.');
    await fs.mkdir(this.directory,{recursive:true});
    const encrypted=process.platform==='win32'?await encryptWindowsSecret(key):this.safeStorage.encryptString(key);
    await fs.writeFile(path.join(this.directory,id+'.key'),encrypted,{mode:0o600});
  }
  async secret(id) {
    const value=await fs.readFile(path.join(this.directory,id+'.key'));
    if(isWindowsSecret(value))return decryptWindowsSecret(value);
    const key=this.safeStorage.decryptString(value);
    if(process.platform==='win32')await this.setSecret(id,key);
    return key;
  }
  async deleteSecret(id) {await fs.rm(path.join(this.directory,id+'.key'),{force:true});}
}
