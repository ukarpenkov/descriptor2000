export const models = [
  { id:'tiny', name:'Whisper Tiny', note:'Быстрее · меньше памяти', repo:'onnx-community/whisper-tiny' },
  { id:'base', name:'Whisper Base', note:'Баланс скорости и качества', repo:'onnx-community/whisper-base' },
  { id:'small', name:'Whisper Small', note:'Точнее · больше памяти', repo:'onnx-community/whisper-small' }
] as const;
export const languages = [{id:'auto',label:'Автоматически'}, {id:'ru',label:'Русский'}, {id:'en',label:'English'}, {id:'es',label:'Español'}, {id:'fr',label:'Français'}, {id:'de',label:'Deutsch'}];
export type Segment = {start:number; end:number; text:string; speaker?:number};
export type Status = {phase:'idle'|'loading'|'decoding'|'transcribing'|'done'|'cancelled'|'error'; percent:number; message:string; segments:Segment[]; model?:string};
export type Job = {path:string; model:string; language:string; speakers:number; task:'transcribe'|'translate'};
export const initialStatus:Status = {phase:'idle',percent:0,message:'Готов к работе',segments:[]};
export const formatTime = (seconds:number) => { const s=Math.floor(seconds); return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`; };
export const transcript = (segments:Segment[], speakers:number) => segments.map(s=>`${speakers>1 ? `[${formatTime(s.start)}] ${s.speaker ? `Говорящий ${s.speaker}` : 'Говорящий не назначен'}: ` : ''}${s.text.trim()}`).join('\n\n');
