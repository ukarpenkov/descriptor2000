import { parentPort, workerData } from 'node:worker_threads';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm, open, stat } from 'node:fs/promises';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { directoryFileUrl, externalBinary, ortWasmDir } from './paths';
import { models, initialStatus, gigaamLimit, type Job, type Status, type Segment } from '../src/shared';
const {job,model,cache,temp}=workerData as {job?:Job;model:string;cache:string;temp:string};
let cancelled=false;let child:ChildProcess|undefined;let state:Status={...initialStatus,model};
parentPort!.on('message',()=>{cancelled=true;child?.kill();});
function update(patch:Partial<Status>){state={...state,...patch};parentPort!.postMessage(state);}
function check(){if(cancelled)throw new Error('CANCELLED');}
function fileName(input:RequestInfo|URL){const href=typeof input==='string'?input:input instanceof URL?input.href:input.url;return decodeURIComponent(href.split('/').pop()||'файл');}
function trackingFetch():typeof fetch{return async(input,init)=>{check();const response=await fetch(input,init);if(!response.ok||!response.body)return response;const total=Number(response.headers.get('content-length')||0);const reader=response.body.getReader();const parts:Uint8Array[]=[];let loaded=0;const file=fileName(input);
 while(true){check();const {done,value}=await reader.read();if(done)break;parts.push(value);loaded+=value.byteLength;const percent=total?Math.min(99,Math.floor(loaded/total*100)):0;update({phase:'loading',percent,message:`Модель: ${file}${total?` ${percent}%`:''}`});}
 return new Response(Buffer.concat(parts),{status:response.status,statusText:response.statusText,headers:response.headers});};}
type Piece={text:string;start:number;end:number};
async function loadEngine(repo:string, engine:'whisper'|'gigaam'):Promise<(audio:Float32Array)=>Promise<Piece[]>>{
 if(engine==='gigaam'){
  const {configureOrtWeb,loadHuggingfaceModel}=await import('onnx-asr-web/node');
  configureOrtWeb({wasmPaths:directoryFileUrl(ortWasmDir(__filename)),numThreads:1});
  update({phase:'loading',message:'Подготовка GigaAM…',percent:0});
  const asr=await loadHuggingfaceModel(repo,{cacheDir:cache,quantization:'int8',fetch:trackingFetch()});
  return async audio=>{const result=await asr.transcribeSamples(audio,16000);const text=result.text.trim();return text?[{text,start:0,end:audio.length/16000}]:[];};
 }
 const {pipeline,env}=await import('@huggingface/transformers');env.cacheDir=cache;
 update({phase:'loading',message:'Подготовка модели…',percent:0});
 const asr=await pipeline('automatic-speech-recognition',repo,{dtype:'q8',device:'cpu',progress_callback:(p:any)=>{if(p.status==='progress')update({percent:Math.floor(p.progress||0),message:`Модель: ${p.file} (процент текущего файла)`});}});
 return async audio=>{
  const output=await asr(audio,{...(job?.language==='auto'?{}:{language:job?.language}),task:job?.task||'transcribe',return_timestamps:true});
  const result=Array.isArray(output)?output[0]:output;
  return (result.chunks||[{text:result.text,timestamp:[0,audio.length/16000]}]).filter((chunk:any)=>chunk.text.trim()).map((chunk:any)=>({text:chunk.text.trim(),start:chunk.timestamp[0]||0,end:chunk.timestamp[1]??audio.length/16000}));
 };
}
function baseName(input:string){return input.split(/[\\/]/).pop()||input;}
async function transcribeFile(transcribe:(audio:Float32Array)=>Promise<Piece[]>, input:string, index:number, total:number){
 const directory=await mkdtemp(join(temp,'descriptor2000-'));const pcm=join(directory,'audio.pcm');
 const prefix=total>1?`${index+1} из ${total} · ${baseName(input)} · `:'';
 const span=(inner:number)=>Math.floor((index+inner/100)/total*100);
 try{
  update({phase:'decoding',percent:span(0),message:`${prefix}Извлечение аудио…`,file:input,index,total});
  await new Promise<void>((resolve,reject)=>{
   if(!ffmpeg)return reject(new Error('FFmpeg отсутствует'));
   const executable=externalBinary(ffmpeg);
   let error=''; child=spawn(executable,['-nostdin','-v','error','-i',input,'-vn','-ac','1','-ar','16000','-f','f32le','-y',pcm],{windowsHide:true});
   child.stderr!.on('data',d=>error=(error+d).slice(-3000));child.on('error',reject);child.on('close',code=>{child=undefined;code===0?resolve():reject(new Error(error||'Не удалось прочитать аудио'));});
  });check();
  const size=(await stat(pcm)).size; if(!size)throw new Error('В файле нет аудиодорожки');
  const file=await open(pcm,'r');const segments:Segment[]=[]; const bytesPerChunk=16000*4*25;
  try{for(let position=0;position<size;position+=bytesPerChunk){check();const buffer=Buffer.alloc(Math.min(bytesPerChunk,size-position));const {bytesRead}=await file.read(buffer,0,buffer.length,position);const audio=new Float32Array(bytesRead/4);for(let i=0;i<audio.length;i++)audio[i]=buffer.readFloatLE(i*4);
   update({phase:'transcribing',percent:span(Math.floor(position/size*100)),message:`${prefix}Распознавание речи…`,file:input,index,total});
   const offset=position/64000; const pieces=await transcribe(audio);check();
   for(const piece of pieces)segments.push({start:offset+piece.start,end:offset+piece.end,text:piece.text,...(job!.speakers===1?{speaker:1}:{})});
   update({segments:[...segments],percent:span(Math.floor(Math.min(position+bytesRead,size)/size*100))});
  }}finally{await file.close();}
  update({results:[...state.results,{path:input,segments}],segments:[],percent:span(100),file:input,index,total});
 }finally{await rm(directory,{recursive:true,force:true});}
}
async function run(){
 const selected=models.find(m=>m.id===model)!;
 if(job){const limit=gigaamLimit(model,job.language,job.task);if(limit)throw new Error(limit);}
 const transcribe=await loadEngine(selected.repo,selected.engine);check();
 if(!job){update({phase:'done',percent:100,message:'Модель скачана и готова'});return;}
 for(let index=0;index<job.paths.length;index++){
  check();
  try{await transcribeFile(transcribe,job.paths[index],index,job.paths.length);}
  catch(e){if(cancelled||(e instanceof Error&&e.message==='CANCELLED'))throw e;const message=e instanceof Error?e.message:String(e);throw new Error(job.paths.length>1?`${baseName(job.paths[index])}: ${message}`:message);}
 }
 update({phase:'done',percent:100,message:'Расшифровка готова',segments:[]});
}
run().catch(e=>update({phase:cancelled?'cancelled':'error',message:cancelled?'Операция отменена':String(e.message)})).finally(()=>parentPort!.close());
