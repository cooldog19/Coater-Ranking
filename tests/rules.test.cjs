// Runs only against a local emulator. No production credentials or production writes.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const project='demo-tracklist-security',origin='http://127.0.0.1:8180';
const database=`projects/${project}/databases/(default)`,base=`${origin}/v1/${database}/documents`;
function token(uid){
  const now=Math.floor(Date.now()/1000),encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  return [encode({alg:'none',typ:'JWT'}),encode({iss:`https://securetoken.google.com/${project}`,aud:project,sub:uid,user_id:uid,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'custom',identities:{}}}),''].join('.');
}
function value(data){
  if(typeof data==='boolean')return {booleanValue:data};
  if(typeof data==='string')return {stringValue:data};
  if(typeof data==='number')return {integerValue:String(data)};
  if(Array.isArray(data))return {arrayValue:{values:data.map(value)}};
  return {mapValue:{fields:fields(data)}};
}
const fields=data=>Object.fromEntries(Object.entries(data).map(([key,item])=>[key,value(item)]));
const update=(name,data)=>({update:{name:`${database}/documents/${name}`,fields:fields(data)}});
const remove=name=>({delete:`${database}/documents/${name}`});
async function request(path,uid,body,method=body?'POST':'GET'){
  const response=await fetch(`${base}${path}`,{method,headers:{'Content-Type':'application/json',...(uid?{Authorization:`Bearer ${token(uid)}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();return {status:response.status,data};
}
const commit=(uid,writes)=>request(':commit',uid,{writes});
const pathFor=(uid,rev)=>`users/${uid}/snapshots/${rev}`;
const entry=(rev,parts=1)=>({revision:rev,parts,at:'2026-10-10T00:00:00.000Z',rides:1,wishlist:0,parks:0});
function revision(uid,rev,history=[],parts=1){
  const item=entry(rev,parts),name=pathFor(uid,rev);
  return [update(name,item),...Array.from({length:parts},(_,i)=>update(`${name}/chunks/${i}`,{text:'{}'})),update(`users/${uid}/collections/main`,{...item,history:[item,...history].slice(0,10)})];
}
test('database rules enforce privacy, schema, immutable backups and valid atomic saves',async()=>{
  const loaded=await fetch(`${origin}/emulator/v1/projects/${project}:securityRules`,{method:'PUT',body:JSON.stringify({rules:{files:[{content:fs.readFileSync(path.resolve(__dirname,'../firestore.rules'),'utf8')}]}})});
  assert.equal(loaded.status,200,await loaded.text());
  const clear=await fetch(`${origin}/emulator/v1/${database}/documents`,{method:'DELETE'});assert.equal(clear.status,200,'Start the local emulator before running test:rules.');
  // Positive control ensures denied cases are security failures, not a broken server.
  assert.equal((await commit('alice',revision('alice','first'))).status,200);
  for(const uid of [null,'bob']){
    for(const path of ['/users/alice/collections/main','/users/alice/snapshots/first','/users/alice/snapshots/first/chunks/0'])assert.equal((await request(path,uid)).status,403);
    assert.equal((await commit(uid,revision('alice',`intrusion-${uid||'guest'}`))).status,403);
    assert.equal((await commit(uid,[remove('users/alice/collections/main')])).status,403);
  }
  assert.equal((await request('/users/alice/collections/main','alice')).status,200);
  assert.equal((await request('/users/alice/snapshots/first/chunks/0','alice')).status,200);
  assert.equal((await request('/users','alice')).status,403);
  assert.equal((await commit('alice',[update('users/alice/arbitrary/document',{text:'no'})])).status,403);
  assert.equal((await commit('alice',[update('users/alice/collections/other',{text:'no'})])).status,403);
  assert.equal((await commit('alice',[update('users/alice/snapshots/orphan',entry('orphan'))])).status,403);
  assert.equal((await commit('alice',[update('users/alice/snapshots/first/chunks/0',{text:'changed'})])).status,403);
  assert.equal((await commit('alice',[remove('users/alice/snapshots/first/chunks/0')])).status,403);
  assert.equal((await commit('alice',[remove('users/alice/collections/main')])).status,403);
  for(const corrupt of [writes=>{writes[0].update.fields.extra=value('unexpected');},writes=>{writes[0].update.fields.rides=value(5001);},writes=>{writes[1].update.fields.text=value('a'.repeat(120001));},writes=>{writes[1].update.fields.text=value(42);},writes=>{writes.at(-1).update.fields.history=value([entry('bad'),{revision:'injected',parts:1,at:'invalid',rides:'<img>',wishlist:0}]);}]){
    const writes=revision('alice','bad');corrupt(writes);assert.equal((await commit('alice',writes)).status,403);
    assert.equal((await request('/users/alice/snapshots/bad','alice')).status,404,'Denied atomic saves leave no partial snapshots.');
  }
  // Largest supported chunk count plus a full history exercises rule access/expression limits.
  const older=Array.from({length:9},(_,i)=>entry(`old-${i}`));
  const big=await commit('alice',revision('alice','large',older,60));assert.equal(big.status,200,JSON.stringify(big.data));
  assert.equal((await commit('alice',[remove('users/alice/snapshots/first/chunks/0'),remove('users/alice/snapshots/first')])).status,200);
  assert.equal((await commit('bob',revision('bob','mine'))).status,200);
  assert.equal((await request('/users/bob/collections/main','alice')).status,403);
  // Existing snapshots from earlier app versions remain readable and can seed a new revision.
  const legacy=entry('legacy');delete legacy.parks;
  const legacyWrites=[update('users/bob/snapshots/legacy',legacy),update('users/bob/snapshots/legacy/chunks/0',{text:'{}'}),update('users/bob/collections/main',{...legacy,history:[legacy]})];
  assert.equal((await commit('bob',legacyWrites)).status,200);
  assert.equal((await commit('bob',revision('bob','upgraded',[legacy]))).status,200);
  const C=require('../core.js'),Model=require('../sync-model.js');
  const unicode=C.normalize({version:1,rides:Array.from({length:30},(_,i)=>({name:`Ride ${i}`,notes:'🎢'.repeat(4000)}))}),chunks=Model.chunks(unicode),unicodeEntry={...entry('unicode',chunks.length),rides:30};
  const unicodeWrites=[update('users/bob/snapshots/unicode',unicodeEntry),...chunks.map((text,i)=>update(`users/bob/snapshots/unicode/chunks/${i}`,{text})),update('users/bob/collections/main',{...unicodeEntry,history:[unicodeEntry]})];
  const unicodeSave=await commit('bob',unicodeWrites);assert.equal(unicodeSave.status,200,JSON.stringify(unicodeSave.data));
});
test('social rules protect unique usernames, private friend lists and shared profile visibility',async()=>{
  const S=require('../social-model.js'),a='social-alice',b='social-bob',handle='airtime_alice';
  const settings={username:handle,visible:true,friendIds:[]};
  const claim=[update(`usernames/${handle}`,{uid:a}),update(`users/${a}/social/account`,settings),update(`profiles/${a}`,S.hidden(handle))];
  const first=await commit(a,claim);assert.equal(first.status,200,JSON.stringify(first.data));
  assert.equal((await commit(b,[update(`usernames/${handle}`,{uid:b}),update(`users/${b}/social/account`,settings)])).status,403,'Username cannot be stolen.');
  assert.equal((await commit(a,[update('usernames/extra_handle',{uid:a})])).status,403,'One account cannot reserve arbitrary extra names.');
  assert.equal((await commit(a,[remove(`usernames/${handle}`)])).status,403);
  assert.equal((await request(`/${`users/${a}/social/account`}`,b)).status,403);
  for(const uid of [null,b])assert.equal((await commit(uid,[update(`users/${a}/social/account`,{...settings,friendIds:[b]})])).status,403);
  for(const p of [`/usernames/${handle}`,`/profiles/${a}`]){assert.equal((await request(p,null)).status,403);assert.equal((await request(p,b)).status,200);}
  for(const p of ['/usernames','/profiles',`/users/${a}/social`])assert.equal((await request(p,b)).status,403,'Directory listing is not allowed.');
  assert.equal((await commit(a,revision(a,'private-one'))).status,200);
  const publicData=S.project({version:1,rides:[{id:'ride',name:'Shared credit',ranked:true,park:'Park',notes:'PRIVATE NOTE',riddenOn:'2026-01-01'}]});
  const shared={username:handle,visible:true,revision:'public-one',sourceRevision:'private-one',parts:1,at:'2026-10-10T00:00:00.000Z',...S.stats(publicData)};
  const chunk=`profiles/${a}/versions/public-one/chunks/0`;
  const publish=await commit(a,[update(chunk,{text:JSON.stringify(publicData)}),update(`profiles/${a}`,shared)]);assert.equal(publish.status,200,JSON.stringify(publish.data));
  assert.equal((await request('/'+chunk,b)).status,200);assert.equal((await request('/'+chunk,null)).status,403);
  assert.equal((await request(`/users/${a}/snapshots/private-one/chunks/0`,b)).status,403,'Shared profiles never grant private snapshot access.');
  assert.equal((await commit(b,[update(`profiles/${a}`,shared)])).status,403);
  assert.equal((await commit(a,[update(`profiles/${a}`,{...shared,email:'private@example.test'})])).status,403);
  assert.equal((await commit(a,[update(`profiles/${a}`,{...shared,credits:5001})])).status,403);
  assert.equal((await commit(a,[update(chunk,{text:'overwrite'})])).status,403);
  assert.equal((await commit(a,[remove(chunk)])).status,403,'Active shared chunks cannot be deleted.');
  assert.equal((await commit(a,[update(`profiles/${a}/versions/orphan/chunks/0`,{text:'{}'})])).status,403);
  assert.equal((await commit(a,[update(`users/${a}/social/account`,{...settings,friendIds:[b]})])).status,200);
  assert.equal((await commit(a,[update(`users/${a}/social/account`,{...settings,friendIds:Array(501).fill(b)})])).status,403);
  assert.equal((await commit(a,[update(`users/${a}/social/account`,{...settings,username:'someone_else'})])).status,403);
  assert.equal((await commit(a,[update(`users/${a}/social/account`,{...settings,visible:false})])).status,403,'Hiding cannot leave a shared profile readable.');
  const hidden=await commit(a,[update(`users/${a}/social/account`,{...settings,visible:false}),update(`profiles/${a}`,S.hidden(handle))]);assert.equal(hidden.status,200,JSON.stringify(hidden.data));
  assert.equal((await request('/'+chunk,b)).status,403);assert.equal((await request('/'+chunk,a)).status,403,'Inactive public copies are unreadable.');
  assert.equal((await commit(a,[remove(chunk)])).status,200,'Inactive public copies can be cleaned up.');
  assert.equal((await commit(a,revision(a,'private-two',[entry('private-one')]))).status,200);
  assert.equal((await commit(a,[update(`users/${a}/social/account`,settings),update(`profiles/${a}`,{...shared,revision:'stale'})])).status,403,'Stale public publication is denied.');
  const large={...shared,revision:'public-large',sourceRevision:'private-two',parts:60};
  const writes=[update(`users/${a}/social/account`,settings),...Array.from({length:60},(_,i)=>update(`profiles/${a}/versions/public-large/chunks/${i}`,{text:'{}'})),update(`profiles/${a}`,large)];
  const maximum=await commit(a,writes);assert.equal(maximum.status,200,JSON.stringify(maximum.data));
  assert.equal((await request(`/${`profiles/${a}/versions/public-large/chunks/59`}`,b)).status,200);
});
