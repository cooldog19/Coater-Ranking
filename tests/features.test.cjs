const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),C=require('../core.js'),K=require('../catalog.js'),M=require('../migration.js'),R=require('../recovery.js');
const {parse:parseArticle}=require('../scripts/update-coasterpedia.cjs');
const root=path.resolve(__dirname,'..'),KEY='tracklist.collection.v1';
function app(t,{denyStorage=false}={}){
  const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://example.test/Coater-Ranking/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,errors=[];
  w.addEventListener('error',e=>errors.push(e.error));w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
  w.localStorage.setItem(KEY,JSON.stringify({version:1,rides:[]}));
  if(denyStorage)Object.defineProperty(w,'localStorage',{get(){throw new w.DOMException('Storage blocked','SecurityError');}});
  for(const file of ['core.js','catalog-data.js','catalog.js','migration.js','recovery.js','sync-model.js','cloud.js','app.js','features.js'])w.eval(fs.readFileSync(path.join(root,file),'utf8'));
  t.after(()=>{w.close();assert.deepEqual(errors,[]);});
  return {w,doc:w.document,A:w.TracklistApp,state:()=>JSON.parse(w.localStorage.getItem(w.TracklistApp.getStorageKey())),click:selector=>{const el=w.document.querySelector(selector);assert(el,selector);el.click();},input:(id,value)=>{const el=w.document.getElementById(id);assert(el,id);el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));},submit:id=>w.document.getElementById(id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}))};
}
test('catalog browse, plan, log, duplicate prevention and rank placement work together',t=>{
  const a=app(t);a.A.setView('explore');a.input('catalog-search','Cedar Point');a.click('[data-park-id]');
  const record=a.w.TRACKLIST_CATALOG.rides.find(r=>r.name==='Steel Vengeance'&&r.park==='Cedar Point'),card=`[data-catalog-id="${record.id}"]`;
  assert(a.doc.querySelector(card+' a[href="'+record.rcdb+'"]'));a.click(card+' [data-catalog-action="plan"]');assert.equal(a.state().rides.length,0);assert.equal(a.state().wishlist.length,1);
  a.A.setView('wishlist');a.click('#wishlist-panel [data-catalog-action="log"]');assert.equal(a.state().wishlist.length,0);assert.equal(a.state().rides.length,1);assert.equal(a.state().rides[0].ranked,false);assert.equal(a.state().rides[0].catalogId,record.id);assert.match(a.state().rides[0].riddenOn,/^\d{4}-\d{2}-\d{2}$/);
  a.A.setView('explore');assert.equal(a.doc.querySelector(card+' [data-catalog-action="log"]'),null);a.click(card+' [data-catalog-action="rank"]');a.click('#move-first');assert.equal(a.state().rides[0].ranked,true);
});
test('manual catalog autofill saves metadata and personal notes',t=>{
  const a=app(t);a.click('#add-button');a.input('add-catalog-search','Steel Vengeance');a.click('[data-autofill]');a.input('field-notes','Back row 🎢');a.submit('ride-form');
  const ride=a.state().rides[0];assert.equal(ride.park,'Cedar Point');assert.equal(ride.type,'Hybrid');assert(ride.rcdb);assert(ride.catalogId);assert.equal(ride.notes,'Back row 🎢');assert.match(ride.source,/coasterpedia.net/);assert.equal(ride.license,'CC-BY-SA-4.0');
});
test('storage access blocked by the browser still allows editing and recovery UI',t=>{
  const a=app(t,{denyStorage:true});a.click('#add-button');a.input('field-name','Unsaved credit');a.submit('ride-form');assert.equal(a.A.getState().rides[0].name,'Unsaved credit');assert.equal(a.doc.getElementById('storage-warning').hidden,false);
  a.click('#backup-button');a.click('#open-recovery');assert.match(a.doc.getElementById('modal-content').textContent,/No checkpoints/);
});
test('first sign-in carries personal rides from a sample collection without demonstration rides',t=>{
  const a=app(t);a.A.restore({...C.sample(),rides:[...C.sample().rides,C.ride({name:'Personal credit'})]},'');a.A.switchAccount('new');assert.deepEqual(a.state().rides.map(r=>r.name),['Personal credit']);assert.equal(a.A.getState().demo,false);
});
test('migration is reviewed, matched and deduplicated without replacing existing notes',t=>{
  const a=app(t);a.A.change({rides:[C.ride({name:'Steel Vengeance',park:'Cedar Point',notes:'Personal'})]},'');
  a.click('#backup-button');a.click('#open-migration');a.input('migration-text','Coaster Name\tPark Name\nSteel Vengeance\tCedar Point\nRougarou\tCedar Point\nUnknown ride\tMy park');a.submit('migration-form');
  assert.equal(a.doc.getElementById('modal-title').textContent,'Review your credits.');assert.equal(a.state().rides.length,1);a.click('#migration-import');
  assert.equal(a.state().rides.length,3);assert.equal(a.state().rides[0].notes,'Personal');assert(a.state().rides.find(r=>r.name==='Rougarou').rcdb);assert(a.state().rides.slice(1).every(r=>!r.ranked));
});
test('account copies stay separate and corrupt local copies are not overwritten',t=>{
  const a=app(t);a.A.change({rides:[C.ride({name:'Guest'})]},'');a.A.switchAccount('one');a.A.change({rides:[C.ride({name:'Account one'})]},'');a.A.switchAccount(null);assert.equal(a.state().rides[0].name,'Guest');
  a.A.switchAccount('two');a.A.change({rides:[C.ride({name:'Account two'})]},'');a.A.switchAccount('one');assert.equal(a.state().rides[0].name,'Account one');
  a.w.localStorage.setItem(KEY+'.bad','{broken');a.A.switchAccount('bad');assert.equal(a.w.localStorage.getItem(KEY+'.bad'),'{broken');assert.equal(a.doc.getElementById('storage-warning').hidden,false);
});
test('recovery checkpoints restore a previous ranking including the trip list',t=>{
  const a=app(t);a.A.change({rides:[C.ride({name:'First'})],wishlist:[C.ride({name:'Planned',ranked:false})]},'');a.A.change({rides:[C.ride({name:'Second'})]},'');
  a.click('#backup-button');a.click('#open-recovery');const items=a.w.TracklistRecovery.list(a.w.localStorage,KEY),previous=items.find(s=>JSON.parse(s.data).rides[0]?.name==='First');assert(previous);
  a.click(`[data-recovery-restore="${previous.id}"]`);a.click('#restore-checkpoint');assert.equal(a.state().rides[0].name,'First');assert.equal(a.state().wishlist[0].name,'Planned');a.click('#undo-button');assert.equal(a.state().rides[0].name,'Second');
});
test('saved HTML import extracts only table data, matches old names and leaves ambiguity for review',()=>{
  const dom=new JSDOM(''),records=[{id:'a',name:'Rougarou',aliases:['Mantis'],park:'Cedar Point',rcdb:'https://rcdb.com/1.htm'},{id:'b',name:'Batman',park:'One'},{id:'c',name:'Batman',park:'Two'}];
  const rows=M.parse('<script>throw Error("unsafe")</script><table><tr><th>Coaster Name</th><th>Park</th></tr><tr><td>Mantis</td><td>Cedar Point</td></tr><tr><td>Batman</td><td></td></tr></table>',C,K,dom.window.DOMParser,records);
  assert.equal(rows[0].matchedId,'a');assert.equal(rows[1].matchedId,'');assert.equal(rows[1].candidates.length,2);assert(rows.every(r=>!r.ride.ranked));assert.throws(()=>M.parse('<html>No table</html>',C,K,dom.window.DOMParser,records),/No ride table/);dom.window.close();
});
test('catalog parser uses current names, current POV and top-level infobox fields',()=>{
  const record=parseArticle({pageid:1,title:'New ride',revisions:[{revid:2,slots:{main:{content:'{{Infobox roller coaster\n|name=Old ride\n|name2=New ride\n|name2To=Present\n|park=[[Park|My Park]]\n|manufacturer=One<br>Two\n|note={{Nested\n|park=Wrong Park\n}}\n|country=USA\n|video2=abcdefghijk\n|status=Operating\n|category1=Steel\n}}\n{{RCDB|link=https://rcdb.com/123.htm}}'}}}]});
  assert.equal(record.name,'New ride');assert.equal(record.park,'My Park');assert.deepEqual(record.aliases,['Old ride']);assert.equal(record.manufacturer,'One / Two');assert.equal(record.pov,'https://www.youtube.com/watch?v=abcdefghijk');assert.equal(record.rcdb,'https://rcdb.com/123.htm');
});
test('JSON keeps trip lists and new metadata; RCDB identity prevents duplicate imports',()=>{
  const state=C.normalize({version:1,rides:[{name:'New name',rcdb:'123',catalogId:'cp-1'}],wishlist:[{name:'Future',ranked:true}]});assert.equal(state.wishlist[0].ranked,false);assert.deepEqual(C.importText(JSON.stringify(state)),state);assert.equal(C.merge(state.rides,[C.ride({name:'Old name',rcdb:'123'})]).skipped,1);
  for(const url of ['javascript:alert(1)','https://rcdb.com.evil/1.htm','https://user@rcdb.com/1.htm'])assert.throws(()=>C.rcdbURL(url));
});
test('recovery failures do not block primary saving; history is bounded per account',()=>{
  const store=new Map(),storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
  for(let i=0;i<15;i++)R.save(storage,{rides:[{name:String(i)}]},'one',true);R.save(storage,{rides:[]},'two',true);assert.equal(R.list(storage,'one').length,10);assert.equal(R.list(storage,'two').length,1);
  assert.doesNotThrow(()=>R.save({getItem:()=>null,setItem:()=>{throw Error('quota');}},{rides:[]},'one',true));
});
