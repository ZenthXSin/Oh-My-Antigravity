import {spawn} from 'node:child_process';

const marker=Buffer.from('OMA_DPAPI_V1\0');
const scripts={
  protect:"[Console]::Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd()),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))",
  unprotect:"[Console]::Write([Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String([Console]::In.ReadToEnd()),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))"
};
function transform(operation,input) {
  return new Promise((resolve,reject)=>{
    const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; "+scripts[operation]],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    const chunks=[];child.stdout.on('data',chunk=>chunks.push(chunk));child.stderr.resume();
    child.on('error',reject);child.stdin.on('error',()=>{});
    child.on('close',code=>code===0?resolve(Buffer.concat(chunks).toString('utf8')):reject(new Error('Windows account could not decrypt the saved API key.')));
    child.stdin.end(input);
  });
}
export function isWindowsSecret(value){return value.subarray(0,marker.length).equals(marker);}
export async function encryptWindowsSecret(value){return Buffer.concat([marker,Buffer.from(await transform('protect',value),'base64')]);}
export async function decryptWindowsSecret(value){return transform('unprotect',value.subarray(marker.length).toString('base64'));}
