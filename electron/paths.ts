// Executables must run outside ASAR on both Windows and macOS.
export const externalBinary = (path:string) => path.replace(/app\.asar(?=[\\/])/g,'app.asar.unpacked');
