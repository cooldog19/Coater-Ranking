#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {Coasterpedia}=require('./catalog/api.cjs'),{refresh}=require('./catalog/pipeline.cjs'),M=require('./catalog/model.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results/catalog-candidate');
async function run(){
  const flags=process.argv.slice(2);if(flags.some(f=>!['--bootstrap','--approve-large-change'].includes(f)))throw Error('Unknown refresh argument.');
  // Clear stale candidates first, so an unsuccessful fetch cannot publish an older candidate.
  fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
  require('./catalog-files.cjs').check(root,path.join(root,'catalog-sync/state.json'));
  const previous=M.validate(JSON.parse(fs.readFileSync(path.join(root,'catalog.json'),'utf8'))),state=JSON.parse(fs.readFileSync(path.join(root,'catalog-sync/state.json'),'utf8'));
  const result=await refresh({api:new Coasterpedia({key:process.env.COASTERPEDIA_API_KEY}),previous,state,bootstrap:flags.includes('--bootstrap')});
  result.report.allowPublication=!result.report.requiresApproval||flags.includes('--approve-large-change');
  fs.writeFileSync(path.join(out,'review.json'),M.json(result.report));
  const summary=[`Catalog refresh: ${result.report.mode}`,`${result.report.before} → ${result.report.after} rides`,`${result.report.added.length} added, ${result.report.removed.length} removed, ${result.report.statusChanges.length} status changes`,...result.report.warnings,...result.report.normalizationWarnings].join('\n');
  fs.writeFileSync(path.join(out,'review.txt'),summary+'\n');console.log(summary);
  fs.writeFileSync(path.join(out,'catalog.json'),result.encoded);fs.writeFileSync(path.join(out,'catalog-manifest.json'),M.json(result.manifest));
  fs.writeFileSync(path.join(out,'catalog-data.js'),result.bundle);fs.writeFileSync(path.join(out,'state.json'),M.json(result.state));
  if(!result.report.allowPublication)throw Error('Large change held for review. Inspect the report and explicitly approve a manual run.');
  console.log('Candidate prepared. Published files have not been changed.');
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
