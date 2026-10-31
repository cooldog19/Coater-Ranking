const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),C=require('../core.js'),K=require('../catalog.js'),M=require('../migration.js'),R=require('../recovery.js');
const {parse:parseArticle}=require('../scripts/update-coasterpedia.cjs');
const root=path.resolve(__dirname,'..'),KEY='tracklist.collection.v1';
function app(t,{denyStorage=false,mockAccount=false,catalogOverride=null}={}){
  const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://example.test/Coater-Ranking/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,errors=[];
  w.addEventListener('error',e=>errors.push(e.error));w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
  w.localStorage.setItem(KEY,JSON.stringify({version:1,rides:[]}));
  if(denyStorage)Object.defineProperty(w,'localStorage',{get(){throw new w.DOMException('Storage blocked','SecurityError');}});
  for(const file of ['core.js','catalog-data.js','catalog.js','migration.js','recovery.js','sync-model.js','cloud.js','app.js'])w.eval(fs.readFileSync(path.join(root,file),'utf8'));
  if(catalogOverride)w.TRACKLIST_CATALOG=catalogOverride;
  let mock;
  if(mockAccount){let callbacks,controller,head=null,cloudState=null;mock={denied:false};
    const adapter={watch:(uid,onHead,onError)=>{queueMicrotask(()=>mock.denied?onError(Error('Account saving was blocked by database permissions.')):onHead(head));return()=>{};},write:async(uid,base,revision,state)=>{cloudState=state;return head={revision};},read:async()=>cloudState};
    const notify=user=>{const meta=callbacks.onAccount(user);controller.detach();if(user)controller.attach(user.uid,meta);};
    w.TracklistCloud={configured:()=>true,start:async()=>{},init:options=>{callbacks=options;controller=new w.TracklistSyncModel.Coordinator({...options,adapter,revision:()=>w.Tracklist.uid(),online:()=>true});return controller;},signIn:async(email,password,create)=>{mock.created=create;notify({uid:'alice',email});},signOut:async()=>notify(null),resetPassword:async()=>{},adapter};
    mock.controller=()=>controller;mock.state=()=>cloudState;
  }
  w.eval(fs.readFileSync(path.join(root,'features.js'),'utf8'));
  t.after(()=>{w.close();assert.deepEqual(errors,[]);});
  return {w,doc:w.document,A:w.TracklistApp,mock,state:()=>JSON.parse(w.localStorage.getItem(w.TracklistApp.getStorageKey())),click:selector=>{const el=w.document.querySelector(selector);assert(el,selector);el.click();},input:(id,value)=>{const el=w.document.getElementById(id);assert(el,id);el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));},submit:id=>w.document.getElementById(id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}))};
}
test('API catalog renames keep old credits recognized, prevent duplicate adding and retain saved park inventories',t=>{
  const record={id:'cp-900001',legacyIds:['cp-900000'],name:'Renamed ride',park:'New Park',parkId:'cp-park-900',country:'United States',manufacturer:'Maker',type:'Steel',status:'Operating',source:'https://coasterpedia.net/wiki/Ride'},data={version:1,updatedAt:'2026-10-31T00:00:00Z',source:'Coasterpedia',sourceURL:'https://coasterpedia.net/',license:'CC-BY-SA-4.0',licenseURL:'https://creativecommons.org/licenses/by-sa/4.0/',rides:[record],parks:[{id:record.parkId,name:'New Park',aliases:['Old Park'],country:'United States'}]};
  const a=app(t,{catalogOverride:data});a.A.change({rides:[C.ride({id:'mine',catalogId:'cp-900000',name:'Old ride',park:'Old Park',notes:'My memory',ranked:true})],parkWishlist:[{id:'oldpark',name:'Old Park',country:'United States'}]},'');
  a.A.setView('explore');a.input('catalog-search','New Park');a.click('[data-park-id]');assert.equal(a.doc.querySelector('[data-catalog-action="log"]'),null);assert.match(a.doc.getElementById('explore-panel').textContent,/Ranked #1/);
  a.A.setView('wishlist');a.click('[data-wish-park]');assert.match(a.doc.querySelector('.wish-park-detail').textContent,/Renamed ride/);
  a.A.setView('all');a.click('#add-button');a.input('add-catalog-search','Renamed ride');a.click('[data-autofill]');a.click('#save-new-credit');assert.match(a.doc.getElementById('form-error').textContent,/already in Credits/);assert.equal(a.state().rides.length,1);assert.equal(a.state().rides[0].notes,'My memory');assert.equal(a.state().rides[0].name,'Old ride');
});
test('catalog browse, plan, log, duplicate prevention and rank placement work together',t=>{
  const a=app(t);a.A.setView('explore');a.input('catalog-search','Cedar Point');a.click('[data-park-id]');
  const record=a.w.TRACKLIST_CATALOG.rides.find(r=>r.name==='Steel Vengeance'&&r.park==='Cedar Point'),card=`[data-catalog-id="${record.id}"]`;
  assert(a.doc.querySelector(card+' a[href="'+record.rcdb+'"]'));a.click(card+' [data-catalog-action="plan"]');assert.equal(a.state().rides.length,0);assert.equal(a.state().wishlist.length,1);
  a.A.setView('wishlist');a.click('#wishlist-panel '+card+' [data-catalog-action="log"]');assert.equal(a.state().wishlist.length,0);assert.equal(a.state().rides.length,1);assert.equal(a.state().rides[0].ranked,false);assert.equal(a.state().rides[0].catalogId,record.id);assert.match(a.state().rides[0].riddenOn,/^\d{4}-\d{2}-\d{2}$/);
  a.A.setView('explore');assert.equal(a.doc.querySelector(card+' [data-catalog-action="log"]'),null);a.click(card+' [data-catalog-action="rank"]');a.click('#move-first');assert.equal(a.state().rides[0].ranked,true);
});
test('manual catalog autofill saves metadata and personal notes',t=>{
  const a=app(t);a.click('[data-view="all"]');a.click('#add-button');a.input('add-catalog-search','Steel Vengeance');a.click('[data-autofill]');a.click('#add-manually');a.input('field-notes','Back row 🎢');a.submit('ride-form');
  const ride=a.state().rides[0];assert.equal(ride.park,'Cedar Point');assert.equal(ride.type,'Hybrid');assert(ride.rcdb);assert(ride.catalogId);assert.equal(ride.notes,'Back row 🎢');assert.match(ride.source,/coasterpedia.net/);assert.equal(ride.license,'CC-BY-SA-4.0');
});

test('new credit entry begins with catalog search and manual details expand only on request',t=>{
  const a=app(t);a.click('[data-view="all"]');a.click('#add-button');
  assert.equal(a.doc.activeElement.id,'add-catalog-search');assert.equal(a.doc.getElementById('manual-ride-fields').hidden,true);assert.equal(a.doc.getElementById('manual-ride-fields').disabled,true);
  assert.equal(a.doc.querySelector('#ride-form [name="ranked"]'),null);a.click('#save-new-credit');assert.match(a.doc.getElementById('form-error').textContent,/Choose a ride/);assert.equal(a.state().rides.length,0);
  a.input('add-catalog-search','missing unique catalog ride');assert.match(a.doc.getElementById('add-catalog-results').textContent,/Add manually/);
  a.click('#add-manually');assert.equal(a.doc.getElementById('manual-ride-fields').hidden,false);assert.equal(a.doc.getElementById('manual-ride-fields').disabled,false);assert.equal(a.doc.activeElement.id,'field-name');
  a.input('field-name','My custom coaster');a.input('field-park','My park');a.click('#add-manually');assert.equal(a.doc.getElementById('manual-ride-fields').hidden,true);a.click('#save-new-credit');assert.equal(a.state().rides.length,1);assert.equal(a.state().rides[0].ranked,false);
});

test('a catalog choice saves collapsed ride details, prevents duplicate credits and removes only its ride wish',t=>{
  const a=app(t);const record=a.w.TRACKLIST_CATALOG.rides.find(r=>r.name==='Steel Vengeance'&&r.park==='Cedar Point');
  a.A.change({wishlist:[K.fromRecord(record,C)],parkWishlist:[{id:'cedarpoint',name:'Cedar Point'}]},'');a.A.setView('all');a.click('#add-button');
  a.input('add-catalog-search','Steel Vengeance');a.click('[data-autofill]');assert.equal(a.doc.getElementById('manual-ride-fields').hidden,true);assert.equal(a.doc.getElementById('manual-ride-fields').disabled,false);
  assert.match(a.doc.getElementById('selected-catalog-ride').textContent,/Steel Vengeance/);a.click('#save-new-credit');assert.equal(a.state().rides[0].ranked,false);assert.equal(a.state().wishlist.length,0);assert.equal(a.state().parkWishlist.length,1);
  a.click('#add-button');a.input('add-catalog-search','Steel Vengeance');a.click('[data-autofill]');a.click('#save-new-credit');assert.equal(a.state().rides.length,1);assert.match(a.doc.getElementById('form-error').textContent,/already in Credits/);
});

test('ride wishes never create park wishes, and both wish lists can be removed independently',t=>{
  const a=app(t);a.A.setView('explore');a.input('catalog-search','Steel Vengeance');a.click('[data-catalog-mode="rides"]');a.input('catalog-search','Steel Vengeance');a.click('[data-catalog-action="plan"]');
  assert.equal(a.state().wishlist.length,1);assert.equal(a.state().parkWishlist.length,0);assert.equal(a.state().rides.length,0);
  a.A.setView('wishlist');assert.equal(a.doc.querySelectorAll('#wishlist-panel .catalog-ride').length,1);
  a.click('[data-wish-view="parks"]');assert.equal(a.doc.querySelectorAll('#wishlist-panel .park-card').length,0);
  a.click('#add-button');a.input('wish-picker-search','Cedar Point');a.click('[data-wish-picker-add]');
  assert.equal(a.state().parkWishlist.length,1);assert.equal(a.state().wishlist.length,1);assert.equal(a.state().rides.length,0);
  a.click('#modal [data-close]');a.click('[data-park-remove]');assert.equal(a.state().parkWishlist.length,0);assert.equal(a.state().wishlist.length,1);
  a.click('#undo-button');assert.equal(a.state().parkWishlist.length,1);
  a.click('[data-wish-view="rides"]');a.click('#wishlist-panel [data-catalog-action="remove"]');assert.equal(a.state().wishlist.length,0);assert.equal(a.state().parkWishlist.length,1);
});

test('wish list header opens a searchable paginated catalog picker that saves wishes without credits',t=>{
  const a=app(t);a.A.setView('wishlist');assert.equal(a.doc.getElementById('add-button').textContent,'Wish List a Park/Ride');a.click('#add-button');
  assert.equal(a.doc.getElementById('ride-form'),null);assert.equal(a.doc.querySelectorAll('[data-wish-picker-add]').length,20);
  const initial=a.doc.querySelector('[data-wish-picker-add]').dataset.wishPickerAdd;a.click('#wish-picker-next');assert.notEqual(a.doc.querySelector('[data-wish-picker-add]').dataset.wishPickerAdd,initial);
  a.click('[data-wish-picker-mode="rides"]');a.input('wish-picker-search','Steel Vengeance');const button=a.doc.querySelector('[data-wish-picker-add]');assert(button);button.click();
  assert.equal(a.state().rides.length,0);assert.equal(a.state().parkWishlist.length,0);assert.equal(a.state().wishlist.length,1);assert.equal(a.state().wishlist[0].name,'Steel Vengeance');assert(a.state().wishlist[0].rcdb);
  assert.equal(a.doc.querySelector('[data-wish-picker-add]').disabled,true);a.doc.querySelector('[data-wish-picker-add]').click();assert.equal(a.state().wishlist.length,1);
  a.input('wish-picker-search','<img src=x onerror=alert(1)>');assert.equal(a.doc.querySelector('#wish-picker-results img'),null);assert.match(a.doc.getElementById('wish-picker-results').textContent,/No matches/);
  a.click('#modal [data-close]');assert.equal(a.doc.getElementById('wishlist-count').textContent,'1');assert.equal(a.doc.querySelectorAll('#wishlist-panel .catalog-ride').length,1);
  a.click('[data-catalog-action="log"]');assert.equal(a.state().rides.length,1);assert.equal(a.state().wishlist.length,0);assert.equal(a.state().parkWishlist.length,0);
});

test('credit entry is limited to Credits and ranking notes and empty states navigate there',t=>{
  const a=app(t);
  for(const view of ['ranked','unranked','explore','social','statistics']){
    a.A.setView(view);assert.equal(a.doc.getElementById('add-button').hidden,true,view);
    assert.equal(a.doc.getElementById('credit-entry-note').hidden,!['ranked','unranked'].includes(view));
    a.click('#add-button');assert.equal(a.doc.getElementById('ride-form'),null);
  }
  a.A.setView('ranked');a.click('#credit-entry-note [data-view="all"]');assert.equal(a.A.getView(),'all');
  assert.equal(a.doc.getElementById('page-title').textContent,'Credits.');assert.equal(a.doc.getElementById('add-button').hidden,false);assert.equal(a.doc.getElementById('add-button').textContent,'Add a ride');
  a.click('#add-button');assert(a.doc.getElementById('ride-form'));a.click('#modal [data-close]');
  a.A.setView('unranked');assert.equal(a.doc.querySelector('[data-action="add"]'),null);a.click('[data-action="credits"]');assert.equal(a.A.getView(),'all');
});

test('legacy ride wishes without catalog metadata remain searchable, removable and undoable',t=>{
  const a=app(t);a.A.change({wishlist:[C.ride({name:'Custom wish',park:'Unlisted park',notes:'Keep me'})]},'');a.A.setView('wishlist');a.click('[data-wish-view="rides"]');
  a.input('wish-search','Custom');assert.match(a.doc.querySelector('#wishlist-panel .catalog-ride').textContent,/Custom wish/);
  a.click('[data-catalog-action="remove"]');assert.equal(a.state().wishlist.length,0);a.click('#undo-button');assert.equal(a.state().wishlist[0].notes,'Keep me');assert.equal(a.state().parkWishlist.length,0);
});
test('storage access blocked by the browser still allows editing and recovery UI',t=>{
  const a=app(t,{denyStorage:true});a.click('[data-view="all"]');a.click('#add-button');a.click('#add-manually');a.input('field-name','Unsaved credit');a.submit('ride-form');assert.equal(a.A.getState().rides[0].name,'Unsaved credit');assert.equal(a.doc.getElementById('storage-warning').hidden,false);
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
test('direct account changes never seed another account with private credits or wishes',t=>{
  const a=app(t);a.A.switchAccount('alice');a.A.change({rides:[C.ride({name:'Private credit'})],wishlist:[C.ride({name:'Private wish'})],parkWishlist:[{id:'private',name:'Private park'}]},'');
  a.A.switchAccount('bob');assert.equal(a.A.getState().rides.length,0);assert.equal(a.A.getState().wishlist.length,0);assert.equal(a.A.getState().parkWishlist.length,0);
  a.A.switchAccount('alice');assert.equal(a.A.getState().rides[0].name,'Private credit');
});
test('recovery metadata is escaped and account dialogs contain no operator setup instructions',t=>{
  const a=app(t),payload='<img src=x onerror="window.compromised=true">';
  a.w.localStorage.setItem('tracklist.recovery.v1',JSON.stringify([{owner:KEY,id:'safe',at:'2026-10-10T00:00:00.000Z',data:'{}',rides:payload,parks:payload,wishlist:payload}]));
  a.click('#backup-button');a.click('#open-recovery');assert.equal(a.doc.querySelector('#modal-content img'),null);assert(a.doc.getElementById('modal-content').textContent.includes(payload));
  a.click('#cloud-button');assert.doesNotMatch(a.doc.getElementById('modal-content').textContent,/Firebase|FIREBASE_SETUP|firebase-config|project|configuration/i);
});
test('recovery checkpoints restore a previous ranking including the wish list',t=>{
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
test('JSON keeps wish lists and new metadata; RCDB identity prevents duplicate imports',()=>{
  const state=C.normalize({version:1,rides:[{name:'New name',rcdb:'123',catalogId:'cp-1'}],wishlist:[{name:'Future',ranked:true}]});assert.equal(state.wishlist[0].ranked,false);assert.deepEqual(C.importText(JSON.stringify(state)),state);assert.equal(C.merge(state.rides,[C.ride({name:'Old name',rcdb:'123'})]).skipped,1);
  for(const url of ['javascript:alert(1)','https://rcdb.com.evil/1.htm','https://user@rcdb.com/1.htm'])assert.throws(()=>C.rcdbURL(url));
});
test('recovery failures do not block primary saving; history is bounded per account',()=>{
  const store=new Map(),storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
  for(let i=0;i<15;i++)R.save(storage,{rides:[{name:String(i)}]},'one',true);R.save(storage,{rides:[]},'two',true);assert.equal(R.list(storage,'one').length,10);assert.equal(R.list(storage,'two').length,1);
  assert.doesNotThrow(()=>R.save({getItem:()=>null,setItem:()=>{throw Error('quota');}},{rides:[]},'one',true));
});

const settle=()=>new Promise(r=>setImmediate(r));
test('saved parks persist through logging and JSON, account copies, and undo',t=>{
  const a=app(t);a.A.setView('explore');a.input('catalog-search','Cedar Point');a.click('[data-park-save]');assert.equal(a.state().parkWishlist.length,1);assert.equal(a.state().rides.length,0);
  assert.equal(a.doc.getElementById('collection-stats').hidden,true);a.A.setView('wishlist');assert.equal(a.doc.getElementById('collection-stats').hidden,true);a.click('[data-wish-park]');
  const record=a.w.TRACKLIST_CATALOG.rides.find(r=>r.name==='Steel Vengeance'&&r.park==='Cedar Point');a.click('#wishlist-panel [data-catalog-id="'+record.id+'"] [data-catalog-action="log"]');assert.equal(a.state().parkWishlist.length,1);assert.equal(a.state().rides.length,1);
  assert.equal(C.importText(JSON.stringify(a.state())).parkWishlist[0].name,'Cedar Point');a.A.switchAccount('new');assert.equal(a.state().parkWishlist.length,1);a.A.setView('wishlist');a.click('[data-park-remove]');assert.equal(a.state().parkWishlist.length,0);a.click('#undo-button');assert.equal(a.state().parkWishlist.length,1);a.A.setView('ranked');assert.equal(a.doc.getElementById('collection-stats').hidden,false);
});
test('each ride has one edit action and its RCDB link has visible text',t=>{
  const a=app(t);a.A.change({rides:[C.ride({name:'A ride',rcdb:'123'})]},'');const row=a.doc.querySelector('.ride-row');assert.equal(row.querySelectorAll('[data-action="edit"]').length,1);assert.equal(row.querySelector('[data-action="notes"]'),null);assert.equal(row.querySelector('.rcdb-link').textContent,'RCDB');assert.equal(a.doc.querySelector('a[href*="coaster-count"]'),null);
});
test('login, registration, account saving and logout have distinct controls',async t=>{
  const a=app(t,{mockAccount:true});assert.equal(a.doc.getElementById('login-button').hidden,false);assert.equal(a.doc.getElementById('logout-button').hidden,true);a.click('#login-button');assert.equal(a.doc.getElementById('modal-title').textContent,'Log in');a.click('#auth-register-tab');assert.equal(a.doc.getElementById('auth-submit').textContent,'Create account');
  a.input('cloud-email','alice@example.test');a.doc.querySelector('[name="password"]').value='test-password';a.submit('cloud-auth-form');await settle();assert.equal(a.mock.created,true);assert.equal(a.doc.getElementById('account-email').textContent,'alice@example.test');assert.equal(a.doc.getElementById('login-button').hidden,true);assert.equal(a.doc.getElementById('logout-button').hidden,false);assert.equal(a.doc.getElementById('cloud-top').textContent,'Account saved');assert.equal(a.doc.getElementById('save-status').hidden,true);
  a.A.change({parkWishlist:[{id:'cedarpoint',name:'Cedar Point'}]},'');await a.mock.controller().flush();assert.equal(a.mock.state().parkWishlist.length,1);a.click('#logout-button');await settle();assert.equal(a.doc.getElementById('logout-button').hidden,true);assert.equal(a.doc.getElementById('cloud-top').textContent,'Guest');assert.equal(a.doc.getElementById('save-status').hidden,false);
});
test('denied account access preserves edits and retry reconnects after rules are fixed',async t=>{
  const a=app(t,{mockAccount:true});a.mock.denied=true;a.A.change({rides:[C.ride({name:'Keep this credit'})]},'');a.click('#login-button');a.input('cloud-email','alice@example.test');a.doc.querySelector('[name="password"]').value='test-password';a.submit('cloud-auth-form');await settle();assert.equal(a.doc.getElementById('cloud-top').textContent,'Account save blocked');assert.equal(a.state().rides[0].name,'Keep this credit');
  a.mock.denied=false;a.click('#cloud-top');a.click('#sync-now');await settle();assert.equal(a.doc.getElementById('cloud-top').textContent,'Account saved');assert.equal(a.mock.state().rides[0].name,'Keep this credit');assert.equal(a.doc.getElementById('sync-warning').hidden,true);
});
