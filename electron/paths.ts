import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
// Executables must run outside ASAR on both Windows and macOS.
export const externalBinary = (path:string) => path.replace(/app\.asar(?=[\\/])/g,'app.asar.unpacked');
export function moduleDir(fromFile:string, name:string) {
 let dir=dirname(fromFile);
 while(true){
  const candidate=join(dir,'node_modules',name);
  if(existsSync(join(candidate,'package.json'))) return candidate;
  const parent=dirname(dir);
  if(parent===dir) break;
  dir=parent;
 }
 throw new Error(`Не найден пакет ${name}`);
}
export function ortWasmDir(fromFile:string) {
 const nested=join(moduleDir(fromFile,'onnx-asr-web'),'node_modules','onnxruntime-web','dist');
 if(existsSync(join(nested,'ort-wasm-simd-threaded.wasm'))) return externalBinary(nested);
 return externalBinary(join(moduleDir(fromFile,'onnxruntime-web'),'dist'));
}
