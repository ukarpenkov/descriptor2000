import { contextBridge, ipcRenderer, webUtils } from 'electron';
contextBridge.exposeInMainWorld('desktop',{
 request:(path:string,body?:unknown)=>ipcRenderer.invoke('api',path,body),
 pick:()=>ipcRenderer.invoke('pick'),
 filePath:(file:File)=>webUtils.getPathForFile(file),
 copy:(text:string)=>ipcRenderer.invoke('copy',text),
 save:(text:string)=>ipcRenderer.invoke('save',text),
 version:()=>ipcRenderer.invoke('version')
});
