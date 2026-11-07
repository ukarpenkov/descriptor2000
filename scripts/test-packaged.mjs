import {mkdtemp,cp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
// Run the bundle's own Electron in a temporary directory outside the checkout.
// Loading app.asar in the development Electron can mask missing dependencies.
const source=process.argv[2] ? resolve(process.argv[2]) : process.platform==='darwin'
 ? join(resolve('release'),(await readdir('release')).find(name=>name.startsWith('mac')),'Descriptor2000.app')
 : resolve('release/win-unpacked');
const isolated=await mkdtemp(join(tmpdir(),'descriptor2000-package-'));
const bundle=join(isolated,process.platform==='darwin'?'Descriptor2000.app':'application');
try{
 await cp(source,bundle,{recursive:true,verbatimSymlinks:true});
 const binary=process.platform==='darwin'?join(bundle,'Contents/MacOS/Descriptor2000'):join(bundle,'Descriptor2000.exe');
 if(process.env.DESCRIPTOR_TEST_CACHE)await cp(resolve(process.env.DESCRIPTOR_TEST_CACHE),join(isolated,'data/models'),{recursive:true});
 const env={...process.env,DESCRIPTOR_SMOKE_DATA:join(isolated,'data')};delete env.NODE_PATH;delete env.NODE_OPTIONS;delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(binary,['--no-error-dialogs','--smoke-test'],{cwd:isolated,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{output=(output+data).slice(-20000);});
 const timer=setTimeout(()=>child.kill(),process.env.DESCRIPTOR_FIXTURE?300000:30000);
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);}).finally(()=>clearTimeout(timer));
 if(code!==0||!output.includes('DESCRIPTOR_PACKAGED_SMOKE_OK'))throw new Error(`Isolated application failed (${code}):\n${output}`);
 console.log(output.trim());console.log('Isolated packaged application passed');
}finally{await rm(isolated,{recursive:true,force:true,maxRetries:5,retryDelay:500});}
