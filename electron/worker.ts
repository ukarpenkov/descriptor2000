import { parentPort, workerData } from 'node:worker_threads';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm, open, stat } from 'node:fs/promises';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { externalBinary } from './paths';
import { models, initialStatus, type Job, type Status, type Segment } from '../src/shared';
const {job,model,cache,temp}=workerData as {job?:Job;model:string;cache:string;temp:string};
let cancelled=false;let child:ChildProcess|undefined;let state:Status={...initialStatus,model};
parentPort!.on('message',()=>{cancelled=true;child?.kill();});
function update(patch:Partial<Status>){state={...state,...patch};parentPort!.postMessage(state);}
function check(){if(cancelled)throw new Error('CANCELLED');}
async function run(){
 const {pipeline,env}=await import('@huggingface/transformers');env.cacheDir=cache;
 const selected=models.find(m=>m.id===model)!;
 update({phase:'loading',message:'Подготовка модели. Первый запуск требует интернета.',percent:0});
 const asr=await pipeline('automatic-speech-recognition',selected.repo,{dtype:'q8',device:'cpu',progress_callback:(p:any)=>{if(p.status==='progress')update({percent:Math.floor(p.progress||0),message:`Модель: ${p.file} (процент текущего файла)`});}});
 check();
 if(!job){await asr.dispose();update({phase:'done',percent:100,message:'Модель скачана и готова'});return;}
 const directory=await mkdtemp(join(temp,'descriptor2000-'));const pcm=join(directory,'audio.pcm');
 try{
  update({phase:'decoding',percent:0,message:'Извлечение аудио…'});
  await new Promise<void>((resolve,reject)=>{
   if(!ffmpeg)return reject(new Error('FFmpeg отсутствует'));
   const executable=externalBinary(ffmpeg);
   let error=''; child=spawn(executable,['-nostdin','-v','error','-i',job.path,'-vn','-ac','1','-ar','16000','-f','f32le','-y',pcm],{windowsHide:true});
   child.stderr!.on('data',d=>error=(error+d).slice(-3000));child.on('error',reject);child.on('close',code=>{child=undefined;code===0?resolve():reject(new Error(error||'Не удалось прочитать аудио'));});
  });check();
  const size=(await stat(pcm)).size; if(!size)throw new Error('В файле нет аудиодорожки');
  const file=await open(pcm,'r');const segments:Segment[]=[]; const bytesPerChunk=16000*4*25;
  try{for(let position=0;position<size;position+=bytesPerChunk){check();const buffer=Buffer.alloc(Math.min(bytesPerChunk,size-position));const {bytesRead}=await file.read(buffer,0,buffer.length,position);const audio=new Float32Array(bytesRead/4);for(let i=0;i<audio.length;i++)audio[i]=buffer.readFloatLE(i*4);
   update({phase:'transcribing',percent:Math.floor(position/size*100),message:'Распознавание речи…'});
   const output=await asr(audio,{...(job.language==='auto'?{}:{language:job.language}),task:job.task,return_timestamps:true});check();
   const result=Array.isArray(output)?output[0]:output;const offset=position/64000;
   for(const chunk of result.chunks||[{text:result.text,timestamp:[0,audio.length/16000]}]){if(chunk.text.trim())segments.push({start:offset+(chunk.timestamp[0]||0),end:offset+(chunk.timestamp[1]??audio.length/16000),text:chunk.text.trim(),...(job.speakers===1?{speaker:1}:{})});}
   update({segments:[...segments],percent:Math.floor(Math.min(position+bytesRead,size)/size*100)});
  }}finally{await file.close();}
  update({phase:'done',percent:100,message:'Расшифровка готова'});
 }finally{await rm(directory,{recursive:true,force:true});await asr.dispose();}
}
run().catch(e=>update({phase:cancelled?'cancelled':'error',message:cancelled?'Операция отменена':String(e.message)})).finally(()=>parentPort!.close());
