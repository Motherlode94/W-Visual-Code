import test from 'node:test';
import assert from 'node:assert/strict';
import {VERSION,createProject,validateProject,validPath,addFile,renameFile,languageOf,outgoingFile,isValidEngineOrigin,MAX_SOURCE} from '../src/project.js';
test('project templates create valid browser-only WarScript workspaces',()=>{
 const project=validateProject(createProject());
 assert.equal(project.schema,VERSION);
 assert.equal(project.files.length,1);
 assert.equal(languageOf(project.files[0].path),'warscript');
 assert.match(project.files[0].source,/MonoBehaviour/);
});
test('reject path escapes, unsupported extensions and duplicate names',()=>{
 for(const p of ['/etc/passwd','../evil.wls','folder/../../evil.cs','evil.exe','C:/local/file.cs','a//b.cs','a/./b.cs',''])assert.throws(()=>validPath(p),p);
 const project=createProject();
 assert.throws(()=>addFile(project,'scripts/playercontroller.wls'),'case-insensitive collision');
 assert.equal(addFile(project,'Scripts/New.cs','class New {}'),'Scripts/New.cs');
 assert.throws(()=>renameFile(project,'Scripts/New.cs','Scripts/PlayerController.wls'));
 assert.equal(renameFile(project,'Scripts/New.cs','Scripts/Renamed.cs'),'Scripts/Renamed.cs');
});
test('reject malicious project records, large content and unsupported source',()=>{
 assert.throws(()=>validateProject({schema:'other',name:'Project',files:[]}));
 const p=createProject();p.files[0].source='x'.repeat(MAX_SOURCE+1);
 assert.throws(()=>validateProject(p));
 assert.throws(()=>addFile(createProject(),'Scripts/Huge.wls','x'.repeat(MAX_SOURCE+1)));
});
test('Engine transfer requires explicitly supported script type and never truncates',()=>{
 const file={path:'Scripts/Hero.cs',source:'class Hero {}'};
 assert.deepEqual(outgoingFile(file),{...file,language:'csharp'});
 assert.throws(()=>outgoingFile({path:'README.md',source:'text'}));
 assert.throws(()=>outgoingFile({path:'Scripts/Hero.cs',source:'x'.repeat(MAX_SOURCE+1)}));
});
test('Engine origin must be an exact HTTPS origin or local development origin',()=>{
 for(const value of ['https://warlike-engine.pages.dev','https://example.org','http://localhost:8080'])assert.equal(isValidEngineOrigin(value),true);
 for(const value of ['http://warlike-engine.pages.dev','https://evil.org/path','javascript:alert(1)','https://evil.org@warlike-engine.pages.dev/'])assert.equal(isValidEngineOrigin(value),false,value);
});
