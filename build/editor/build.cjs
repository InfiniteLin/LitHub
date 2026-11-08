const {build}=require('esbuild');
const fs=require('node:fs');
(async()=>{
 await build({entryPoints:['build/editor/index.js'],bundle:true,format:'esm',splitting:true,minify:true,target:'chrome120',outdir:'frontend/vendor/muya',assetNames:'assets/[name]-[hash]',loader:{'.png':'dataurl','.jpg':'dataurl','.svg':'dataurl','.woff':'file','.woff2':'file','.ttf':'file'},legalComments:'linked'});
 fs.copyFileSync('node_modules/@muyajs/core/LICENSE','frontend/vendor/muya/LICENSE');
 fs.writeFileSync('frontend/vendor/muya/NOTICE.txt','Muya @muyajs/core 0.2.0 (MIT), https://github.com/marktext/marktext\nBuilt with build/editor/build.cjs. Third-party license notices are included alongside bundled scripts.\n');
})().catch(e=>{console.error(e);process.exit(1)});
