import { Elysia, t } from 'elysia';
import { node } from '@elysiajs/node';
import { models, languages, gigaamLimit, type Job, type Status } from '../src/shared';
export function createService(handlers:{status:()=>Status; start:(job:Job)=>void; download:(model:string)=>void; cancel:()=>void}) {
 return new Elysia({adapter:node()})
 .get('/status',()=>handlers.status())
 .post('/jobs',({body,set})=>{const limit=gigaamLimit(body.model,body.language,body.task); if(limit){set.status=422;return {error:limit};} try {handlers.start(body); return {ok:true};} catch(e){set.status=409;return {error:String(e instanceof Error?e.message:e)};}}, {body:t.Object({path:t.String({minLength:1}),model:t.Union(models.map(m=>t.Literal(m.id))),language:t.Union(languages.map(l=>t.Literal(l.id))),speakers:t.Integer({minimum:1,maximum:12}),task:t.Union([t.Literal('transcribe'),t.Literal('translate')])})})
 .post('/models',({body,set})=>{try{handlers.download(body.model);return {ok:true};}catch(e){set.status=409;return {error:String(e)};}},{body:t.Object({model:t.Union(models.map(m=>t.Literal(m.id)))})})
 .post('/cancel',()=>{handlers.cancel();return {ok:true};});
}
