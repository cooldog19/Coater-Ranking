const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../core.js'),Model=require('../sync-model.js');
async function cloud(){
  const docs=new Map(),sdk={};let user=null;
  const snap=ref=>({exists:()=>docs.has(ref),data:()=>docs.get(ref)});
  sdk.app={initializeApp:()=>({})};
  sdk.auth={getAuth:()=>({currentUser:user}),browserLocalPersistence:'local',setPersistence:async()=>{},onAuthStateChanged:()=>{},signOut:async()=>{user=null;}};
  sdk.store={getFirestore:()=>({}),doc:(db,...parts)=>parts.join('/'),getDocFromServer:async ref=>snap(ref),onSnapshot:()=>()=>{},runTransaction:async(db,callback)=>{
    const pending=[];const result=await callback({get:async ref=>snap(ref),set:(ref,value)=>pending.push([ref,value])});pending.forEach(([ref,value])=>docs.set(ref,value));return result;
  },writeBatch:()=>{const refs=[];return {delete:ref=>refs.push(ref),commit:async()=>refs.forEach(ref=>docs.delete(ref))};}};
  const context={Tracklist:C,TracklistSyncModel:Model,TRACKLIST_FIREBASE_CONFIG:{apiKey:'test',projectId:'test',authDomain:'test',appId:'test'},mockSDK:sdk,navigator:{onLine:true},TextEncoder,console,setTimeout,clearTimeout};
  vm.createContext(context);let source=fs.readFileSync(require.resolve('../cloud.js'),'utf8');source=source.replace("import(base+'firebase-app.js')","Promise.resolve(mockSDK.app)").replace("import(base+'firebase-auth.js')","Promise.resolve(mockSDK.auth)").replace("import(base+'firebase-firestore.js')","Promise.resolve(mockSDK.store)");vm.runInContext(source,context);
  context.TracklistCloud.init({getState:()=>({}),onAccount:()=>({})});await context.TracklistCloud.start();return {adapter:context.TracklistCloud.adapter,docs};
}
test('Firebase adapter stores chunked snapshots atomically under the signed-in UID',async()=>{
  const {adapter,docs}=await cloud(),state=C.normalize({version:1,rides:Array.from({length:30},(_,i)=>({name:`Ride ${i}`,notes:'🎢'.repeat(4000)}))});
  const head=await adapter.write('alice',null,'first',state);assert(head.parts>1);assert([...docs.keys()].every(p=>p.startsWith('users/alice/')));assert.equal(JSON.stringify(await adapter.read('alice',head)),JSON.stringify(state));
  await assert.rejects(adapter.write('alice',null,'stale',state),e=>e.code==='tracklist/conflict');assert.equal(docs.get('users/alice/collections/main').revision,'first');assert.equal(docs.has('users/alice/snapshots/stale'),false);
  docs.delete('users/alice/snapshots/first/chunks/0');await assert.rejects(adapter.read('alice',head),/incomplete/);
});
test('cloud history retains ten revisions and cleans up only older snapshots after saving',async()=>{
  const {adapter,docs}=await cloud();let base=null;
  for(let i=0;i<12;i++){const head=await adapter.write('alice',base,`v${i}`,C.normalize({version:1,rides:[{name:String(i)}]}));base=head.revision;}
  const history=await adapter.history('alice');assert.equal(history.length,10);assert.equal(history[0].revision,'v11');assert.equal(history.at(-1).revision,'v2');assert.equal(docs.has('users/alice/snapshots/v0'),false);assert.equal(docs.has('users/alice/snapshots/v1/chunks/0'),false);assert.equal(docs.size,21);
});
