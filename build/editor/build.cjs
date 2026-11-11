const {build}=require('esbuild');
const fs=require('node:fs');
const path=require('node:path');
// Extend the pinned Muya parser itself so load, paste and read mode share the
// same grammar. A display formula may have its delimiters on the same line.
const displayMath={name:'lithub-display-math',setup(builder){
 builder.onLoad({filter:/@muyajs[\\/]core[\\/]lib[\\/]es[\\/]index\.js$/},async({path})=>{
  const source=fs.readFileSync(path,'utf8');
  const original=String.raw`/^(\${1,2})\n((?:\\[\s\S]|[^\\])+?)\n\1(?:\n|$)/`;
  const replacement=String.raw`/^(\$\$)(?!\$)[ \t]*\n?((?:\\[\s\S]|(?!\$\$)[^\\])+?)\1[ \t]*(?:\n|$)/`;
  if(source.split(original).length!==2)throw Error('Muya math parser changed; review the display-math integration');
  return {contents:source.replace(original,replacement),loader:'js'};
 });
}};
(async()=>{
 const outdir=path.resolve('frontend/vendor/muya');
 const result=await build({entryPoints:['build/editor/index.js'],plugins:[displayMath],bundle:true,format:'esm',splitting:true,minify:true,target:'chrome120',outdir,write:false,assetNames:'assets/[name]-[hash]',loader:{'.png':'dataurl','.jpg':'dataurl','.svg':'dataurl','.woff':'file','.woff2':'file','.ttf':'file'},legalComments:'linked'});
 const outputs=new Set(result.outputFiles.map(file=>file.path));
 for(const file of result.outputFiles){fs.mkdirSync(path.dirname(file.path),{recursive:true});fs.writeFileSync(file.path,file.contents);}
 // Changing the core parser changes dependent chunk hashes too. Remove stale
 // generated files after a successful build so old bundles do not ship twice.
 function clean(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory())clean(file);
  else if(entry.isFile()&&/\.(?:js(?:\.LEGAL\.txt)?|css|woff2?|ttf)$/.test(entry.name)&&!outputs.has(file)){
   if(path.relative(outdir,file).startsWith('..'))throw Error('Editor output escaped the vendor directory');
   fs.unlinkSync(file);
  }
 }}
 clean(outdir);
 fs.copyFileSync('node_modules/@muyajs/core/LICENSE','frontend/vendor/muya/LICENSE');
 fs.writeFileSync('frontend/vendor/muya/NOTICE.txt','Muya @muyajs/core 0.2.0 (MIT), https://github.com/marktext/marktext\nBuilt with build/editor/build.cjs. Third-party license notices are included alongside bundled scripts.\n');
})().catch(e=>{console.error(e);process.exit(1)});
