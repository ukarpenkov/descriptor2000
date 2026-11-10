import {test} from 'node:test';import assert from 'node:assert/strict';import {createService} from '../electron/service';import {initialStatus,pathLimit,transcript,txtName} from '../src/shared';
const job={paths:['/audio.m4a'],model:'tiny',language:'ru',speakers:2,task:'transcribe' as const};
test('API validates job and prevents arbitrary model downloads',async()=>{let calls=0;const api=createService({status:()=>initialStatus,start:()=>{calls++},download:()=>{calls++},cancel:()=>{}}); const request=(path:string,data:unknown)=>api.handle(new Request('http://localhost'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}));assert.equal((await request('/jobs',job)).status,200);assert.equal((await request('/jobs',{...job,speakers:0})).status,422);assert.equal((await request('/models',{model:'../../evil'})).status,422);assert.equal((await request('/models',{model:'gigaam'})).status,200);assert.equal((await request('/jobs',{...job,model:'gigaam',task:'translate'})).status,422);assert.equal(calls,2);});
test('busy backend returns a conflict',async()=>{const api=createService({status:()=>initialStatus,start:()=>{throw new Error('Busy')},download:()=>{},cancel:()=>{}});const r=await api.handle(new Request('http://localhost/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(job)}));assert.equal(r.status,409);});
test('transcript shows time and a known speaker without inventing one',()=>{assert.equal(transcript([{start:0,end:2,text:' Hello ',speaker:1}],1),'[00:00] Hello');assert.equal(transcript([{start:0,end:2,text:' Hello ',speaker:1}],2),'[00:00] Говорящий 1: Hello');assert.equal(transcript([{start:8,end:12,text:'Да',speaker:2}],2),'[00:08] Говорящий 2: Да');assert.equal(transcript([{start:3,end:5,text:'Привет'}],2),'[00:03] Привет');assert.equal(transcript([{start:0,end:2,text:' Hello '}],1),'[00:00] Hello');});
test('several paths keep order and a txt name stays a file name',async()=>{let seen:string[]=[];const api=createService({status:()=>initialStatus,start:body=>{seen=body.paths},download:()=>{},cancel:()=>{}});const request=(data:unknown)=>api.handle(new Request('http://localhost/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}));assert.equal((await request({...job,paths:['/a.mp4','/b.mp4']})).status,200);assert.deepEqual(seen,['/a.mp4','/b.mp4']);assert.equal((await request({...job,paths:[]})).status,422);const extra=await request({...job,paths:Array.from({length:pathLimit+1},(_,i)=>`/v${i}.mp4`)});assert.equal(extra.status,422);assert.equal((await extra.json()).error,'Слишком много файлов');assert.equal(txtName('/films/interview.final.mp4'),'interview.final.txt');assert.equal(txtName(String.raw`C:\records\a<b>.wav`),'a_b_.txt');assert.equal(txtName('transcript.txt'),'transcript.txt');});

import {directoryFileUrl,externalBinary,ortWasmDir} from '../electron/paths';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
test('packaged executable paths work with Windows and macOS separators',()=>{
 assert.equal(externalBinary('/Applications/Descriptor2000.app/Contents/Resources/app.asar/node_modules/ffmpeg-static/ffmpeg'),'/Applications/Descriptor2000.app/Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg');
 assert.equal(externalBinary(String.raw`C:\Program Files\Descriptor2000\resources\app.asar\node_modules\ffmpeg-static\ffmpeg.exe`),String.raw`C:\Program Files\Descriptor2000\resources\app.asar.unpacked\node_modules\ffmpeg-static\ffmpeg.exe`);
 assert.equal(externalBinary('/dev/node_modules/ffmpeg-static/ffmpeg'),'/dev/node_modules/ffmpeg-static/ffmpeg');
 assert.match(ortWasmDir(join(process.cwd(),'dist-electron/worker.cjs')),/onnxruntime-web[\\/]dist$/);
});
test('wasm directory is a file URL so Windows does not import protocol c:',async()=>{
 const dir=ortWasmDir(join(process.cwd(),'dist-electron/worker.cjs'));
 const prefix=directoryFileUrl(dir);
 assert.equal(prefix,`${pathToFileURL(dir).href}/`);
 const moduleUrl=new URL('ort-wasm-simd-threaded.mjs',prefix);
 const wasmUrl=new URL('ort-wasm-simd-threaded.wasm',prefix);
 assert.equal(moduleUrl.protocol,'file:');
 assert.equal(fileURLToPath(moduleUrl),join(dir,'ort-wasm-simd-threaded.mjs'));
 assert.equal(existsSync(fileURLToPath(wasmUrl)),true);
 const spaced=directoryFileUrl(join(tmpdir(),'Program Files','onnxruntime-web','dist'));
 assert.match(spaced,/Program%20Files\/onnxruntime-web\/dist\/$/);
 assert.equal(spaced.includes('%2520'),false);
 assert.equal(new URL('ort-wasm-simd-threaded.wasm',spaced).href,`${spaced}ort-wasm-simd-threaded.wasm`);
 const windowsPath=String.raw`C:\Program Files\Descriptor2000\resources\app.asar.unpacked\node_modules\onnxruntime-web\dist`+'\\';
 assert.throws(()=>new URL('ort-wasm-simd-threaded.mjs',windowsPath));
 const windowsUrl='file:///C:/Program%20Files/Descriptor2000/resources/app.asar.unpacked/node_modules/onnxruntime-web/dist/';
 assert.equal(new URL('ort-wasm-simd-threaded.mjs',windowsUrl).protocol,'file:');
 const loaded=await import(moduleUrl.href);
 assert.equal(typeof loaded.default,'function');
});
