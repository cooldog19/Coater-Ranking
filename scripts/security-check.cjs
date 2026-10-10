// Conservative deployment/repository scan. Findings print locations, never credential values.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const git=(args,input)=>execFileSync('git',args,{cwd:root,input,maxBuffer:100*1024*1024});
const publicKey=fs.readFileSync(path.join(root,'firebase-config.js'),'utf8').match(/apiKey:\s*['"]([^'"]+)/)?.[1];
const checks=[
  ['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['service account',/"type"\s*:\s*"service_account"/],
  ['GitHub token',/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{60,})/],
  ['AWS access key',/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['machine home path',/(?:[A-Za-z]:[\\/]+[Uu]sers[\\/]+[^\s"'<>]+|\/Users\/[^\s"'<>]+|\/home\/[^\s"'<>]+)/],
  ['credential-bearing URL',/https?:\/\/[^\s/:'"]+:[^\s/@'"]+@/i],
];
let scanned=0;const findings=[];
function scan(name,text,version='working tree'){
  scanned++;
  for(const [label,pattern] of checks){
    const matches=[...text.matchAll(new RegExp(pattern.source,pattern.flags+'g'))];
    // Explicit fictional credentials appear only in negative link-validation test fixtures.
    if(matches.some(match=>!(label==='credential-bearing URL'&&name.startsWith('tests/')&&/^https:\/\/user:(?:pass|password)@$/.test(match[0]))))findings.push(`${version}: ${name} (${label})`);
  }
  for(const match of text.matchAll(/\bAIza[A-Za-z0-9_-]{35}\b/g))if(!(name==='firebase-config.js'&&match[0]===publicKey))findings.push(`${version}: ${name} (unapproved API key)`);
}
for(const name of git(['ls-files','--cached','--others','--exclude-standard','-z']).toString().split('\0').filter(Boolean)){
  const file=path.join(root,name);if(fs.existsSync(file)&&fs.statSync(file).isFile())scan(name,fs.readFileSync(file,'utf8'));
}
if(process.argv.includes('--history')){
  const objects=git(['rev-list','--objects','--all']).toString().trim().split('\n').map(line=>{const i=line.indexOf(' ');return {id:i<0?line:line.slice(0,i),name:i<0?'':line.slice(i+1)};});
  const buffer=git(['cat-file','--batch'],objects.map(o=>o.id).join('\n')+'\n');let offset=0;
  for(const object of objects){
    const end=buffer.indexOf(10,offset),header=buffer.subarray(offset,end).toString().split(' '),size=Number(header[2]);offset=end+1;
    if(header[1]==='blob')scan(object.name,buffer.subarray(offset,offset+size).toString(),`history ${object.id.slice(0,8)}`);
    offset+=size+1;
  }
}
const dist=path.join(root,'dist');
if(fs.existsSync(dist))for(const name of fs.readdirSync(dist)){
  if(!/^(?:index\.html|(?:styles|features)\.css|(?:core|app|catalog-data|catalog|migration|recovery|firebase-config|sync-model|cloud|features)\.js|favicon\.svg|CATALOG_LICENSE\.md|\.nojekyll)$/.test(name))findings.push(`build: ${name} (unexpected deployed file)`);
  else scan(name,fs.readFileSync(path.join(dist,name),'utf8'),'build');
}
if(findings.length){console.error(findings.join('\n'));process.exitCode=1;}
else console.log(`Security scan passed: ${scanned} files/blobs. Only approved public Firebase client configuration is allowed.`);
