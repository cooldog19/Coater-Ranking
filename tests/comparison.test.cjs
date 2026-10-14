const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {JSDOM} = require('jsdom');
const C = require('../core.js'), Q = require('../comparison-model.js');
const root = path.resolve(__dirname,'..'), KEY = 'tracklist.collection.v1';
const ride = (id,ranked = true,extra = {}) => C.ride({id,name:id,park:'Test park',ranked,...extra});
function app(t,rides,{quiz,account,quota=false,features=false} = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://example.test/Tracklist/',runScripts:'outside-only',pretendToBeVisual:true});
  const w = dom.window, errors = [], d = w.document;
  w.addEventListener('error',e=>errors.push(e.error));
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.localStorage.setItem(KEY,JSON.stringify({version:1,rides}));
  if(quiz)w.localStorage.setItem(KEY+'.comparison',typeof quiz==='string'?quiz:JSON.stringify(quiz));
  if(account)w.localStorage.setItem(KEY+'.other',JSON.stringify({version:1,rides:account}));
  if(quota){const set=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(k,v){if(k.endsWith('.comparison'))throw new Error('Storage full');return set.call(this,k,v);};}
  const files=features?['core.js','catalog-data.js','catalog.js','migration.js','recovery.js','sync-model.js','cloud.js','app.js','features.js','comparison-model.js','comparison.js']:['core.js','app.js','comparison-model.js','comparison.js'];
  for(const file of files)w.eval(fs.readFileSync(path.join(root,file),'utf8'));
  t.after(()=>{w.close();assert.deepEqual(errors,[],'No uncaught UI errors');});
  const click=selector=>{const b=d.querySelector(selector);assert(b,selector);b.click();};
  return {w,d,click,state:()=>JSON.parse(JSON.stringify(w.TracklistApp.getState())),session:()=>JSON.parse(w.localStorage.getItem(w.TracklistApp.getStorageKey()+'.comparison')),answer:value=>click(`[data-comparison-answer="${value}"]`),ranked:()=>JSON.parse(JSON.stringify(w.TracklistApp.getState().rides.filter(r=>r.ranked).map(r=>r.id)))};
}
function place(a,destination,{strong=false}={}) {
  let steps=0;const index=a.session()?.index;
  while(a.session() && a.session().index===index) {
    const s=a.session(), refs=s.mode==='full'?s.placed:a.state().rides.filter(r=>r.ranked&&r.id!==s.queue[s.index]).map(r=>r.id);
    const search=Q.search(refs.length,s.answers);
    a.answer(destination<=search.pivot?(strong?'much-better':'better'):(strong?'much-worse':'worse'));
    assert(++steps<65);
  }
  return steps;
}
test('binary insertion finds every position with logarithmic comparisons',()=>{
  for(const count of [0,1,2,3,10,99,500])for(let position=0;position<=count;position++){
    const answers=[];let s=Q.search(count);
    while(!s.done){answers.push(position<=s.pivot?'better':'worse');s=Q.search(count,answers);}
    assert.equal(s.position,position);assert(answers.length<=Math.ceil(Math.log2(count+1)));
  }
});
test('strong answers jump toward the edge without excluding an untested position',()=>{
  for(const count of [1,7,100,5000])for(const position of [0,1,Math.floor(count/2),count-1,count]){
    const answers=[];let s=Q.search(count);
    while(!s.done){answers.push(position<=s.pivot?'much-better':'much-worse');s=Q.search(count,answers);assert(s.low<=position&&s.high>=position);}
    assert.equal(s.position,position);assert(answers.length<=64);
    if(count===5000&&(position===0||position===count))assert(answers.length<=7);
  }
  assert(Q.search(500,['much-better']).pivot<Q.search(500,['better']).pivot);
  assert(Q.search(500,['much-worse']).pivot>Q.search(500,['worse']).pivot);
  assert.throws(()=>Q.search(5,['tie']));assert.throws(()=>Q.search(0,['better']));assert.throws(()=>Q.search(5001));
});
test('full rebuild orders processed slots and preserves unprocessed rides and metadata',()=>{
  const rides=[ride('a',true,{notes:'Keep notes'}),ride('b'),ride('c'),ride('d',false)];
  const next=Q.weave(rides,['d','c','a']);
  assert.deepEqual(next.map(r=>r.id),['d','b','c','a']);
  assert(next.every(r=>r.ranked));assert.equal(next.find(r=>r.id==='a').notes,'Keep notes');
  assert.deepEqual(rides.map(r=>r.id),['a','b','c','d']);assert.equal(rides[3].ranked,false);
});
test('queue automatically saves final answers and advances without a confirmation',t=>{
  const a=app(t,[ride('a'),ride('b'),ride('c'),ride('x',false,{notes:'Remember this'}),ride('y',false)]);
  a.click('#compare-button');a.click('#comparison-unranked');
  const before=a.state();a.answer('much-better');assert.deepEqual(a.state(),before);
  a.click('#comparison-back');assert.equal(a.session().answers.length,0);
  place(a,0);assert.equal(a.ranked()[0],'x');assert.equal(a.session().index,1);
  assert.equal(a.d.getElementById('comparison-save'),null);
  place(a,4);assert.deepEqual(a.ranked(),['x','a','b','c','y']);assert.equal(a.session(),null);
  assert.match(a.d.getElementById('modal-title').textContent,/complete/);
  assert.equal(a.state().rides.find(r=>r.id==='x').notes,'Remember this');
  a.click('#comparison-done');a.click('#undo-button');assert.equal(a.state().rides.find(r=>r.id==='y').ranked,false);
});
test('rank button reranks a ranked ride without self-comparison; unchanged answers can be canceled',t=>{
  const a=app(t,[ride('a'),ride('b'),ride('c'),ride('d')]);
  a.w.TracklistApp.rankModal('d');a.click('#rank-compare');
  assert.equal(a.d.querySelectorAll('.comparison-card h3').length,2);
  assert.notEqual(a.d.querySelectorAll('.comparison-card h3')[1].textContent,'d');
  a.answer('better');a.click('#comparison-pause');assert.deepEqual(a.ranked(),['a','b','c','d']);
  a.click('#compare-button');a.click('#comparison-resume');place(a,0);
  assert.deepEqual(a.ranked(),['d','a','b','c']);
});
test('a ride reaches the top of a 500-ride ranking in a handful of UI comparisons',t=>{
  const a=app(t,[...Array.from({length:500},(_,i)=>ride('reference-'+i)),ride('new-credit',false)]);
  a.w.TracklistQuiz.start({mode:'single',ids:['new-credit']});
  const count=place(a,0,{strong:true});assert(count<=5);assert.equal(a.ranked()[0],'new-credit');assert.equal(a.state().rides.length,501);
});
test('comprehensive ranking builds a new order, pauses safely, and includes formerly unranked credits',t=>{
  const a=app(t,[ride('a'),ride('b'),ride('c'),ride('d',false)]);
  a.click('#compare-button');a.click('#comparison-full');
  assert.equal(a.session().index,1);assert.equal(a.d.getElementById('comparison-save'),null);assert.deepEqual(a.ranked(),['a','b','c']);
  place(a,0);assert.deepEqual(a.ranked(),['b','a','c']);
  a.click('#comparison-pause');
  const b=app(t,a.state().rides,{quiz:a.session()});b.click('#compare-button');b.click('#comparison-resume');
  place(b,1);place(b,0);
  assert.deepEqual(b.ranked(),['d','b','c','a']);assert.equal(b.state().rides.length,4);
});
test('skip preserves a ride’s ranking status while an empty rebuild starts automatically',t=>{
  const a=app(t,[ride('a'),ride('b'),ride('c',false)]);
  a.w.TracklistQuiz.start({mode:'full'});a.click('#comparison-skip');a.click('#comparison-skip');
  assert.deepEqual(a.ranked(),['a','b']);assert.equal(a.state().rides.find(r=>r.id==='c').ranked,false);assert.match(a.d.getElementById('modal-content').textContent,/2 skipped/);
  a.w.TracklistQuiz.start({mode:'full'});a.click('#comparison-skip');place(a,0);
  assert.deepEqual(a.ranked(),['c','b','a']);
});
test('pending answers resume after reload; progress stays isolated per account',t=>{
  const a=app(t,[ride('a'),ride('b'),ride('c'),ride('x',false)],{account:[ride('other')]});
  a.w.TracklistQuiz.start();a.answer('worse');
  const b=app(t,a.state().rides,{quiz:a.session()});b.click('#compare-button');b.click('#comparison-resume');
  assert.deepEqual(b.session().answers,['worse']);
  a.w.TracklistApp.switchAccount('other');assert.equal(a.session(),null);assert.equal(a.d.getElementById('compare-button').textContent,'Rank by comparison');
  a.w.TracklistApp.switchAccount(null);assert.deepEqual(a.session().answers,['worse']);
});
test('stale ranking changes and corrupt sessions cannot apply outdated comparisons',t=>{
  const a=app(t,[ride('a'),ride('b'),ride('x',false)]);a.w.TracklistQuiz.start();a.answer('better');
  a.w.TracklistApp.change({rides:C.move(a.state().rides,['b'],1)},'Moved');
  assert.equal(a.session(),null);assert.equal(a.d.getElementById('modal').open,false);
  const b=app(t,a.state().rides,{quiz:'{bad'});assert.equal(b.session(),null);b.click('#compare-button');b.click('#comparison-unranked');assert(b.session());
  const invalid={...b.session(),answers:['unexpected']};const c=app(t,b.state().rides,{quiz:invalid});assert.equal(c.session(),null);
  const stale={...b.session(),expected:'old'};const d=app(t,b.state().rides,{quiz:stale});assert.equal(d.session(),null);
});
test('new rides can be added directly to the quiz, including batch additions',t=>{
  const a=app(t,[ride('a'),ride('b')]);a.click('[data-view="all"]');a.click('#add-button');a.d.getElementById('field-name').value='New ride';
  a.click('#add-compare');assert.equal(a.state().rides.find(r=>r.name==='New ride').ranked,false);assert(a.d.getElementById('comparison-session'));
  place(a,1);assert.deepEqual(a.state().rides.filter(r=>r.ranked).map(r=>r.name),['a','New ride','b']);
  a.click('#comparison-done');a.click('[data-view="all"]');a.click('#add-button');a.click('#multiple-tab');a.d.getElementById('field-names').value='One | Park\nTwo | Park';a.click('#add-compare');
  assert.equal(a.session().queue.length,2);assert(a.state().rides.slice(-2).every(r=>!r.ranked));
});
test('keyboard answers, escaped ride text, and failed quiz storage remain usable',t=>{
  const a=app(t,[ride('a',true,{name:'<img src=x onerror=alert(1)>',notes:'<script>bad</script>'}),ride('b'),ride('x',false)],{quota:true});
  a.w.TracklistQuiz.start();assert.equal(a.d.querySelector('#comparison-session img'),null);
  assert.match(a.d.getElementById('modal-content').textContent,/could not be saved/);
  const before=a.state();a.d.body.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'2',bubbles:true}));
  assert.deepEqual(a.state(),before);assert.match(a.d.getElementById('modal-content').textContent,/<img src=x/);assert.equal(a.d.querySelector('#comparison-session script'),null);
  a.d.body.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'1',bubbles:true}));assert.equal(a.ranked()[0],'x');
});
test('starting another quiz requires an explicit choice and notes edits preserve paused answers',t=>{
  const a=app(t,[ride('a'),ride('b'),ride('x',false)]);a.w.TracklistQuiz.start();a.answer('better');
  a.w.TracklistQuiz.start({mode:'full'});assert.match(a.d.getElementById('modal-title').textContent,/new quiz/);a.click('#comparison-keep');assert.equal(a.session().mode,'queue');
  a.click('#comparison-pause');a.w.TracklistApp.change({rides:a.state().rides.map(r=>({...r,notes:'Updated notes'}))},'Notes');assert.deepEqual(a.session().answers,['better']);
  a.w.TracklistQuiz.start({mode:'full'});a.click('#comparison-restart');assert.equal(a.session().mode,'full');assert.equal(a.session().answers.length,0);
});
test('another-tab quiz changes close the active quiz instead of mixing answers',t=>{
  const a=app(t,[ride('a'),ride('b'),ride('x',false)]);a.w.TracklistQuiz.start();a.answer('better');
  const updated={...a.session(),answers:[]};a.w.localStorage.setItem(KEY+'.comparison',JSON.stringify(updated));
  a.w.dispatchEvent(new a.w.StorageEvent('storage',{key:KEY+'.comparison',newValue:JSON.stringify(updated)}));
  assert.equal(a.d.getElementById('modal').open,false);a.click('#compare-button');a.click('#comparison-resume');assert.deepEqual(a.session().answers,[]);
});
test('catalog credit logging works with comparison modules and opens its rank quiz',t=>{
  const a=app(t,[],{features:true});a.click('[data-view="explore"]');
  const search=a.d.getElementById('catalog-search');search.value='Cedar Point';search.dispatchEvent(new a.w.Event('input'));
  const log=a.d.querySelector('[data-catalog-action="log"]');
  // Catalog cards use delegated actions; select a park first when results are park groups.
  if(!log){const park=a.d.querySelector('[data-park-id]');assert(park);park.click();}
  const action=a.d.querySelector('[data-catalog-action="log"]');assert(action);action.click();
  const id=a.state().rides[0].id;a.w.TracklistApp.rankModal(id);a.click('#rank-compare');place(a,0);assert.equal(a.ranked().length,1);
});
test('buttons and focus stay in place across answers and the next ride',t=>{
  const a=app(t,[ride('a'),ride('b'),ride('c'),ride('x',false),ride('y',false)]);
  a.w.TracklistQuiz.start();const button=a.d.querySelector('[data-comparison-answer="better"]');
  assert.equal(a.d.activeElement,button);assert.match(button.textContent,/↑ Rank higher/);
  a.answer('better');assert.equal(a.d.querySelector('[data-comparison-answer="better"]'),button);
  a.answer('better');assert.equal(a.session().index,1);assert.equal(a.d.querySelector('[data-comparison-answer="better"]'),button);assert.equal(a.d.activeElement,button);
  assert.match(a.d.getElementById('comparison-notice').textContent,/x saved at #1/);
  assert.equal(a.d.getElementById('comparison-target').querySelector('h3').textContent,'y');
});
test('Undo last ride restores its final comparison without losing later notes edits',t=>{
  const a=app(t,[ride('a'),ride('b'),ride('c'),ride('x',false),ride('y',false)]);
  a.w.TracklistQuiz.start();place(a,0);assert.equal(a.ranked()[0],'x');
  a.w.TracklistApp.change({rides:a.state().rides.map(r=>({...r,notes:'New note'}))},'Notes updated');
  assert.equal(a.d.getElementById('comparison-back').textContent,'Undo last ride');a.click('#comparison-back');
  assert.equal(a.session().index,0);assert.equal(a.session().placed.length,0);assert.equal(a.state().rides.find(r=>r.id==='x').ranked,false);
  assert(a.state().rides.every(r=>r.notes==='New note'));assert.equal(a.session().answers.length,1);
  a.answer('worse');assert.deepEqual(a.ranked(),['a','x','b','c']);assert.equal(a.session().index,1);
});
test('a completed single rerank can be corrected immediately without a save screen',t=>{
  const a=app(t,[ride('a'),ride('b'),ride('c')]);a.w.TracklistQuiz.start({mode:'single',ids:['c']});
  place(a,0);assert.deepEqual(a.ranked(),['c','a','b']);a.click('#comparison-undo-final');
  assert.deepEqual(a.ranked(),['a','b','c']);assert(a.d.getElementById('comparison-session'));a.answer('worse');
  assert.deepEqual(a.ranked(),['a','c','b']);assert.equal(a.session(),null);
});
test('arrow shortcuts save and advance, stronger arrows work, held keys do not repeat',t=>{
  const a=app(t,[ride('a'),ride('b'),ride('c'),ride('x',false),ride('y',false)]);a.w.TracklistQuiz.start();
  const key=(value,extra={})=>a.d.activeElement.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true,...extra}));
  key('ArrowUp',{repeat:true});assert.equal(a.session().answers.length,0);
  key('ArrowUp',{shiftKey:true});assert.equal(a.session().answers[0],'much-better');key('ArrowUp');assert.equal(a.ranked()[0],'x');assert.equal(a.session().index,1);
  key('ArrowDown',{shiftKey:true});while(a.session())key('ArrowDown');assert.equal(a.ranked().at(-1),'y');
});
test('an older paused result auto-saves only when the user resumes',t=>{
  const rides=[ride('a'),ride('b'),ride('x',false)];
  const quiz={version:1,mode:'queue',queue:['x'],index:0,placed:[],skipped:[],answers:['worse'],expected:JSON.stringify(rides.map(r=>[r.id,r.ranked]))};
  const a=app(t,rides,{quiz});assert.equal(a.state().rides.find(r=>r.id==='x').ranked,false);
  a.click('#compare-button');a.click('#comparison-resume');assert.deepEqual(a.ranked(),['a','b','x']);assert.equal(a.session(),null);
});
