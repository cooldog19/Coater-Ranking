const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const C = require('../core.js');
const root = path.resolve(__dirname, '..');
const KEY = 'tracklist.collection.v1';
function app(t, {saved, quota = false} = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'),'utf8'), {url:'https://example.test/Coater-Ranking/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window, errors=[], downloads=[];
  w.addEventListener('error', e=>errors.push(e.error));
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.HTMLElement.prototype.setPointerCapture=function(){};
  w.HTMLElement.prototype.hasPointerCapture=function(){return false;};
  w.HTMLElement.prototype.releasePointerCapture=function(){};
  w.URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:test';};
  w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=function(){};
  if(saved!==undefined)w.localStorage.setItem(KEY,typeof saved==='string'?saved:JSON.stringify(saved));
  if(quota)w.Storage.prototype.setItem=function(){throw new Error('Quota exceeded');};
  w.eval(fs.readFileSync(path.join(root,'core.js'),'utf8'));
  w.eval(fs.readFileSync(path.join(root,'app.js'),'utf8'));
  t.after(()=>{dom.window.close();assert.deepEqual(errors,[],'No uncaught app errors');});
  const doc=w.document;
  return {w,doc,downloads,click:selector=>{const el=doc.querySelector(selector);assert(el,selector);el.click();},saved:()=>JSON.parse(w.localStorage.getItem(KEY)),names:()=>[...doc.querySelectorAll('.ride-title')].map(el=>el.textContent),submit:id=>doc.getElementById(id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})),fill:(id,value)=>{doc.getElementById(id).value=value;}};
}
test('sample is usable immediately; exact movement, undo and reload preserve order', t=>{
  const a=app(t);assert.equal(a.names().length,10);assert.equal(a.doc.getElementById('stat-total').textContent,'12');
  a.click('.ride-row:first-child .rank-button');a.fill('rank-input','10');a.submit('rank-form');
  assert.equal(a.names().at(-1),'Steel Vengeance');assert.equal(a.saved().rides[9].name,'Steel Vengeance');
  assert.equal(a.doc.getElementById('demo-banner').hidden,false);
  const b=app(t,{saved:a.saved()});assert.deepEqual(b.names(),a.names());
  a.click('#undo-button');assert.equal(a.names()[0],'Steel Vengeance');
});
test('keyboard moves and pointer drag update the ranking and support cancellation',t=>{
  const a=app(t);let handle=a.doc.querySelector('.drag-handle');
  handle.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}));assert.equal(a.names().at(-1),'Steel Vengeance');
  a.click('#undo-button');
  const rows=a.doc.querySelectorAll('.ride-row');handle=rows[0].querySelector('.drag-handle');
  rows[2].getBoundingClientRect=()=>({top:200,height:90});a.doc.elementFromPoint=()=>rows[2];
  const pointer=(target,type,x,y)=>{const event=new a.w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperty(event,'pointerId',{value:1});target.dispatchEvent(event);};
  pointer(handle,'pointerdown',20,100);pointer(a.doc,'pointermove',20,270);pointer(a.doc,'pointerup',20,270);
  assert.deepEqual(a.names().slice(0,3),['VelociCoaster','Fury 325','Steel Vengeance']);
  assert.equal(a.doc.querySelector('.drag-ghost'),null);
  const first=a.doc.querySelector('.drag-handle');pointer(first,'pointerdown',20,100);pointer(a.doc,'pointermove',20,270);pointer(a.doc,'pointercancel',20,270);
  assert.deepEqual(a.names().slice(0,3),['VelociCoaster','Fury 325','Steel Vengeance']);
});
test('bulk selection moves rides together; unranking and ranking from the inbox work',t=>{
  const a=app(t);const checks=a.doc.querySelectorAll('.ride-select');checks[1].click();checks[3].click();
  assert.equal(a.doc.getElementById('selection-count').textContent,'2 selected');
  a.fill('bulk-rank','1');a.click('#bulk-move');assert.deepEqual(a.names().slice(0,2),['VelociCoaster','Iron Gwazi']);
  a.click('.ride-select');a.click('#bulk-unrank');a.click('.list-tabs [data-view="unranked"]');
  assert(a.names().includes('VelociCoaster'));a.click('.ride-row:first-child .rank-button');a.click('#move-first');a.click('.list-tabs [data-view="ranked"]');
  assert.equal(a.names()[0],'VelociCoaster');
});
test('adding and editing personal rides preserves notes; clearing samples keeps personal additions',t=>{
  const a=app(t);a.click('#add-button');a.fill('field-name','My ride <script>alert(1)</script>');a.fill('field-park','My park');a.fill('field-notes','Back seat\nA great day.');a.fill('field-pov','https://youtu.be/test');a.submit('ride-form');
  assert.equal(a.saved().rides.length,13);assert.equal(a.doc.querySelectorAll('script:not([src])').length,0);
  assert.equal(a.doc.getElementById('demo-banner').hidden,false);
  a.click('#clear-demo');a.click('#confirm-action');assert.deepEqual(a.names(),['My ride <script>alert(1)</script>']);assert.equal(a.saved().rides[0].notes,'Back seat\nA great day.');
  a.click('.ride-row [data-action="edit"]');a.fill('field-notes','Updated note');a.submit('ride-form');assert.equal(a.saved().rides[0].notes,'Updated note');
  a.click('.ride-row [data-action="edit"]');a.click('#delete-ride');a.click('#confirm-action');assert.equal(a.names().length,0);a.click('#undo-button');assert.equal(a.names().length,1);
});
test('bulk add, search, unranked inbox and empty search results are functional',t=>{
  const a=app(t,{saved:{version:1,rides:[]}});a.click('#add-button');a.click('#multiple-tab');a.fill('field-names','Alpha | First Park\nBeta | Second Park');a.submit('ride-form');
  assert.deepEqual(a.names(),['Alpha','Beta']);assert.equal(a.doc.getElementById('stat-ranked').textContent,'0');
  a.fill('search','Second Park');a.doc.getElementById('search').dispatchEvent(new a.w.Event('input'));assert.deepEqual(a.names(),['Beta']);
  a.fill('search','no match');a.doc.getElementById('search').dispatchEvent(new a.w.Event('input'));assert.equal(a.doc.querySelector('.empty-state h2').textContent,'No rides found.');a.click('[data-action="clear-search"]');assert.equal(a.names().length,2);
});
test('invalid POV input displays an error without altering saved data',t=>{
  const a=app(t);const before=a.saved();a.click('.ride-row [data-action="edit"]');a.fill('field-pov','https://example.com/video');a.submit('ride-form');
  assert.equal(a.doc.getElementById('form-error').hidden,false);assert.deepEqual(a.saved(),before);
});
test('import is reviewed first; replacement, merge, duplicate skipping and undo work',async t=>{
  const a=app(t);
  const importFile=async(text,name)=>{
    a.click('#backup-button');const input=a.doc.getElementById('import-file');Object.defineProperty(input,'files',{value:[{name,size:text.length,text:async()=>text}]});input.dispatchEvent(new a.w.Event('change'));await new Promise(resolve=>setImmediate(resolve));
  };
  await importFile('Name,Park,Rank\nNew ride,New Park,1\nInbox,New Park,','credits.csv');
  assert.equal(a.saved().rides.length,12);assert.equal(a.doc.getElementById('modal-title').textContent,'Your import is ready.');
  a.submit('import-form');assert.deepEqual(a.names(),['New ride']);assert.equal(a.saved().rides.length,2);
  await importFile('Name,Park,Rank\nNew ride,New Park,1\nAnother,New Park,2','credits.csv');a.submit('import-form');assert.deepEqual(a.names(),['New ride','Another']);assert.equal(a.saved().rides.length,3);
  a.click('#undo-button');assert.equal(a.saved().rides.length,2);
  await importFile('Not a CSV','bad.csv');assert.equal(a.doc.getElementById('import-error').hidden,false);assert.equal(a.saved().rides.length,2);
});
test('JSON downloads contain the entire collection, including notes and unranked rides',async t=>{
  const a=app(t);a.click('#export-top');assert.equal(a.downloads.length,1);
  const text=await new Promise((resolve,reject)=>{const reader=new a.w.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsText(a.downloads[0]);});
  const backup=C.importText(text,'backup.json');assert.equal(backup.rides.length,12);assert.equal(backup.rides.filter(r=>!r.ranked).length,2);assert(backup.rides[0].notes);
});
test('storage failure is visible and does not prevent in-memory editing and exports',t=>{
  const a=app(t,{saved:{version:1,rides:[]},quota:true});assert.equal(a.doc.getElementById('storage-warning').hidden,false);
  a.click('#add-button');a.fill('field-name','Unsaved ride');a.submit('ride-form');assert.deepEqual(a.names(),['Unsaved ride']);assert.match(a.doc.getElementById('save-status').textContent,/Backup needed/);
  a.click('#export-top');assert.equal(a.downloads.length,1);
});
test('corrupt saved data is preserved until an explicit recovery or replacement',t=>{
  const a=app(t,{saved:'{broken'});assert.equal(a.w.localStorage.getItem(KEY),'{broken');assert.equal(a.doc.getElementById('storage-warning').hidden,false);
  a.click('#backup-button');a.click('#export-recovery');assert.equal(a.downloads.length,1);
  a.click('#reset-storage');a.click('#confirm-action');assert.equal(a.saved().rides.length,0);
});
test('other-tab changes refresh the collection and close a stale edit dialog',t=>{
  const a=app(t);a.click('.ride-row [data-action="edit"]');assert.equal(a.doc.getElementById('modal').open,true);
  const data=JSON.stringify({version:1,rides:[{name:'From another tab',ranked:true}]});
  a.w.dispatchEvent(new a.w.StorageEvent('storage',{key:KEY,newValue:data}));assert.deepEqual(a.names(),['From another tab']);assert.equal(a.doc.getElementById('modal').open,false);assert.equal(a.doc.getElementById('undo-button').disabled,true);
});
