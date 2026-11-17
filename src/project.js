// Project model: independent of WarLike Engine, safe browser-only persistence.
export const VERSION='warlike.visual-code.project.v1';
export const MAX_FILES=300, MAX_SOURCE=262144, MAX_PROJECT_BYTES=4*1024*1024;
export const EXTENSIONS=new Set(['wls','cs','js','mjs','ts','tsx','jsx','json','html','css','md','txt','py','cpp','c','h','hpp']);
export const languageOf=name=>({wls:'warscript',cs:'csharp',js:'javascript',mjs:'javascript',ts:'typescript',tsx:'typescript',jsx:'javascript',json:'json',html:'html',css:'css',md:'markdown',py:'python',cpp:'cpp',c:'c',h:'cpp',hpp:'cpp'})[name.split('.').pop().toLowerCase()]||'plaintext';
export function validPath(input){
 if(typeof input!=='string')throw Error('Chemin invalide.');
 const path=input.trim().replaceAll('\\','/');
 if(!path||path.length>180||path.startsWith('/')||path.includes('//')||path.includes('\0')||path.includes(':'))throw Error('Chemin non autorisé.');
 const parts=path.split('/');
 if(parts.some(p=>p==='.'||p==='..'||!p||!/^[- A-Za-z0-9_À-ÿ.]+$/.test(p)))throw Error('Nom ou dossier invalide.');
 if(!EXTENSIONS.has(path.split('.').pop().toLowerCase()))throw Error('Extension non prise en charge.');
 return path;
}
export function createProject(name='Mon projet'){
 return {schema:VERSION,name:String(name).trim().slice(0,90)||'Mon projet',files:[{path:'Scripts/PlayerController.wls',source:'public class PlayerController : MonoBehaviour {\n    [SerializeField] private float speed = 5;\n    void Start() { Log("Prêt"); }\n    void Update() { transform.Translate(speed * Time.deltaTime, 0, 0); }\n}\n'}]};
}
export function validateProject(value){
 if(!value||value.schema!==VERSION||typeof value.name!=='string'||!Array.isArray(value.files)||value.files.length>MAX_FILES)throw Error('Format de projet W Visual Code invalide.');
 const seen=new Set(),files=[];
 for(const entry of value.files){
  const path=validPath(entry?.path);
  if(typeof entry.source!=='string'||entry.source.length>MAX_SOURCE||seen.has(path.toLowerCase()))throw Error('Fichier absent, trop volumineux ou dupliqué : '+path);
  seen.add(path.toLowerCase());files.push({path,source:entry.source});
 }
 const project={schema:VERSION,name:value.name.trim().slice(0,90)||'Mon projet',files};
 if(JSON.stringify(project).length>MAX_PROJECT_BYTES)throw Error('Projet trop volumineux (4 Mo maximum).');
 return project;
}
export function addFile(project,path,source=''){
 const safe=validPath(path);if(typeof source!=='string'||source.length>MAX_SOURCE)throw Error('Fichier limité à 256 Ko.');
 if(project.files.length>=MAX_FILES)throw Error('300 fichiers maximum.');
 if(project.files.some(f=>f.path.toLowerCase()===safe.toLowerCase()))throw Error('Un fichier porte déjà ce nom.');
 project.files.push({path:safe,source});return safe;
}
export function renameFile(project,from,to){
 const safe=validPath(to),file=project.files.find(f=>f.path===from);
 if(!file)throw Error('Fichier introuvable.');
 if(project.files.some(f=>f!==file&&f.path.toLowerCase()===safe.toLowerCase()))throw Error('Nom déjà utilisé.');
 file.path=safe;return safe;
}
export function isValidEngineOrigin(value){
 try{const url=new URL(value);return url.origin===value&&url.username===''&&url.password===''&&(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))}catch{return false}
}
export const ENGINE_ORIGIN='https://warlike-engine.pages.dev';
export const MAX_BRIDGE_PAYLOAD=MAX_SOURCE;
export function outgoingFile(file){
 if(!file||!['warscript','csharp','javascript','typescript'].includes(languageOf(file.path)))throw Error('Ce type de script ne peut pas être envoyé à Engine.');
 return {path:validPath(file.path),source:String(file.source).slice(0,MAX_BRIDGE_PAYLOAD),language:languageOf(file.path)};
}
