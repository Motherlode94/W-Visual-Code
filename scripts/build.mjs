import {mkdir,copyFile,cp,readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),out=path.join(root,'dist');
await mkdir(out,{recursive:true});
await copyFile(path.join(root,'index.html'),path.join(out,'index.html'));
await copyFile(path.join(root,'style.css'),path.join(out,'style.css'));
await cp(path.join(root,'src'),path.join(out,'src'),{recursive:true});
for(const f of ['index.html','src/app.js','src/project.js','style.css']){const bytes=await readFile(path.join(out,f));if(!bytes.byteLength)throw Error('Fichier vide : '+f)}
console.log('W Visual Code : dist/ prêt pour Cloudflare Pages.');
