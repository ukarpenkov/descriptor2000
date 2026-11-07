import {type BrowserWindow} from 'electron';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import ffmpeg from 'ffmpeg-static';
import {externalBinary} from './paths';
export async function selfTest(window:BrowserWindow){
 if(!ffmpeg)throw new Error('FFmpeg missing');
 execFileSync(externalBinary(ffmpeg),['-version'],{windowsHide:true,timeout:10000});
 const state=await window.webContents.executeJavaScript(`(async()=>({status:await window.desktop.request('/status'),text:document.body.innerText}))()`);
 if(state.status.phase!=='idle'||!state.text.includes('01. Запись'))throw new Error('Renderer or IPC unavailable');
 if(process.env.DESCRIPTOR_FIXTURE){
  const job={path:process.env.DESCRIPTOR_FIXTURE,model:'tiny',language:'en',speakers:1,task:'transcribe'};
  await window.webContents.executeJavaScript(`window.desktop.request('/jobs',${JSON.stringify(job)})`);
  let status;
  do{await new Promise(resolve=>setTimeout(resolve,200));status=await window.webContents.executeJavaScript("window.desktop.request('/status')");}while(['loading','decoding','transcribing'].includes(status.phase));
  if(status.phase!=='done'||!status.segments.length)throw new Error(JSON.stringify(status));
  console.log('Packaged ASR:',JSON.stringify(status.segments));
 }
 if(process.env.DESCRIPTOR_SCREENSHOT)writeFileSync(process.env.DESCRIPTOR_SCREENSHOT,(await window.webContents.capturePage()).toPNG());
}
