import {completeCode,applyCompletion} from './autocomplete.js';
// Browser UI adapter: no network; the same completion catalog drives Monaco
// and the offline native textarea. Script content is never executed here.
export function setupAutocomplete({textarea,popup,trigger,getProject,change}){
 let items=[],selected=0,monaco=null,editor=null;
 const context=()=>{const p=getProject();return {language:p.language,files:p.files,activePath:p.activePath}};
 const hide=()=>{items=[];selected=0;popup.hidden=true;popup.replaceChildren()};
 const paint=()=>{
  popup.replaceChildren();
  if(!items.length){hide();return}
  popup.hidden=false;
  items.forEach((item,index)=>{
   const button=document.createElement('button');button.type='button';button.setAttribute('role','option');
   button.setAttribute('aria-selected',String(index===selected));
   const name=document.createElement('strong');name.textContent=item.label;
   const detail=document.createElement('small');detail.textContent=item.detail;
   button.append(name,detail);
   button.addEventListener('mousedown',e=>e.preventDefault());
   button.addEventListener('click',()=>pick(index));
   popup.append(button);
  });
 };
 const suggest=(force=false)=>{
  if(editor){editor.trigger('wvc','editor.action.triggerSuggest',{});hide();return}
  const ctx=context(),result=completeCode({...ctx,source:textarea.value,offset:textarea.selectionStart,force});
  items=result.items;selected=0;paint();
 };
 const pick=index=>{
  const item=items[index];if(!item)return;
  const result=applyCompletion(textarea.value,item);
  textarea.value=result.source;textarea.setSelectionRange(result.cursor,result.cursor);
  textarea.dispatchEvent(new Event('input',{bubbles:true}));
  textarea.focus();hide();change?.();
 };
 const keydown=event=>{
  if(event.key==='Escape'&&!popup.hidden){event.preventDefault();hide();return}
  if((event.ctrlKey||event.metaKey)&&event.code==='Space'){event.preventDefault();suggest(true);return}
  if(!popup.hidden){
   if(event.key==='ArrowDown'){event.preventDefault();selected=(selected+1)%items.length;paint();return}
   if(event.key==='ArrowUp'){event.preventDefault();selected=(selected-1+items.length)%items.length;paint();return}
   if(event.key==='Enter'||event.key==='Tab'){event.preventDefault();pick(selected);return}
  }
 };
 textarea.addEventListener('keydown',keydown);
 textarea.addEventListener('input',()=>suggest(false));
 textarea.addEventListener('click',hide);
 textarea.addEventListener('blur',()=>{if(!popup.matches(':hover'))hide()});
 trigger.addEventListener('click',()=>suggest(true));
 const attachMonaco=(api,instance)=>{
  monaco=api;editor=instance;hide();
  const languages=['csharp','javascript','typescript','python','cpp','json','html','css','markdown'];
  for(const language of languages){
   api.languages.registerCompletionItemProvider(language,{
    triggerCharacters:['.'],
    provideCompletionItems(model,position){
     if(instance.getModel()!==model)return {suggestions:[]};
     const c=context(),source=model.getValue(),offset=model.getOffsetAt(position);
     // Monaco identifies .wls as C#, but we always use the active WVC file type.
     if(language==='csharp'&&!['warscript','csharp'].includes(c.language))return {suggestions:[]};
     if(language!=='csharp'&&c.language!==language)return {suggestions:[]};
     const result=completeCode({...c,source,offset,force:true,limit:45});
     const suggestions=result.items.map(item=>{
      const plain=item.insert.replaceAll('__CURSOR__','');
      return {label:item.label,kind:item.kind==='function'?api.languages.CompletionItemKind.Function:item.kind==='property'?api.languages.CompletionItemKind.Property:item.kind==='variable'?api.languages.CompletionItemKind.Variable:api.languages.CompletionItemKind.Snippet,
       detail:item.detail,insertText:plain,
       range:{startLineNumber:position.lineNumber,endLineNumber:position.lineNumber,startColumn:position.column-(offset-item.from),endColumn:position.column}};
     });
     return {suggestions};
    }
   });
  }
  editor.addCommand(api.KeyMod.CtrlCmd|api.KeyCode.Space,()=>editor.trigger('wvc','editor.action.triggerSuggest',{}));
 };
 return {attachMonaco,close:hide,trigger:suggest};
}
