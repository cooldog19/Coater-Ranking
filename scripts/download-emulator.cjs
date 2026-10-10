// Test-only download, checked against the official firebase-tools v14.0.0 manifest.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
(async()=>{
  const out=path.resolve(__dirname,'../test-results/emulator/firestore.jar');
  fs.mkdirSync(path.dirname(out),{recursive:true});
  const response=await fetch('https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v1.19.8.jar');
  if(!response.ok)throw Error('Emulator download failed.');
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length!==63634791||crypto.createHash('md5').update(bytes).digest('hex')!=='9b43a6daa590678de9b7df6d68260395')throw Error('Emulator integrity mismatch.');
  fs.writeFileSync(out,bytes);console.log('Official Firestore emulator downloaded and verified.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
