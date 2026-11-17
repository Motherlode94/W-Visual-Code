import test from 'node:test';
import assert from 'node:assert/strict';
import {completeCode,completionContext,applyCompletion,projectSymbols,LIFECYCLE} from '../src/autocomplete.js';
const suggest=(src,language='warscript',force=false,files=[])=>completeCode({source:src,offset:src.length,language,force,files,activePath:'Scripts/Player.wls'}).items;
test('WarScript exposes actual supported Engine API names and MonoBehaviour lifecycle',()=>{
 assert.ok(suggest('transform.Tran').some(x=>x.label==='transform.Translate'));
 assert.ok(suggest('Animator.Set').some(x=>x.label==='Animator.SetFloat'));
 assert.ok(suggest('Time.del').some(x=>x.label==='Time.deltaTime'));
 assert.ok(suggest('Input.Get').some(x=>x.label==='Input.GetKeyDown'));
 assert.ok(suggest('Aw').some(x=>x.label==='Awake'));
 assert.equal(LIFECYCLE.length,8);
});
test('dot access restricts suggestions to matching qualified calls',()=>{
 const result=suggest('transform.');
 assert.ok(result.some(x=>x.label==='transform.Translate'));
 assert.equal(result.some(x=>x.label==='Animator.Play'),false);
 assert.equal(result.some(x=>x.label==='void'),false);
 assert.ok(result.length<24);
});
test('context is suppressed inside comments and strings',()=>{
 assert.equal(completionContext('// transform.',13),null);
 assert.equal(completionContext('var message = "transform.',25),null);
 assert.equal(completionContext('Input.Get',9)?.prefix,'Input.Get');
});
test('full method replacements never duplicate the object prefix',()=>{
 const src='transform.Tran';
 const item=suggest(src).find(x=>x.label==='transform.Translate');
 const result=applyCompletion(src,item);
 assert.ok(result.source.startsWith('transform.Translate('));
 assert.ok(!result.source.includes('transform.transform'));
 assert.equal(result.source.includes('__CURSOR__'),false);
 assert.ok(result.cursor>0&&result.cursor<result.source.length);
});
test('language-aware and cross-file completion is bounded',()=>{
 const files=[{path:'Scripts/Other.cs',source:'public class WeaponManager { void Fire() {} }'},{path:'Scripts/Player.wls',source:'class Current {}'}];
 const items=suggest('Wea','csharp',false,files);
 assert.ok(items.some(x=>x.label==='WeaponManager'));
 assert.ok(suggest('fun','javascript').some(x=>x.label==='function'));
 assert.equal(suggest('Mono','python').some(x=>x.label==='MonoBehaviour'),false);
 assert.equal(projectSymbols(files,'Scripts/Player.wls').some(x=>x.label==='Current'),false);
});
test('force Ctrl-Space offers suggestions without prefix, normal mode avoids noise',()=>{
 assert.equal(suggest(' ').length,0);
 assert.ok(suggest(' ','warscript',true).length>0);
 assert.equal(suggest('a').length,0);
});
test('invalid selections and offsets cannot alter source',()=>{
 assert.throws(()=>applyCompletion('xyz',{from:-1,to:2,insert:'foo'}));
 assert.equal(completionContext('hello',40),null);
});
