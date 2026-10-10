const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Coordinator,chunks}=require('../sync-model.js');
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function harness(t){
  let state={rides:['local']},head=null,online=true,count=0;const states=new Map(),writes=[];
  const adapter={watch(uid,cb){this.notify=cb;return ()=>{};},read:async(uid,h)=>states.get(h.revision),write:async(uid,base,revision,value)=>{
    if((head?.revision||null)!==base){const e=new Error('conflict');e.code='tracklist/conflict';e.head=head;throw e;}
    writes.push({uid,base,revision,value});states.set(revision,value);return head={revision};
  }};
  const c=new Coordinator({adapter,getState:()=>state,onRemote:s=>state=s,revision:()=>`r${++count}`,online:()=>online,emptyState:()=>({rides:[]}),merge:(r,l)=>({rides:[...new Set([...r.rides,...l.rides])]})});
  t.after(()=>c.detach());
  return {c,adapter,writes,states,get state(){return state;},set state(v){state=v;},get head(){return head;},set head(v){head=v;},set online(v){online=v;}};
}
test('empty cloud accepts initial collection; later edits use the last acknowledged revision',async t=>{
  const h=harness(t);h.c.attach('one',{dirty:true});await h.c.receive(null);await tick();assert.equal(h.c.status,'synced');assert.equal(h.writes.length,1);
  h.state={rides:['next']};h.c.changed();await h.c.flush();assert.equal(h.writes[1].base,'r1');assert.equal(h.c.dirty,false);
});
test('offline changes remain dirty until a successful upload',async t=>{
  const h=harness(t);h.c.attach('one');h.online=false;h.c.changed();await h.c.flush();assert.equal(h.c.status,'offline');assert.equal(h.c.dirty,true);assert.equal(h.writes.length,0);
  h.online=true;await h.c.flush();assert.equal(h.c.status,'synced');assert.equal(h.writes.length,1);
});
test('retry reconnects a failed watcher while retaining dirty revision metadata',t=>{
  const h=harness(t);let watches=0;h.adapter.watch=()=>{watches++;return()=>{};};h.c.attach('one',{base:'old',dirty:true});h.c.report('error','Rules denied');h.c.retry();assert.equal(watches,2);assert.equal(h.c.base,'old');assert.equal(h.c.dirty,true);assert.equal(h.c.status,'connecting');
});
test('simultaneous device edits stop at revision conflict; merge retains both collections',async t=>{
  const h=harness(t);h.c.attach('one',{base:'old'});h.head={revision:'other'};h.states.set('other',{rides:['remote']});h.c.changed();await h.c.flush();
  assert.equal(h.c.status,'conflict');assert.deepEqual(h.state.rides,['local']);assert.equal(h.writes.length,0);
  await h.c.resolve('merge');assert.equal(h.c.status,'synced');assert.deepEqual(h.state.rides,['remote','local']);assert.equal(h.writes[0].base,'other');
});
test('edits during an upload queue a second revision with the latest collection',async t=>{
  const h=harness(t),pending=deferred(),original=h.adapter.write;let first=true;
  h.adapter.write=async(...args)=>{if(first){first=false;await pending.promise;}return original(...args);};
  h.c.attach('one');h.c.changed();const save=h.c.flush();h.state={rides:['latest']};h.c.changed();pending.resolve();await save;await tick();
  assert.equal(h.writes.length,2);assert.deepEqual(h.writes[1].value.rides,['latest']);assert.equal(h.c.dirty,false);
});
test('a delayed listener event for the old head cannot roll back a completed save',async t=>{
  const h=harness(t),pending=deferred(),write=h.adapter.write;h.head={revision:'old'};h.states.set('old',{rides:['old cloud']});h.c.attach('one',{base:'old'});
  h.adapter.write=async(...args)=>{await pending.promise;return write(...args);};h.state={rides:['new edit']};h.c.changed();const saving=h.c.flush();await h.c.receive({revision:'old'});pending.resolve();await saving;await tick();assert.deepEqual(h.state.rides,['new edit']);assert.equal(h.c.base,'r1');assert.equal(h.c.status,'synced');
});
test('remote reads never overwrite edits made while the read is pending',async t=>{
  const h=harness(t),pending=deferred();h.adapter.read=()=>pending.promise;h.c.attach('one');const read=h.c.receive({revision:'remote'});
  h.state={rides:['edited']};h.c.changed();pending.resolve({rides:['cloud']});await read;assert.equal(h.c.status,'conflict');assert.deepEqual(h.state.rides,['edited']);
});
test('older remote reads and previous account completions are discarded',async t=>{
  const h=harness(t),one=deferred(),two=deferred();h.adapter.read=(uid,head)=>head.revision==='one'?one.promise:two.promise;h.c.attach('first');
  const a=h.c.receive({revision:'one'}),b=h.c.receive({revision:'two'});two.resolve({rides:['newest']});await b;one.resolve({rides:['stale']});await a;assert.deepEqual(h.state.rides,['newest']);
  const pending=deferred();h.adapter.read=()=>pending.promise;const read=h.c.receive({revision:'three'});h.c.attach('second');h.state={rides:['second account']};pending.resolve({rides:['first account']});await read;assert.deepEqual(h.state.rides,['second account']);assert.equal(h.c.base,null);
});
test('explicit cloud recovery also protects edits made during the download',async t=>{
  const h=harness(t),pending=deferred();h.c.attach('one',{dirty:true});await h.c.receive({revision:'other'});h.adapter.read=()=>pending.promise;
  const resolve=h.c.resolve('cloud');h.state={rides:['new edit']};h.c.changed();pending.resolve({rides:['old cloud']});await resolve;assert.deepEqual(h.state.rides,['new edit']);assert.equal(h.c.status,'conflict');
});
test('chunked snapshots survive Unicode boundaries and enforce the sync size limit',()=>{
  const state={notes:'x'.repeat(119988)+'🎢'.repeat(100000)},parts=chunks(state);assert(parts.length>1);assert.deepEqual(JSON.parse(parts.map(p=>Buffer.from(p,'utf8').toString('utf8')).join('')),state);
  assert.throws(()=>chunks({notes:'🎢'.repeat(1600000)}),/too large/);
});
