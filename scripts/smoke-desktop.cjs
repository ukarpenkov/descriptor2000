const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');const path=require('node:path');
app.setPath('userData',path.join(app.getPath('temp'),'descriptor2000-ui-smoke'));
require(process.env.DESCRIPTOR_APP ? path.resolve(process.env.DESCRIPTOR_APP,'dist-electron/main.cjs') : '../dist-electron/main.cjs');
if(process.env.DESCRIPTOR_APP){
 const ffmpeg=require(path.resolve(process.env.DESCRIPTOR_APP,'node_modules/ffmpeg-static'));
 const executable=ffmpeg.replace(/app\.asar(?=[\\/])/g,'app.asar.unpacked');
 const check=require('node:child_process').spawnSync(executable,['-version'],{windowsHide:true});
 if(check.status!==0){console.error('Packaged FFmpeg failed',check.error,check.stderr?.toString());app.exit(1);}
 console.log('Packaged FFmpeg passed');
}
const timeout=setTimeout(()=>{console.error('Desktop timeout');app.exit(1);},120000);
app.whenReady().then(async()=>{
 try{
  const win=BrowserWindow.getAllWindows()[0];
  if(win.webContents.isLoading())await new Promise(resolve=>win.webContents.once('did-finish-load',resolve));
  await new Promise(resolve=>setTimeout(resolve,800));
  const result=await win.webContents.executeJavaScript(`(async()=>{const bridge=await window.desktop.request('/status');return {text:document.body.innerText,bridge,controls:document.querySelectorAll('button').length};})()`);
  if(!result.text.includes('01. Запись')||result.bridge.phase!=='idle'||result.controls<5)throw new Error(JSON.stringify(result));
  if(process.env.DESCRIPTOR_FIXTURE){
   const job={path:path.resolve(process.env.DESCRIPTOR_FIXTURE),model:'tiny',language:'en',speakers:1,task:'transcribe'};
   await win.webContents.executeJavaScript(`window.desktop.request('/jobs',${JSON.stringify(job)})`);
   let status;
   do{await new Promise(resolve=>setTimeout(resolve,200));status=await win.webContents.executeJavaScript("window.desktop.request('/status')");}while(['loading','decoding','transcribing'].includes(status.phase));
   if(status.phase!=='done'||!status.segments.length)throw new Error(JSON.stringify(status));
   console.log('Packaged ASR passed:',status.segments.map(s=>s.text).join(' '));
  }
  const screen=await win.webContents.capturePage();if(process.env.DESCRIPTOR_SCREENSHOT)fs.writeFileSync(process.env.DESCRIPTOR_SCREENSHOT,screen.toPNG());
  console.log('Desktop UI and Elysia IPC passed');clearTimeout(timeout);app.exit(0);
 }catch(e){console.error(e);clearTimeout(timeout);app.exit(1);}
});
