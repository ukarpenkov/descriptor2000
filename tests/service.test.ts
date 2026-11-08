import {test} from 'node:test';import assert from 'node:assert/strict';import {createService} from '../electron/service';import {initialStatus,transcript} from '../src/shared';
const job={path:'/audio.m4a',model:'tiny',language:'ru',speakers:2,task:'transcribe'};
test('API validates job and prevents arbitrary model downloads',async()=>{let calls=0;const api=createService({status:()=>initialStatus,start:()=>{calls++},download:()=>{calls++},cancel:()=>{}}); const request=(path:string,data:unknown)=>api.handle(new Request('http://localhost'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}));assert.equal((await request('/jobs',job)).status,200);assert.equal((await request('/jobs',{...job,speakers:0})).status,422);assert.equal((await request('/models',{model:'../../evil'})).status,422);assert.equal((await request('/models',{model:'gigaam'})).status,200);assert.equal((await request('/jobs',{...job,model:'gigaam',task:'translate'})).status,422);assert.equal(calls,2);});
test('busy backend returns a conflict',async()=>{const api=createService({status:()=>initialStatus,start:()=>{throw new Error('Busy')},download:()=>{},cancel:()=>{}});const r=await api.handle(new Request('http://localhost/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(job)}));assert.equal(r.status,409);});
test('transcript shows a known speaker and time without inventing one',()=>{assert.equal(transcript([{start:0,end:2,text:' Hello ',speaker:1}],1),'[00:00] Говорящий 1: Hello');assert.equal(transcript([{start:8,end:12,text:'Да',speaker:2}],2),'[00:08] Говорящий 2: Да');assert.equal(transcript([{start:3,end:5,text:'Привет'}],2),'[00:03] Привет');assert.equal(transcript([{start:0,end:2,text:' Hello '}],1),'Hello');});

import {externalBinary,ortWasmDir} from '../electron/paths';
import {join} from 'node:path';
test('packaged executable paths work with Windows and macOS separators',()=>{
 assert.equal(externalBinary('/Applications/Descriptor2000.app/Contents/Resources/app.asar/node_modules/ffmpeg-static/ffmpeg'),'/Applications/Descriptor2000.app/Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg');
 assert.equal(externalBinary(String.raw`C:\Program Files\Descriptor2000\resources\app.asar\node_modules\ffmpeg-static\ffmpeg.exe`),String.raw`C:\Program Files\Descriptor2000\resources\app.asar.unpacked\node_modules\ffmpeg-static\ffmpeg.exe`);
 assert.equal(externalBinary('/dev/node_modules/ffmpeg-static/ffmpeg'),'/dev/node_modules/ffmpeg-static/ffmpeg');
 assert.match(ortWasmDir(join(process.cwd(),'dist-electron/worker.cjs')),/onnxruntime-web[\\/]dist$/);
});
