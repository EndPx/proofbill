import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../docs/gitbook/',import.meta.url));
async function files(dir){const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);out.push(...entry.isDirectory()?await files(p):[p]);}return out;}
const all=await files(root),known=new Set(all.map(p=>path.resolve(p)));
const pages=all.filter(p=>p.endsWith('.md')&&!p.endsWith('SUMMARY.md'));
const summary=await readFile(path.join(root,'SUMMARY.md'),'utf8');
const targets=[...summary.matchAll(/\]\(([^)]+\.md)\)/g)].map(m=>path.resolve(root,m[1]));
assert.equal(new Set(targets).size,targets.length,'Duplicate navigation targets');
assert.deepEqual([...targets].sort(),[...pages].sort(),'Every article must appear exactly once in SUMMARY');
let links=0,diagrams=0;
for(const page of pages){
 const content=await readFile(page,'utf8');
 assert.equal((content.match(/^# /gm)||[]).length,1,`One H1 required: ${page}`);
 assert(!/\{\{[A-Z_]+\}\}|\bTODO\b|\bTBD\b|Ã|Â/.test(content),`Unresolved template or bad encoding: ${page}`);
 assert(!/postgres(?:ql)?:\/\/|-----BEGIN .*PRIVATE KEY-----|sk-proj-/.test(content),`Private material in ${page}`);
 diagrams+=(content.match(/```mermaid\n/g)||[]).length;
 assert.equal((content.match(/^```/gm)||[]).length%2,0,`Unclosed code block: ${page}`);
 for(const match of content.matchAll(/\]\(([^)]+)\)/g)){
   const target=match[1].replace(/^<|>$/g,'').split('#')[0];
   if(!target||/^(?:https?:|mailto:|data:)/.test(target))continue;
   const resolved=path.resolve(path.dirname(page),decodeURIComponent(target));
   assert(known.has(resolved),`Missing link/asset: ${path.relative(root,page)} -> ${target}`);links++;
 }
}
assert.equal((summary.match(/^## /gm)||[]).length,7,'Expected seven native page groups');
const home=await readFile(path.join(root,'README.md'),'utf8');
for(const field of ['title','tableOfContents','pagination'])assert(new RegExp(`${field}:\\s*\\n\\s+visible: false`).test(home),`Home layout must hide ${field}`);
assert.equal((home.match(/content-ref url=/g)||[]).length,1,'Home has one Documentation entry');
for(const source of all.filter(p=>p.endsWith('.excalidraw'))){
 const scene=JSON.parse(await readFile(source,'utf8'));assert.equal(scene.type,'excalidraw');
 assert(scene.elements.length>5);assert.equal(new Set(scene.elements.map(e=>e.id)).size,scene.elements.length);
}
for(const source of all.filter(p=>p.endsWith('.png'))){const bytes=await readFile(source);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');}
console.log(JSON.stringify({articles:pages.length,groups:7,relativeLinksAndAssets:links,mermaidDiagrams:diagrams,editableScenes:all.filter(p=>p.endsWith('.excalidraw')).length,status:'passed'},null,2));
