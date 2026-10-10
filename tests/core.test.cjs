const {test} = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');
const rides = () => ['A','B','C','D','E'].map(name => C.ride({id:name,name,park:'Park',ranked:true}));
test('exact moves in both directions and from unranked preserve every ride', () => {
  let list = C.move(rides(), ['A'], 5);
  assert.deepEqual(list.map(r=>r.name), ['B','C','D','E','A']);
  list = C.move(list,['A'],1);
  assert.deepEqual(list.map(r=>r.name),['A','B','C','D','E']);
  list = C.unrank(list,['C']);
  assert.equal(list.at(-1).ranked,false);
  list = C.move(list,['C'],2);
  assert.deepEqual(list.map(r=>r.name),['A','C','B','D','E']);
  assert(list.every(r=>r.ranked));
});
test('bulk moves retain collection order and place the first selected ride at the requested rank', () => {
  assert.deepEqual(C.move(rides(),['D','B'],1).map(r=>r.name),['B','D','A','C','E']);
  assert.deepEqual(C.move(rides(),['B','D'],4).map(r=>r.name),['A','C','E','B','D']);
  assert.deepEqual(C.move(rides(),['A','B','C','D','E'],1).map(r=>r.name),['A','B','C','D','E']);
});
test('JSON and CSV round trips preserve notes, Unicode, POVs, ranks, dates and unranked rides', () => {
  const list = [C.ride({name:'Ride, "One"',park:'Pärk',notes:'First line\nSecond, "line"',pov:'https://youtu.be/abc',riddenOn:'2025-01-02'}),C.ride({name:'Two',ranked:false})];
  const original=C.normalize({version:1,rides:list});
  assert.deepEqual(C.importText(JSON.stringify(original),'backup.json'),original);
  const imported=C.importText(C.exportCSV(list),'backup.csv');
  assert.deepEqual(imported.rides.map(({id,...rest})=>rest),original.rides.map(({id,...rest})=>rest));
});
test('compatible CSV headers and explicit ranking order are recognized', () => {
  const result=C.importText('Coaster Name,Park Name,Ranking\nThird,Park,3\nInbox,Park,\nFirst,Park,1','rides.csv');
  assert.deepEqual(result.rides.map(r=>r.name),['First','Third','Inbox']);
  assert.equal(result.rides.at(-1).ranked,false);
  assert.equal(C.importText('Ride;Park\nA;B','rides.csv').rides[0].park,'B');
  assert.equal(C.importText('Name\tPark\nA\tB','rides.tsv').rides[0].park,'B');
});
test('merge skips case-insensitive name and park duplicates without replacing personal data', () => {
  const existing = [C.ride({id:'collision',name:'Ride',park:'Park',notes:'Keep me'})];
  const incoming = [C.ride({name:'ride',park:'PARK',notes:'Imported'}),C.ride({id:'collision',name:'New'})];
  const merged=C.merge(existing,incoming);
  assert.equal(merged.added,1);assert.equal(merged.skipped,1);assert.equal(merged.rides[0].notes,'Keep me');
  assert.equal(new Set(merged.rides.map(r=>r.id)).size,2);
});
test('invalid imports and unsafe links fail before any collection is changed', () => {
  for (const text of ['{"version":99,"rides":[]}', '{bad json', 'Park,Type\nA,Steel', 'Name,Park\nA', 'Name,Park\n"A,B', 'Name,Rank\nA,-1', 'Name,Rank\nA,1.5', 'Name,POV\nA,javascript:alert(1)']) {
    assert.throws(()=>C.importText(text));
  }
  assert.throws(()=>C.povURL('https://youtube.com.evil.example/watch'));
  assert.throws(()=>C.povURL('https://user:password@youtube.com/watch'));
  assert.throws(()=>C.normalize({version:1,rides:[{name:''}]}));
  assert.throws(()=>C.normalize({version:1,rides:Array(5001).fill({name:'A'})}));
});
test('normalization repairs duplicate identifiers and canonicalizes ranked rides', () => {
  const state=C.normalize({version:1,rides:[{id:'x',name:'Unranked',ranked:false},{id:'x',name:'Ranked'}]});
  assert.equal(state.rides[0].name,'Ranked');assert.notEqual(state.rides[0].id,state.rides[1].id);
});
