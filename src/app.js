import {createProject,validateProject,addFile,renameFile,validPath,languageOf,MAX_PROJECT_BYTES,MAX_SOURCE,ENGINE_ORIGIN,isValidEngineOrigin,outgoingFile} from './project.js';
const $=id=>document.getElementById(id),KEY='warlike.visual-code.workspace.v1';
let project,active='',openTabs=[],dirty=new Set(),monaco=null,codeEditor=null,models=new Map(),engineWindow=null,engineOrigin='',connectionId='',connected=false,ready=false,lastRequest='',batchQueue=[],batchTotal=0,batchSent=0,ackTimer=null;
const file=()=>project.files.find(f=>f.path===active);
const text=()=>codeEditor?codeEditor.getValue():$('codeInput').value;
const setStatus=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('status-error',error)};
const log=message=>{const row=document.createElement('div');row.textContent=new Date().toLocaleTimeString('fr')+' · '+message;$('output').prepend(row);while($('output').childElementCount>80)$('output').lastElementChild.remove()};
const nameButton=(name,action,cls='')=>{const b=document.createElement('button');b.type='button';b.textContent=name;b.className=cls;b.addEventListener('click',action);return b};
function store(){try{localStorage.setItem(KEY,JSON.stringify({project,active,openTabs}));dirty.clear();setStatus('✓ Projet enregistré dans ce navigateur');render()}catch(e){setStatus('Stockage indisponible : exporte le projet pour ne rien perdre.',true);log(e.message)}}
function load(){
 try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);project=validateProject(parsed.project);active=project.files.some(f=>f.path===parsed.active)?parsed.active:project.files[0]?.path||'';openTabs=(parsed.openTabs||[]).filter(p=>project.files.some(f=>f.path===p));return}}catch(e){log('Brouillon local non restauré : '+e.message)}
 project=createProject();active=project.files[0].path;openTabs=[active];
}
function updateActive(){const f=file();if(!f)return;const value=text();if(value.length>MAX_SOURCE){setStatus('Fichier limité à 256 Ko. Supprime du texte avant de sauvegarder.',true);return}f.source=value;dirty.add(f.path);updateOutline();updatePosition()}
function setText(value){if(codeEditor){codeEditor.setValue(value)}else{$('codeInput').value=value;updateNumbers()}}
function editorLanguage(path){const lang=languageOf(path);return ({warscript:'csharp',csharp:'csharp',cpp:'cpp',python:'python',javascript:'javascript',typescript:'typescript',json:'json',html:'html',css:'css',markdown:'markdown'})[lang]||'plaintext'}
function activate(path){if(!project.files.some(f=>f.path===path))return;
 active=path;if(!openTabs.includes(path))openTabs.push(path);
 const f=file();if(codeEditor){let model=models.get(path);if(!model){model=monaco.editor.createModel(f.source,editorLanguage(path));models.set(path,model)}codeEditor.setModel(model);}else setText(f.source);
 $('filepath').textContent=path;$('language').textContent=languageOf(path);render();updateOutline();updatePosition();storeSession();
}
function storeSession(){try{localStorage.setItem(KEY,JSON.stringify({project,active,openTabs}))}catch{}}
function render(){
 $('projectName').value=project.name;$('fileCount').textContent=project.files.length+' fichier(s)';
 const filter=$('fileSearch').value.trim().toLowerCase();const list=$('fileTree');list.replaceChildren();
 for(const f of project.files){if(filter&&!f.path.toLowerCase().includes(filter)&&!f.source.toLowerCase().includes(filter))continue;
  const b=nameButton((dirty.has(f.path)?'● ':'')+f.path,()=>activate(f.path),'file-item'+(f.path===active?' active':''));b.title=f.path;list.append(b);
 }
 const tabs=$('tabs');tabs.replaceChildren();
 for(const path of openTabs.filter(p=>project.files.some(f=>f.path===p))){
  const b=nameButton((dirty.has(path)?'● ':'')+path.split('/').at(-1),()=>activate(path),'tab'+(path===active?' active':''));b.setAttribute('role','tab');b.setAttribute('aria-selected',String(path===active));tabs.append(b);
 }
 $('sendEngine').disabled=!connected||!file()||!['warscript','csharp','javascript','typescript'].includes(languageOf(active));
 $('sendProject').disabled=!connected||!project.files.some(f=>['warscript','csharp','javascript','typescript'].includes(languageOf(f.path)));
}
function updateNumbers(){const t=$('codeInput'),lines=t.value.split('\n').length;$('lineNumbers').textContent=Array.from({length:Math.min(lines,10000)},(_,i)=>i+1).join('\n');$('lineNumbers').scrollTop=t.scrollTop}
function updatePosition(){
 const value=text(),index=codeEditor?codeEditor.getPosition()?.column:($('codeInput').selectionStart??0);
 if(codeEditor){const pos=codeEditor.getPosition();$('cursor').textContent='Ln '+(pos?.lineNumber||1)+', Col '+(pos?.column||1);return}
 const before=value.slice(0,index),lines=before.split('\n');$('cursor').textContent='Ln '+lines.length+', Col '+(lines.at(-1)?.length+1||1);
}
function updateOutline(){
 const f=file(),target=$('outline');target.replaceChildren();if(!f)return;
 const re=/^\s*(?:(?:public|private|protected|static|async|void|int|float|bool|string|class|function|export)\s+)*(?:class\s+)?([A-Za-z_]\w*)\s*(?:\([^\n]*\))?\s*(?:\{|:)/gm;
 let match,count=0;
 for(;count<80&&(match=re.exec(f.source));count++){const line=f.source.slice(0,match.index).split('\n').length;target.append(nameButton('◇ '+match[1]+' · '+line,()=>gotoLine(line)))}
 if(!count)target.textContent='Aucun symbole détecté.';
}
function gotoLine(line){if(codeEditor){codeEditor.revealLineInCenter(line);codeEditor.setPosition({lineNumber:line,column:1});codeEditor.focus()}else{const t=$('codeInput');t.focus();const position=t.value.split('\n').slice(0,line-1).join('\n').length+(line>1?1:0);t.setSelectionRange(position,position);t.scrollTop=(line-1)*22}}
function newFile(){const input=prompt('Nom du nouveau script (dossier/nom.ext) :','Scripts/Nouveau.wls');if(input===null)return;try{const path=addFile(project,input,'');activate(path);store()}catch(e){setStatus(e.message,true)}}
function renameActive(){if(!file())return;const to=prompt('Nouveau nom :',active);if(to===null)return;try{const old=active,updated=renameFile(project,old,to);openTabs=openTabs.map(p=>p===old?updated:p);models.get(old)?.dispose();models.delete(old);dirty.delete(old);activate(updated);store()}catch(e){setStatus(e.message,true)}}
function deleteActive(){if(!file()||!confirm('Supprimer '+active+' de ce projet ?'))return;const old=active;project.files=project.files.filter(f=>f.path!==old);openTabs=openTabs.filter(p=>p!==old);dirty.delete(old);models.get(old)?.dispose();models.delete(old);active=project.files[0]?.path||'';if(active)activate(active);else{setText('');render()}store()}
function download(name,content,mime='text/plain'){const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportProject(){try{const payload=validateProject(project);download((project.name.replace(/[^a-z0-9_-]/gi,'_')||'warlike')+'.wvc.json',JSON.stringify(payload,null,2),'application/json');setStatus('Projet exporté (fichier JSON)')}catch(e){setStatus(e.message,true)}}
async function importProject(ev){const input=ev.target.files?.[0];ev.target.value='';if(!input)return;try{if(input.size>MAX_PROJECT_BYTES)throw Error('Projet trop volumineux.');const item=validateProject(JSON.parse(await input.text()));if(!confirm('Remplacer le projet actuel par « '+item.name+' » ?'))return;for(const model of models.values())model.dispose();models.clear();project=item;openTabs=[];active='';if(item.files.length)activate(item.files[0].path);else{setText('');render()}store()}catch(e){setStatus(e.message,true)}}
async function importFiles(ev){const inputs=[...(ev.target.files||[])];ev.target.value='';let count=0;for(const input of inputs){try{if(input.size>MAX_SOURCE*4)throw Error('Fichier trop volumineux.');addFile(project,input.name,await input.text());count++}catch(e){log(input.name+' : '+e.message)}}if(count){activate(project.files.at(-1).path);store()}setStatus(count+' fichier(s) importé(s)')}
function diagnostics(){
 const f=file();if(!f)return;const value=f.source,problems=[];
 if(languageOf(f.path)==='json'){try{JSON.parse(value)}catch(e){problems.push('JSON : '+e.message)}}
 if(['warscript','csharp','javascript','typescript'].includes(languageOf(f.path))){
  const stack=[];let quote='',line=1,comment=false,block=false;
  for(let i=0;i<value.length;i++){
   const c=value[i],n=value[i+1];if(c==='\n'){line++;comment=false;if(quote==='\n')quote='';continue}
   if(comment)continue;if(block){if(c==='*'&&n==='/'){block=false;i++}continue}
   if(quote){if(c==='\\'){i++;continue}if(c===quote)quote='';continue}
   if(c==='/'&&n==='/'){comment=true;i++;continue}if(c==='/'&&n==='*'){block=true;i++;continue}
   if(['"',"'",'`'].includes(c)){quote=c;continue}
   if('([{'.includes(c))stack.push({c,line});
   else if(')]}'.includes(c)){const last=stack.pop();if(!last||'([{'.indexOf(last.c)!==')]}'.indexOf(c))problems.push('Ligne '+line+' : délimiteur '+c+' inattendu.')}
  }
  if(block)problems.push('Commentaire non terminé.');
  if(quote)problems.push('Chaîne non terminée.');
  for(const item of stack.slice(-8))problems.push('Ligne '+item.line+' : délimiteur '+item.c+' non fermé.');
 }
 $('problemCount').textContent=problems.length;$('problems').textContent=problems.length?problems.join('\n'):'Aucun problème structurel détecté. Ceci n’est pas une compilation complète.';selectPanel(false);setStatus('Analyse syntaxique légère terminée. La compilation WarScript/C# complète se fait dans Engine.');log('Analyse '+f.path+' : '+problems.length+' problème(s)')}
function selectPanel(output){$('problems').hidden=output;$('output').hidden=!output;$('problemsTab').classList.toggle('active',!output);$('outputTab').classList.toggle('active',output)}
function disconnect(message='Déconnecté d’Engine'){if(ackTimer)clearTimeout(ackTimer);ackTimer=null;connected=false;ready=false;engineWindow=null;connectionId='';batchQueue=[];batchSent=0;batchTotal=0;$('linkState').textContent='● Hors connexion Engine';$('sendEngine').disabled=true;$('sendProject').disabled=true;setStatus(message)}
function startConnection(){const value=$('engineOrigin').value.trim();if(!isValidEngineOrigin(value)){setStatus('Origine Engine invalide : HTTPS requis (ou localhost).',true);return}
 if(!confirm('Ouvrir '+value+' et demander une connexion facultative ?'))return;
 engineOrigin=value;connectionId=crypto.randomUUID();ready=false;connected=false;
 const url=new URL('/script-editor/index.html',value);url.searchParams.set('wvcOrigin',location.origin);
 engineWindow=window.open(url.href,'warlike-engine-script-studio');
 if(!engineWindow){disconnect('Autorise les fenêtres pour connecter Engine.');return}
 $('linkState').textContent='◌ Autorisation attendue dans Engine';setStatus('Valide la demande de connexion dans l’onglet Engine.')}
window.addEventListener('message',event=>{
 if(!engineWindow||event.source!==engineWindow||event.origin!==engineOrigin||!event.data||typeof event.data!=='object')return;
 const msg=event.data;
 if(msg.type==='wvc:ready'&&typeof msg.protocol==='number'&&msg.protocol===1){ready=true;engineWindow.postMessage({type:'wvc:hello',protocol:1,session:connectionId},engineOrigin);}
 else if(msg.type==='wvc:connected'&&msg.session===connectionId){connected=true;$('linkState').textContent='● Lié à Engine (manuel)';setStatus('Connexion autorisée : envoie seulement les scripts que tu choisis.');render()}
 else if(msg.type==='wvc:ack'&&connected&&msg.session===connectionId&&msg.requestId===lastRequest){if(ackTimer)clearTimeout(ackTimer);ackTimer=null;setStatus(msg.ok?'✓ Fichier reçu dans Script Studio Engine':'Engine a refusé : '+(msg.error||'erreur inconnue'),!msg.ok);log('Engine : '+(msg.ok?'script reçu':'refus : '+msg.error));if(batchTotal){if(msg.ok){batchSent++;sendNextFromBatch()}else{batchQueue=[];setStatus('Transfert arrêté après '+batchSent+' / '+batchTotal+' scripts : '+(msg.error||'refus'),true);batchTotal=0}}}
 else if(msg.type==='wvc:disconnect'&&msg.session===connectionId)disconnect('Engine a terminé la session.');
});
function pushSource(f){
 if(!connected||!engineWindow||engineWindow.closed){disconnect();return false}
 const data=outgoingFile(f);lastRequest=crypto.randomUUID();
 engineWindow.postMessage({type:'wvc:push',protocol:1,session:connectionId,requestId:lastRequest,file:data},engineOrigin);
 if(ackTimer)clearTimeout(ackTimer);
 const request=lastRequest;
 ackTimer=setTimeout(()=>{
  if(request!==lastRequest)return;
  ackTimer=null;lastRequest='';batchQueue=[];batchTotal=0;
  setStatus('Engine n’a pas confirmé la réception. Vérifie sa fenêtre et réessaie.',true);
 },12000);
 return true;
}
function sendNextFromBatch(){
 if(!batchTotal)return;
 if(!batchQueue.length){setStatus('✓ '+batchSent+' scripts reçus par Script Studio Engine (sans exécution).');batchTotal=0;return}
 const next=batchQueue.shift();
 try{if(pushSource(next))setStatus('Transfert '+(batchSent+1)+' / '+batchTotal+' : '+next.path)}
 catch(error){batchQueue=[];batchTotal=0;setStatus('Transfert interrompu : '+error.message,true)}
}
function sendProject(){
 if(!connected){setStatus('Connecte d’abord Engine.',true);return}
 if(batchTotal){setStatus('Un transfert est déjà en cours.',true);return}
 const files=project.files.filter(f=>['warscript','csharp','javascript','typescript'].includes(languageOf(f.path)));
 if(!files.length)return;
 if(files.length>63){setStatus('63 scripts maximum par lot. Exporte le projet et sélectionne les scripts nécessaires.',true);return}
 if(!confirm('Transférer '+files.length+' scripts dans Script Studio ? Les fichiers sont ajoutés comme documents, sans exécution ni modification de scène.'))return;
 try{files.forEach(outgoingFile);batchQueue=[...files];batchTotal=files.length;batchSent=0;sendNextFromBatch()}
 catch(error){batchQueue=[];batchTotal=0;setStatus(error.message,true)}
}
function sendEngine(){
 if(batchTotal){setStatus('Le transfert du projet est en cours.',true);return}
 try{if(pushSource(file()))setStatus('Fichier envoyé pour import dans Script Studio.')}
 catch(e){setStatus(e.message,true)}
}
$('codeInput').addEventListener('input',()=>{updateNumbers();updateActive();render();storeSession()});$('codeInput').addEventListener('scroll',updateNumbers);$('codeInput').addEventListener('click',updatePosition);$('codeInput').addEventListener('keyup',updatePosition);
$('codeInput').addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const t=e.target,start=t.selectionStart,end=t.selectionEnd;t.setRangeText('    ',start,end,'end');t.dispatchEvent(new Event('input',{bubbles:true}))}});
$('newProject').onclick=()=>{if(!confirm('Créer un nouveau projet ? Exporte ton projet actuel si tu souhaites le conserver.'))return;for(const model of models.values())model.dispose();models.clear();project=createProject();openTabs=[];activate(project.files[0].path);store()};
$('newFile').onclick=newFile;$('addSmall').onclick=newFile;
$('save').onclick=store;$('exportProject').onclick=exportProject;$('importProject').onclick=()=>$('projectPicker').click();
$('download').onclick=()=>{if(file())download(active.split('/').at(-1),file().source)};
$('importFiles').onclick=()=>$('filePicker').click();$('projectPicker').onchange=importProject;$('filePicker').onchange=importFiles;
$('check').onclick=diagnostics;$('engineButton').onclick=()=>$('engineDialog').showModal();
$('startConnection').addEventListener('click',e=>{e.preventDefault();$('engineDialog').close();startConnection()});
$('sendEngine').onclick=sendEngine;$('sendProject').onclick=sendProject;$('projectName').addEventListener('change',e=>{project.name=e.target.value.trim().slice(0,90)||'Mon projet';store()});
$('fileSearch').addEventListener('input',render);$('focusSearch').onclick=()=>{$('fileSearch').focus();document.querySelector('.explorer').classList.add('show')};
$('toggleOutline').onclick=()=>document.querySelector('.outline').classList.toggle('show');
$('problemsTab').onclick=()=>selectPanel(false);$('outputTab').onclick=()=>selectPanel(true);
document.querySelector('.activity-bar button:first-child').onclick=()=>document.querySelector('.explorer').classList.toggle('show');
$('fileTree').addEventListener('contextmenu',e=>{if(!e.target.closest('button')||!file())return;e.preventDefault();const choice=prompt('Fichier : écrire RENOMMER ou SUPPRIMER','RENOMMER');if(choice?.toUpperCase()==='RENOMMER')renameActive();else if(choice?.toUpperCase()==='SUPPRIMER')deleteActive()});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();store()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='o'){e.preventDefault();$('projectPicker').click()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'){e.preventDefault();$('fileSearch').focus()}});
window.addEventListener('beforeunload',()=>{try{storeSession()}catch{}});
load();$('codeInput').value='';if(active)activate(active);else render();log('W Visual Code autonome prêt. Aucun accès au moteur sans demande explicite.');
// Optional Monaco enhancement only. Offline native textarea always works.
async function loadMonaco(){try{
 const url='https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js';
 await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=url;script.onload=resolve;script.onerror=reject;document.head.append(script)});
 window.require.config({paths:{vs:'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs'}});
 await new Promise((resolve,reject)=>window.require(['vs/editor/editor.main'],resolve,reject));
 monaco=window.monaco;
 codeEditor=monaco.editor.create($('monaco'),{theme:'vs-dark',automaticLayout:true,language:editorLanguage(active),fontSize:13,minimap:{enabled:true},tabSize:4,scrollBeyondLastLine:false,ariaLabel:'Éditeur de code'});
 $('monaco').hidden=false;$('fallback').hidden=true;$('editorKind').textContent='Monaco · coloration et complétion';
 codeEditor.onDidChangeModelContent(()=>{if(!file())return;updateActive();render();storeSession()});
 codeEditor.onDidChangeCursorPosition(updatePosition);
 if(active){const f=file();const model=monaco.editor.createModel(f.source,editorLanguage(active));models.set(active,model);codeEditor.setModel(model)}
 }catch{log('Monaco indisponible : éditeur texte natif conservé.');$('editorKind').textContent='Éditeur local · hors ligne'}}
loadMonaco();
