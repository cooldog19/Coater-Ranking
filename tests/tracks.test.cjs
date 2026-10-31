const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),C=require('../core.js'),S=require('../social-model.js'),M=require('../statistics-model.js'),K=require('../catalog.js');
const root=path.resolve(__dirname,'..');
const stardust=(side,ranked=true)=>({id:side,name:'Stardust Racers ('+side+')',park:'Universal Epic Universe',manufacturer:'Mack Rides',type:'Steel',ranked,notes:side+' private note',riddenOn:side==='Green'?'2024-01-01':'2025-02-01'});
test('identified legacy track entries upgrade to one ranked ride with separate credits and retained notes',()=>{
  const state=C.normalize({version:1,rides:[stardust('Green'),{name:'Other',ranked:true},stardust('Yellow')]});
  assert.equal(state.version,2);assert.equal(state.rides.length,2);assert.equal(state.rides[0].name,'Stardust Racers');assert.equal(C.creditCount(state.rides),3);
  assert.equal(state.rides[0].id,'Green');assert.equal(state.rides[0].tracks.filter(t=>t.ridden).length,2);assert(state.rides[0].notes.includes('Yellow private note'));assert.equal(state.rides[0].tracks.find(t=>t.name==='Yellow').riddenOn,'2025-02-01');
  assert.equal(state.rides[0].riddenOn,'2024-01-01');assert.deepEqual(C.normalize(state),state);
  const ambiguous=C.normalize({version:1,rides:[{name:'Stardust Racers',park:'Universal Epic Universe'}]});assert.equal(C.creditCount(ambiguous.rides),1);assert.equal(ambiguous.rides[0].tracks.filter(t=>t.ridden).length,0);
  assert.equal(C.ride({name:'Iron Gwazi',park:'Busch Gardens Tampa'}).tracks,undefined);assert.equal(C.ride({name:'Gwazi',park:'Lion Park Resort'}).tracks,undefined);
});

test('custom track names, preferences, dates and private notes survive JSON and CSV backups',()=>{
  const combined=C.combineRides(C.ride({id:'red',name:'Racer Red',park:'Park',notes:'Red note',riddenOn:'2024-01-01'}),C.ride({id:'blue',name:'Racer Blue',park:'Park',notes:'Blue note',riddenOn:'2025-01-01'}),['Red','Blue']);
  combined.name='Racer';combined.preferredTrack=combined.tracks[1].id;const state=C.normalize({version:2,rides:[combined]});
  assert.equal(C.creditCount(state.rides),2);assert.equal(state.rides.length,1);assert.deepEqual(C.importText(JSON.stringify(state)).rides,state.rides);
  const csv=C.importText(C.exportCSV(state.rides),'tracks.csv').rides[0];assert.equal(csv.tracks.length,2);assert.equal(csv.tracks[1].notes,'Blue note');assert.equal(csv.preferredTrack,combined.preferredTrack);assert.equal(C.creditValue(csv),2);
  assert.equal(K.same(state.rides[0],{id:'blue',name:'Racer Blue',park:'Park'}),true,'Original child names prevent duplicated imports after combining.');
  assert.equal(C.merge(state.rides,[C.ride({name:'Racer Blue',park:'Park'})]).added,0);
});

test('merge adds a second ridden track without moving the ranking or replacing notes',()=>{
  const existing=C.normalize({version:1,rides:[stardust('Green')]}).rides,incoming=C.normalize({version:1,rides:[stardust('Yellow',false)]}).rides;
  const merged=C.merge(existing,incoming);assert.equal(merged.added,0);assert.equal(merged.updated,1);assert.equal(merged.rides.length,1);assert.equal(C.creditCount(merged.rides),2);assert.equal(merged.rides[0].id,'Green');assert.equal(merged.rides[0].ranked,true);
  assert(merged.rides[0].notes.includes('Green private note'));assert(merged.rides[0].notes.includes('Yellow private note'));assert.equal(existing[0].tracks.find(t=>t.name==='Yellow').ridden,false);
  assert.equal(C.merge(merged.rides,incoming).updated,0);
});

test('combining tracks retains uncredited track metadata and supports importing a new named side',()=>{
  const a=C.ride({id:'a',name:'Racer',park:'Park',tracks:[{id:'red',name:'Red',ridden:true,notes:'Red note'},{id:'blue',name:'Blue',ridden:false,notes:'Private blue note',riddenOn:'2024-01-01'}]}),b=C.ride({id:'b',name:'Racer Green',park:'Park',notes:'Green note'});
  const combined=C.combineRides(a,b,['Existing','Green']);assert.equal(combined.tracks.length,3);assert.equal(combined.tracks.find(t=>t.name==='Blue').notes,'Private blue note');assert.equal(C.creditValue(combined),2);
  const merged=C.merge([combined],[C.ride({name:'Racer Blue',park:'Park',ranked:false})]);assert.equal(merged.added,0);assert.equal(merged.updated,1);assert.equal(C.creditValue(merged.rides[0]),3);assert.equal(merged.rides[0].tracks.find(t=>t.name==='Blue').notes,'Private blue note');
});

test('statistics and public profiles count credits twice, rank once and exclude private track fields',()=>{
  const state=C.normalize({version:1,rides:[stardust('Green'),stardust('Yellow')]}),ride=state.rides[0];ride.preferredTrack='yellow';
  const report=M.analyze(state,[],[]),publicData=S.project(state);assert.equal(report.totals.credits,2);assert.equal(report.totals.rides,1);assert.equal(report.totals.ranked,1);assert.equal(report.manufacturers[0].credits,2);assert.equal(report.manufacturers[0].ranked,1);assert.equal(report.manufacturers[0].score,100);assert.equal(report.parks[0].credits,2);
  assert.equal(S.stats(publicData).credits,2);assert.equal(S.stats(publicData).ranked,1);assert.equal(publicData.rides[0].preferredTrack,'yellow');assert(!JSON.stringify(publicData).includes('private note'));assert(!JSON.stringify(publicData).includes('2024-01-01'));assert(!JSON.stringify(publicData).includes('riddenOn'));
});

test('track validation rejects duplicate labels, excess tracks, unsafe links and oversized credit totals',()=>{
  assert.throws(()=>C.ride({name:'Bad',tracks:[{name:'Green'},{name:'green'}]}),/different name/);
  assert.throws(()=>C.ride({name:'Bad',tracks:Array.from({length:9},(_,i)=>({name:'Track '+i}))}),/eight/);
  assert.throws(()=>C.ride({name:'Bad',tracks:[{name:'Red',rcdb:'javascript:alert(1)'}]}));
  assert.throws(()=>C.ride({name:'Bad',tracks:[{name:'Red',riddenOn:'2025-02-30'}]}),/Invalid ride date/);
  assert.throws(()=>C.normalize({version:2,rides:Array.from({length:2501},(_,i)=>({name:'Ride '+i,tracks:[{name:'Red',ridden:true},{name:'Blue',ridden:true}]}))}),/credits/);
  const tooLong=C.normalize({version:1,rides:[{...stardust('Green'),notes:'a'.repeat(10000)},{...stardust('Yellow'),notes:'b'.repeat(10000)}]});assert.equal(tooLong.rides.length,2,'Automatic consolidation never truncates notes.');
});

function app(t,state){const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://example.test/Tracklist/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,errors=[];
  w.addEventListener('error',event=>errors.push(event.error));w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.localStorage.setItem('tracklist.collection.v1',JSON.stringify(state||{version:1,rides:[]}));for(const file of ['core.js','catalog-data.js','catalog.js','migration.js','recovery.js','sync-model.js','cloud.js','app.js','features.js','comparison-model.js','comparison.js'])w.eval(fs.readFileSync(path.join(root,file),'utf8'));
  t.after(()=>{w.close();assert.deepEqual(errors,[]);});const d=w.document;return {w,d,A:w.TracklistApp,click:q=>{const b=d.querySelector(q);assert(b,q);b.click();},submit:id=>d.getElementById(id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})),input:(id,value)=>{d.getElementById(id).value=value;}};
}

test('catalog logging opens track choices; both tracks save as two credits and one ranked ride',t=>{
  const a=app(t);a.A.setView('explore');a.input('catalog-search','Stardust Racers');a.d.getElementById('catalog-search').dispatchEvent(new a.w.Event('input'));a.click('[data-catalog-mode="rides"]');a.input('catalog-search','Stardust Racers');a.d.getElementById('catalog-search').dispatchEvent(new a.w.Event('input'));a.click('[data-catalog-action="log"]');
  assert.equal(a.d.getElementById('multi-track'),null);assert.equal(a.d.querySelectorAll('.auto-track-name').length,2);assert.equal(a.d.querySelector('[name="multi-track"]').type,'hidden');a.d.querySelector('[name="track-ridden-0"]').checked=true;a.d.querySelector('[name="track-ridden-1"]').checked=true;a.d.querySelector('[name="preferredTrack"]').value='yellow';a.submit('ride-form');assert.equal(a.A.getState().rides[0].ranked,false);a.click('#new-rank-now');
  a.A.setView('ranked');assert.equal(a.d.querySelectorAll('.ride-row').length,1);assert.equal(a.d.getElementById('stat-total').textContent,'2');assert.match(a.d.querySelector('.ride-track-summary').textContent,/Favorite: Yellow/);
  a.A.setView('all');assert.equal(a.d.querySelectorAll('.ride-track-details div').length,2);assert.match(a.d.getElementById('list-summary').textContent,/2 credits/);
  a.w.TracklistQuiz.start({mode:'full'});assert.equal(a.A.getState().rides.length,1);assert.equal(a.d.getElementById('stat-total').textContent,'2');
});

test('new credits show only supplied tracks and ordinary manual credits have no separate-tracks toggle',t=>{
  const a=app(t);a.A.addFromCatalog({id:'test-dual',name:'Dual Ride',park:'Test Park',tracks:[{id:'red',name:'Red',ridden:false},{id:'blue',name:'Blue',ridden:false}]});
  assert.equal(a.d.getElementById('multi-track'),null);assert.equal(a.d.getElementById('add-track'),null);assert.equal(a.d.querySelector('[data-remove-track]'),null);
  assert.deepEqual([...a.d.querySelectorAll('.auto-track-name')].map(n=>n.textContent),['Red','Blue']);
  a.d.querySelector('[name="track-ridden-0"]').checked=true;a.d.querySelector('[name="track-ridden-1"]').checked=true;a.submit('ride-form');a.click('#new-rank-later');
  assert.equal(C.creditCount(a.A.getState().rides),2);assert.equal(a.A.getState().rides[0].tracks[1].name,'Blue');
  a.A.setView('all');a.click('#add-button');a.click('#add-manually');assert.equal(a.d.querySelector('.track-editor'),null);assert.equal(a.d.getElementById('multi-track'),null);
  a.input('field-name','Stardust Racers');a.input('field-park','Universal Epic Universe');a.d.getElementById('field-park').dispatchEvent(new a.w.Event('change'));assert.equal(a.d.querySelectorAll('.auto-track-name').length,2);
  a.input('field-name','Ordinary ride');a.d.getElementById('field-name').dispatchEvent(new a.w.Event('change'));assert.equal(a.d.querySelector('.track-editor'),null);assert.equal(a.d.querySelector('[name="multi-track"]'),null);
  a.submit('ride-form');assert.equal(a.A.getState().rides.find(r=>r.name==='Ordinary ride').tracks,undefined);
});

test('custom edit controls and combining existing entries preserve rank, metadata and undo',t=>{
  const a=app(t,{version:1,rides:[{id:'red',name:'Racer Red',park:'Park',ranked:true,notes:'Red notes'},{id:'other',name:'Another ride',park:'Park',ranked:true},{id:'blue',name:'Racer Blue',park:'Park',ranked:false,notes:'Blue notes'}]});
  a.A.editModal('red');a.click('#combine-track-entries');a.d.getElementById('combine-other').value='blue';a.d.getElementById('combine-other').dispatchEvent(new a.w.Event('change'));a.input('field-combined-name','Racer');a.input('field-primary-track','Red');a.input('field-other-track','Blue');a.submit('combine-form');
  assert.equal(a.A.getState().rides.length,2);assert.equal(a.A.getState().rides[0].id,'red');assert.equal(C.creditCount(a.A.getState().rides),3);assert.equal(a.A.getState().rides[0].tracks[1].notes,'Blue notes');
  a.A.closeModal();a.click('#undo-button');assert.equal(a.A.getState().rides.length,3);
  a.A.editModal('red');a.click('#multi-track');assert.equal(a.d.querySelectorAll('.track-editor-row').length,2);a.d.querySelector('[name="track-name-0"]').value='One';a.d.querySelector('[name="track-name-1"]').value='Two';a.d.querySelector('[name="track-ridden-1"]').checked=true;a.submit('ride-form');assert.equal(C.creditValue(a.A.getState().rides[0]),2);
});
