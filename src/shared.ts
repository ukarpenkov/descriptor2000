export const models = [
  { id:'gigaam', name:'GigaAM', note:'Русская речь · около 230 МБ', repo:'istupakov/gigaam-v3-onnx', engine:'gigaam' },
  { id:'tiny', name:'Whisper Tiny', note:'Быстрее · меньше памяти', repo:'onnx-community/whisper-tiny', engine:'whisper' },
  { id:'base', name:'Whisper Base', note:'Баланс скорости и качества', repo:'onnx-community/whisper-base', engine:'whisper' },
  { id:'small', name:'Whisper Small', note:'Точнее · больше памяти', repo:'onnx-community/whisper-small', engine:'whisper' }
] as const;
export const languages = [{id:'auto',label:'Автоматически'}, {id:'ru',label:'Русский'}, {id:'en',label:'English'}, {id:'es',label:'Español'}, {id:'fr',label:'Français'}, {id:'de',label:'Deutsch'}];
export const pathLimit = 30;
export type Segment = {start:number; end:number; text:string; speaker?:number};
export type FileTranscript = {path:string; segments:Segment[]};
export type Status = {phase:'idle'|'loading'|'decoding'|'transcribing'|'done'|'cancelled'|'error'; percent:number; message:string; segments:Segment[]; results:FileTranscript[]; model?:string; file?:string; index?:number; total?:number};
export type Job = {paths:string[]; model:string; language:string; speakers:number; task:'transcribe'|'translate'};
export const initialStatus:Status = {phase:'idle',percent:0,message:'Готов к работе',segments:[],results:[]};
export const formatTime = (seconds:number) => { const s=Math.floor(seconds); return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`; };
export function txtName(filePath:string) {
 const base=(filePath.split(/[\\/]/).pop()||'transcript').replace(/\.txt$/i,'');
 const stem=base.replace(/\.[^.]+$/,'')||'transcript';
 const clean=stem.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/^\.+/,'').slice(0,80)||'transcript';
 return `${clean}.txt`;
}
export const transcript = (segments:Segment[], speakers:number) => segments.map(s=>{
 const body=s.text.trim();
 const time=`[${formatTime(s.start)}]`;
 if(speakers>1 && s.speaker) return `${time} Говорящий ${s.speaker}: ${body}`;
 return `${time} ${body}`;
}).join('\n\n');
export function gigaamLimit(model:string, language:string, task:string) {
 const selected=models.find(m=>m.id===model);
 if(selected?.engine==='gigaam' && (task!=='transcribe' || (language!=='ru' && language!=='auto'))) return 'GigaAM распознаёт только русскую речь и не переводит на другой язык.';
 return '';
}
