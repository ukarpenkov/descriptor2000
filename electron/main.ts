import { app, BrowserWindow, ipcMain, dialog, clipboard } from 'electron';
import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import { statSync, writeFileSync, mkdirSync } from 'node:fs';
import { createService } from './service';
import { initialStatus, type Status, type Job, models } from '../src/shared';
if(process.argv.includes('--smoke-test') && process.env.DESCRIPTOR_SMOKE_DATA){
 mkdirSync(process.env.DESCRIPTOR_SMOKE_DATA,{recursive:true});app.setPath('userData',process.env.DESCRIPTOR_SMOKE_DATA);
}
let window:BrowserWindow; let worker:Worker|undefined; let status:Status={...initialStatus};
function launch(data:{job?:Job; model:string}) {
 if(worker) throw new Error('Дождитесь завершения текущей операции');
 if(!models.some(m=>m.id===data.model)) throw new Error('Неизвестная модель');
 if(data.job && !statSync(data.job.path).isFile()) throw new Error('Укажите файл');
 status={...initialStatus,phase:'loading',message:'Загрузка модели…',model:data.model};
 const current=new Worker(join(__dirname,'worker.cjs'),{workerData:{...data,cache:join(app.getPath('userData'),'models'),temp:app.getPath('temp')}}); worker=current;
 current.on('message',(next:Status)=>{status=next;});
 current.on('error',e=>{status={...status,phase:'error',message:e.message};});
 current.on('exit',code=>{if(code && !['error','cancelled'].includes(status.phase)) status={...status,phase:'error',message:'Движок неожиданно остановился'}; if(worker===current)worker=undefined;});
}
const api=createService({status:()=>status,start:job=>launch({job,model:job.model}),download:model=>launch({model}),cancel:()=>worker?.postMessage('cancel')});
app.whenReady().then(()=>{
 ipcMain.handle('api',async(event,path,body)=>{
  if(event.sender!==window.webContents || !['/status','/jobs','/models','/cancel'].includes(path))throw new Error('Запрос запрещён');
  const response=await api.handle(new Request(`http://localhost${path}`,{method:body!==undefined || path==='/cancel'?'POST':'GET',headers:{'content-type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})}));
  const value=await response.json(); if(!response.ok)throw new Error(value.error || 'Некорректные параметры');return value;
 });
 ipcMain.handle('pick',async()=>{const r=await dialog.showOpenDialog(window,{properties:['openFile'],filters:[{name:'Аудио и видео',extensions:['mp4','mp3','m4a','wav','aac','amr','3gp','ogg','opus','flac','webm','mov','mkv','aiff','caf','wma']} ]});return r.canceled?'':r.filePaths[0];});
 ipcMain.handle('copy',(_,text:string)=>clipboard.writeText(text));
 ipcMain.handle('save',async(_,text:string)=>{const r=await dialog.showSaveDialog(window,{defaultPath:'transcript.txt',filters:[{name:'Текст',extensions:['txt']}]});if(!r.canceled&&r.filePath){writeFileSync(r.filePath,text,'utf8');return true;}return false;});
 window=new BrowserWindow({width:1020,height:840,minWidth:700,minHeight:620,backgroundColor:'#ffffff',webPreferences:{preload:join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 window.setMenuBarVisibility(false);window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',e=>e.preventDefault());window.loadFile(join(__dirname,'../dist/index.html')).then(async()=>{
  if(process.argv.includes('--smoke-test')){
   try{const {selfTest}=await import('./self-test');await selfTest(window);console.log('DESCRIPTOR_PACKAGED_SMOKE_OK');app.exit(0);}
   catch(error){console.error(error);app.exit(1);}
  }
 }).catch(error=>{console.error(error);if(process.argv.includes('--smoke-test'))app.exit(1);});
});
app.on('window-all-closed',()=>{worker?.postMessage('cancel');app.quit();});
app.on('before-quit',()=>worker?.postMessage('cancel'));
