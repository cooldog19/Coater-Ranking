const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {JSDOM}=require('jsdom'),C=require('../core.js'),K=require('../catalog.js'),M=require('../migration.js');
const root=path.resolve(__dirname,'..');
test('CSV protects spreadsheet users from formula cells; JSON preserves original text',()=>{
  const ride=C.ride({name:'=HYPERLINK("https://example.test")',park:'+SUM(1)',notes:'@command'}),rows=C.parseCSV(C.exportCSV([ride]));
  assert(rows[1][0].startsWith("'="));assert(rows[1][1].startsWith("'+"));assert(rows[1][6].startsWith("'@"));
  assert.equal(C.importText(JSON.stringify({version:1,rides:[ride]})).rides[0].notes,ride.notes);
});
test('imports reject invalid wish lists and external links with unsafe schemes, hosts or ports',()=>{
  assert.throws(()=>C.normalize({version:1,rides:[],wishlist:{name:'Dropped data'}}),/Invalid ride wish list/);
  for(const link of ['javascript:alert(1)','https://youtube.com.evil.test/watch','https://user:pass@youtube.com/watch','https://youtube.com:8443/watch'])assert.throws(()=>C.povURL(link));
  for(const link of ['https://rcdb.com:8443/1.htm','https://rcdb.com/1.htm?redirect=evil'])assert.throws(()=>C.rcdbURL(link));
});
test('HTML imports parse in an inert template and never insert imported executable elements',()=>{
  const dom=new JSDOM('',{url:'https://example.test',runScripts:'dangerously'}),w=dom.window;let captured;
  const create=w.Document.prototype.createElement;
  w.Document.prototype.createElement=function(name){const el=create.call(this,name);if(name==='template')captured=el;return el;};
  const result=M.parse('<img src="https://example.test/private"><iframe src="https://example.test/frame"></iframe><script>window.compromised=true</script><table><tr><th>Name</th></tr><tr><td>Safe ride</td></tr></table>',C,K,w.DOMParser,[]);
  assert.equal(result[0].ride.name,'Safe ride');assert(captured.content.querySelector('script'));assert.equal(w.compromised,undefined);assert.equal(w.document.querySelector('img,iframe,script'),null);dom.window.close();
});
test('build discards unexpected stale files and deploys only an explicit public asset list',()=>{
  const dist=path.join(root,'dist');fs.mkdirSync(dist,{recursive:true});fs.writeFileSync(path.join(dist,'private-stale.txt'),'test fixture');
  execFileSync(process.execPath,['scripts/build.cjs'],{cwd:root});
  assert.equal(fs.existsSync(path.join(dist,'private-stale.txt')),false);
  assert.equal(fs.existsSync(path.join(dist,'firestore.rules')),false);assert.equal(fs.existsSync(path.join(dist,'package-lock.json')),false);
  const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
  assert.match(html,/Content-Security-Policy/);assert.match(html,/object-src 'none'/);assert.match(html,/form-action 'none'/);
  assert.equal(/<script[^>]*>\s*[^<\s]/.test(html),false);
});
test('all catalog links use permitted HTTPS destinations without embedded credentials',()=>{
  const vm=require('node:vm'),context={};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'catalog-data.js'),'utf8'),context);
  for(const ride of context.TRACKLIST_CATALOG.rides){
    if(ride.rcdb)assert.doesNotThrow(()=>C.rcdbURL(ride.rcdb));
    if(ride.pov)assert.doesNotThrow(()=>C.povURL(ride.pov));
    if(ride.source){const url=new URL(ride.source);assert.equal(url.protocol,'https:');assert(['coasterpedia.net','www.wikidata.org'].includes(url.hostname));assert.equal(url.username+url.password+url.port,'');}
  }
});
