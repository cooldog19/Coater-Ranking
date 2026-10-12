const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{spawn}=require('node:child_process');
let stage='local assets';
const server=spawn(process.execPath,['scripts/serve.cjs'],{env:{...process.env,PORT:'4184'},stdio:['ignore','pipe','pipe']});
const ready=new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Test server startup timed out.')),10000);
  server.stdout.once('data',()=>{clearTimeout(timeout);resolve();});
  server.once('error',()=>{clearTimeout(timeout);reject(Error('Test server could not start.'));});
  server.once('exit',()=>{clearTimeout(timeout);reject(Error('Test server exited before verification.'));});
});
(async()=>{
  await ready;
  const origin='http://127.0.0.1:4184',html=await(await fetch(origin)).text();assert.match(html,/Content-Security-Policy/);
  for(const file of ['index.html','styles.css','features.css','comparison.css','comparison-model.js','comparison.js','social.css','social-model.js','social.js','statistics.css','statistics-model.js','statistics.js','park-map-data.js','MAP_LICENSE.md','core.js','app.js','catalog-data.js','catalog.js','migration.js','recovery.js','firebase-config.js','sync-model.js','cloud.js','features.js','favicon.svg','CATALOG_LICENSE.md'])assert.equal((await fetch(`${origin}/${file}`)).status,200,file);
  for(const file of ['.git/config','.env','package-lock.json','FIREBASE_SETUP.md','firestore.rules','scripts/build.cjs','..%2FREADME.md'])assert.equal((await fetch(`${origin}/${file}`)).status,404,file);
  const context={};vm.createContext(context);vm.runInContext(fs.readFileSync('firebase-config.js','utf8'),context);
  const project=context.TRACKLIST_FIREBASE_CONFIG.projectId;
  stage='production anonymous read';
  const unauth=await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/users/security-release-probe/collections/main`);
  assert.equal(unauth.status,403,'Production must reject unauthenticated collection reads.');
  console.log('Public assets responded correctly; private/development paths returned 404. Production rejected an anonymous database read (403).');
})().catch(error=>{console.error(`${stage}: ${error.message}${error.cause?.code?' ('+error.cause.code+')':''}`);process.exitCode=1;}).finally(()=>server.kill());
