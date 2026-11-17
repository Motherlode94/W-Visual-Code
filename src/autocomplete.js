// W Visual Code: deterministic, local completions for the bounded WarScript API.
export const LIFECYCLE=['Awake','OnEnable','Start','FixedUpdate','Update','LateUpdate','OnDisable','OnDestroy'];
const CALLS=['Log','Debug.Log','Move','Rotate','transform.Translate','transform.Rotate','SetVisible','SetLight','SetHealth','Get','Set','Signal','gameObject.SetActive','Animator.Play','Animator.SetFloat','Animator.SetInteger','Animator.SetBool','Animator.SetTrigger','Animator.ResetTrigger','Input.GetKey','Input.GetKeyDown','Mathf.Sin','Mathf.Cos','Mathf.Abs','Mathf.Min','Mathf.Max','Mathf.Clamp','Vector3'];
const PROPS=['Time.deltaTime','Time.fixedDeltaTime','Time.time','transform.position','transform.position.x','transform.position.y','transform.position.z','transform.rotation.x','transform.rotation.y','transform.rotation.z','enabled','isActiveAndEnabled','gameObject.name','gameObject.activeSelf','gameObject.active','health','light.intensity','light.enabled','vehicle.maxSpeed','vehicle.acceleration','vehicle.brakeForce','vehicle.turnRate','controller.walkSpeed','controller.sprintSpeed','controller.jumpSpeed','world.timeScale'];
const WORDS=['public','private','void','float','int','bool','string','var','Vector3','if','else','while','return','true','false','class','MonoBehaviour'];
const entry=(label,insert=label,kind='keyword',detail='')=>({label,insert,kind,detail});
const args={
 'transform.Translate':'0, 0, 0','transform.Rotate':'0, 0, 0',
 'Animator.SetFloat':'"Speed", 0','Animator.SetInteger':'"State", 0','Animator.SetBool':'"Running", true',
 'Mathf.Clamp':'0, 0, 1','Mathf.Min':'0, 1','Mathf.Max':'0, 1','Vector3':'0, 0, 0',
 'gameObject.SetActive':'true','Input.GetKey':'"w"','Input.GetKeyDown':'"space"'
};
const makeCall=label=>label+'('+(args[label]??'__CURSOR__')+')'+(label.startsWith('Mathf.')||label.startsWith('Input.')||label==='Vector3'?'':';');
export const WARLIKE_CATALOG=[
 ...CALLS.map(label=>entry(label,makeCall(label),'function','API WarScript vérifiée')),
 ...PROPS.map(label=>entry(label,label,'property','Propriété Engine')),
 ...WORDS.map(label=>entry(label,label,'keyword','Mot-clé WarScript')),
 ...LIFECYCLE.map(label=>entry(label,'void '+label+'() {\n    __CURSOR__\n}','snippet','Cycle de vie MonoBehaviour')),
 entry('MonoBehaviour class','public class NewBehaviour : MonoBehaviour {\n    void Start() {\n        __CURSOR__\n    }\n\n    void Update() {\n    }\n}','snippet','Classe WarScript'),
 entry('[SerializeField]','[SerializeField] private float speed = __CURSOR__;','snippet','Champ sérialisé')
];
const other={
 csharp:'public private protected class void float int string bool using namespace return if else for foreach while GetComponent AddComponent MonoBehaviour Awake Start Update',
 javascript:'const let function class return async await if else for while import export try catch',
 typescript:'const let type interface class extends implements function return async await import export readonly private public',
 python:'def class return import from if else elif for while print with async await',
 cpp:'int float void class struct public private namespace const auto return if for while',
 c:'int float void struct const return if for while'
};
export const LANGUAGE_CATALOG=Object.fromEntries(Object.entries(other).map(([language,words])=>[language,words.split(' ').map(label=>entry(label,label,'keyword',language))]));
export function projectSymbols(files,activePath=''){
 const names=new Set();let count=0;
 for(const file of files||[]){
  if(!file||typeof file.source!=='string'||file.path===activePath)continue;
  if(++count>200)break;
  const re=/\b(?:class|void|float|int|bool|string|var|const|let|function|type|interface|def|struct)\s+([A-Za-z_]\w*)/g;
  for(const match of file.source.matchAll(re)){names.add(match[1]);if(names.size>=100)break}
  if(names.size>=100)break;
 }
 return [...names].map(label=>entry(label,label,'variable','Symbole d’un autre fichier'));
}
function inCommentOrString(line){
 let quote='',escaped=false;
 for(let i=0;i<line.length;i++){
  const char=line[i],next=line[i+1];
  if(escaped){escaped=false;continue}
  if(quote){if(char==='\\'){escaped=true;continue}if(char===quote)quote='';continue}
  if(char==='/'&&next==='/')return true;
  if(char==='#'&&line.slice(0,i).trim()==='')return true;
  if(char==='"'||char==="'"||char.charCodeAt(0)===96)quote=char;
 }
 return Boolean(quote);
}
export function completionContext(source,offset,{force=false}={}){
 if(typeof source!=='string'||!Number.isSafeInteger(offset)||offset<0||offset>source.length)return null;
 const before=source.slice(0,offset),line=before.slice(before.lastIndexOf('\n')+1);
 if(inCommentOrString(line))return null;
 const match=/[A-Za-z_][A-Za-z0-9_.]*$/.exec(line);
 if(!match)return force?{prefix:'',start:offset,end:offset,member:false}:null;
 const prefix=match[0];if(prefix.length<2&&!prefix.includes('.')&&!force)return null;
 return {prefix,start:offset-prefix.length,end:offset,member:prefix.includes('.')};
}
export function completeCode({language='warscript',source='',offset=0,files=[],activePath='',force=false,limit=24}={}){
 const context=completionContext(source,offset,{force});if(!context)return {context:null,items:[]};
 const catalog=language==='warscript'?WARLIKE_CATALOG:(LANGUAGE_CATALOG[language]||[]);
 const prefix=context.prefix.toLowerCase(),seen=new Set(),items=[];
 for(const entry of [...catalog,...projectSymbols(files,activePath)]){
  if(context.member&&!entry.label.includes('.'))continue;
  if(prefix&&!entry.label.toLowerCase().startsWith(prefix))continue;
  if(entry.label===context.prefix||seen.has(entry.label))continue;
  seen.add(entry.label);items.push({...entry,from:context.start,to:context.end});
  if(items.length>=Math.max(1,Math.min(limit,60)))break;
 }
 return {context,items};
}
export function applyCompletion(source,item){
 if(typeof source!=='string'||!item||!Number.isInteger(item.from)||!Number.isInteger(item.to)||item.from<0||item.to<item.from||item.to>source.length)throw Error('Complétion invalide.');
 const original=String(item.insert),marker='__CURSOR__',at=original.indexOf(marker);
 const insert=original.replaceAll(marker,'');
 return {source:source.slice(0,item.from)+insert+source.slice(item.to),cursor:item.from+(at<0?insert.length:at)};
}
