'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),M=require('./catalog/model.cjs');
const root=path.resolve(__dirname,'..');
function check(directory,stateFile){
  const data=fs.readFileSync(path.join(directory,'catalog.json'),'utf8'),catalog=M.validate(JSON.parse(data)),manifest=JSON.parse(fs.readFileSync(path.join(directory,'catalog-manifest.json'),'utf8'));
  if(manifest.schemaVersion!==1||manifest.sha256!==M.sha(data)||manifest.datasetVersion!==manifest.sha256.slice(0,16)||manifest.counts.rides!==catalog.rides.length||manifest.counts.parks!==catalog.parks.length||manifest.datasetChangedAt!==catalog.updatedAt)throw Error('Catalog manifest is inconsistent.');
  const bundle=fs.readFileSync(path.join(directory,'catalog-data.js'),'utf8'),expected=M.prepare(catalog,catalog.rides,catalog.parks,{checkedAt:manifest.lastCheckedAt,initialized:manifest.initialized,mode:manifest.mode});
  if(bundle!==expected.bundle)throw Error('Browser catalog differs from the JSON catalog.');
  if(stateFile){const state=JSON.parse(fs.readFileSync(stateFile,'utf8'));if(state.schemaVersion!==1||typeof state.initialized!=='boolean'||state.initialized!==manifest.initialized||state.view!=='latest'||Object.keys(state).some(k=>!['schemaVersion','initialized','view','cursor','lastSuccessfulAt','redirects'].includes(k))||(state.initialized&&(typeof state.cursor!=='string'||!state.cursor||state.cursor.length>8192||state.lastSuccessfulAt!==manifest.lastCheckedAt)))throw Error('Invalid catalog checkpoint.');if(!state.redirects||typeof state.redirects!=='object'||Array.isArray(state.redirects)||Object.entries(state.redirects).some(([a,b])=>!/^cp-\d+$/.test(a)||!/^cp-\d+$/.test(b)))throw Error('Invalid source redirects.');}
  return {catalog,manifest};
}
if(require.main===module){try{
  if(process.argv[2]==='--seed'){
    if(fs.existsSync(path.join(root,'catalog.json')))throw Error('The catalog is already seeded.');
    const sandbox={};vm.runInNewContext(fs.readFileSync(path.join(root,'catalog-data.js'),'utf8'),sandbox,{timeout:5000});const legacy=JSON.parse(JSON.stringify(sandbox.TRACKLIST_CATALOG));
    const K=require('../catalog.js'),parks=K.parks(legacy.rides).map(p=>({id:p.id,name:p.name,country:p.country,aliases:[],coordinates:null}));
    const prepared=M.prepare({...legacy,parks},legacy.rides,parks);
    fs.writeFileSync(path.join(root,'catalog.json'),prepared.encoded);fs.writeFileSync(path.join(root,'catalog-manifest.json'),M.json(prepared.manifest));fs.writeFileSync(path.join(root,'catalog-data.js'),prepared.bundle);
    fs.mkdirSync(path.join(root,'catalog-sync'),{recursive:true});fs.writeFileSync(path.join(root,'catalog-sync/state.json'),M.json({schemaVersion:1,initialized:false,view:'latest',cursor:null,redirects:{}}));
  }else if(process.argv[2]==='--apply'){
    const candidate=path.join(root,'test-results/catalog-candidate');check(candidate,path.join(candidate,'state.json'));
    if(JSON.parse(fs.readFileSync(path.join(candidate,'review.json'),'utf8')).allowPublication!==true)throw Error('Candidate requires an explicitly approved refresh.');
    for(const file of ['catalog.json','catalog-manifest.json','catalog-data.js'])fs.copyFileSync(path.join(candidate,file),path.join(root,file));
    fs.copyFileSync(path.join(candidate,'state.json'),path.join(root,'catalog-sync/state.json'));
  }else if(process.argv.length>2)throw Error('Unknown catalog-files argument.');
  check(root,path.join(root,'catalog-sync/state.json'));console.log('Catalog JSON, browser bundle, manifest and checkpoint agree.');
}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={check};
