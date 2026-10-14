const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom'),C=require('../core.js'),M=require('../statistics-model.js'),S=require('../social-model.js');
const root=path.resolve(__dirname,'..');
const parks=[{id:'one',name:'One Park',aliases:['Former Park'],country:'United States',lat:40,lon:-80,source:'https://www.wikidata.org/wiki/Q1'},{id:'two',name:'Two Park',aliases:[],country:'United States',lat:40.01,lon:-80.01,source:'https://www.wikidata.org/wiki/Q2'}];
const collection=()=>({version:1,rides:[
  {id:'a',name:'Favorite',park:'One Park',country:'United States',manufacturer:'RMC',type:'Hybrid',ranked:true,notes:'PRIVATE',riddenOn:'2024-01-01'},
  {id:'b',name:'Second',park:'One Park',country:'United States',manufacturer:'Rocky Mountain Construction',type:'Hybrid',ranked:true,riddenOn:'2025-02-01'},
  {id:'c',name:'Third',park:'Two Park',country:'United States',manufacturer:'B&M',type:'Steel',ranked:true},
  {id:'d',name:'Fourth',park:'Unknown Place',manufacturer:'Bolliger & Mabillard',type:'Steel',ranked:true},
  {id:'e',name:'Unranked',park:'Two Park',country:'United States',manufacturer:'Intamin',type:'Steel',ranked:false},
  {id:'sample',name:'Sample',park:'Sample park',manufacturer:'Sample builder',ranked:true,demoRide:true}
],wishlist:[{name:'Wish',park:'One Park',manufacturer:'Intamin',type:'Steel'}],parkWishlist:[{name:'Next park'}]});

test('preferences use ranking rather than credit frequency and ignore samples and unranked rides',()=>{
  const before=collection(),r=M.analyze(before,[],parks);assert.equal(r.totals.credits,5);assert.equal(r.totals.ranked,4);assert.equal(r.favorites.manufacturer.name,'Rocky Mountain Construction');
  assert.equal(r.favorites.manufacturer.ranked,2);assert.equal(r.favorites.type.name,'Hybrid');assert.equal(r.manufacturers.find(g=>g.name==='Intamin').score,null);assert.equal(r.manufacturers.find(g=>g.name==='Intamin').wishes,1);
  assert.equal(r.manufacturers.find(g=>g.name==='Bolliger & Mabillard').averageRank,3.5);assert.equal(r.top10.length,4);assert.equal(r.totals.unranked,1);assert.deepEqual(before,collection());
  const reversed=collection();reversed.rides=[...reversed.rides.filter(r=>r.ranked&&!r.demoRide)].reverse().concat(reversed.rides.filter(r=>!r.ranked));assert.equal(M.analyze(reversed,[],parks).favorites.manufacturer.name,'Bolliger & Mabillard');
});

test('missing metadata enriches only unambiguous catalog matches without editing saved credits',()=>{
  const state={version:1,rides:[{id:'x',name:'Known ride',park:'One Park',ranked:true},{id:'y',name:'Mystery',park:'One Park',ranked:false}]};
  const r=M.analyze(state,[{id:'catalog',name:'Known ride',park:'One Park',manufacturer:'Intamin',country:'United States',type:'Steel',aliases:[]}],parks);
  assert.equal(r.rides[0].manufacturer,'Intamin');assert.equal(state.rides[0].manufacturer,undefined);assert.equal(r.coverage.manufacturer,1);assert.equal(r.manufacturers.find(g=>!g.known).credits,1);
  assert.equal(r.years.length,0);assert.equal(M.analyze({version:1,rides:[]}).favorites.manufacturer,null);
});

test('ambiguous or unavailable parks are unpinned and area clusters preserve all credit counts',()=>{
  const r=M.analyze(collection(),[],parks);assert.equal(r.mapped.length,2);assert.equal(r.unmapped.length,1);assert.equal(r.mapped.reduce((n,p)=>n+p.credits,0),4);
  const world=M.clusters(r.mapped);assert.equal(world.length,1);assert.equal(world[0].credits,4);assert.equal(world[0].parks.length,2);
  const duplicate=[...parks,{...parks[0],id:'other',lat:50}];assert.equal(M.analyze(collection(),[],duplicate).mapped.length,1);
  const fit=M.fit(r.mapped);assert(fit.width>=4&&fit.x>=0&&fit.y>=0);assert.equal(M.clusters(r.mapped,fit).reduce((n,g)=>n+g.credits,0),4);
});

test('public statistics agree with private preferences while excluding dates and notes',()=>{
  const privateStats=M.analyze(collection(),[],parks),shared=M.analyze({version:1,...S.project(collection())},[],parks);
  assert.equal(shared.favorites.manufacturer.name,privateStats.favorites.manufacturer.name);assert.equal(shared.totals.credits,privateStats.totals.credits);assert.equal(shared.coverage.dates,0);assert.equal(shared.years.length,0);
  assert(!JSON.stringify(shared).includes('PRIVATE'));
});

test('park aliases share one park pin and missing countries use unambiguous public location data',()=>{
  const r=M.analyze({version:1,rides:[{name:'One',park:'One Park',ranked:true},{name:'Two',park:'Former Park',country:'United States',ranked:true},{name:'Unnamed',ranked:false}]},[],parks);
  assert.equal(r.totals.parks,1);assert.equal(r.totals.countries,1);assert.equal(r.mapped[0].credits,2);assert.equal(r.coverage.park,2);assert.equal(r.unmapped.length,0);
});

function app(t,state=collection()){
  const d=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://example.test/Tracklist/',runScripts:'outside-only',pretendToBeVisual:true}),w=d.window,errors=[];
  w.addEventListener('error',event=>errors.push(event.error));w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.localStorage.setItem('tracklist.collection.v1',JSON.stringify(state));
  for(const file of ['core.js','catalog-data.js','catalog.js','statistics-model.js','app.js','statistics.js'])w.eval(fs.readFileSync(path.join(root,file),'utf8'));
  w.TRACKLIST_PARK_MAP={parks,landPath:'M0,0L1440,0L1440,720Z',updatedAt:'2026-10-12T00:00:00.000Z'};
  t.after(()=>{w.close();assert.deepEqual(errors,[]);});return {w,d:w.document,A:w.TracklistApp,click:q=>{const b=w.document.querySelector(q);assert(b,q);b.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));}};
}

test('statistics shortcut, breakdown controls, map pins, park list and keyboard zoom work',t=>{
  const a=app(t);a.click('#statistics-shortcut');assert.equal(a.A.getView(),'statistics');assert.equal(a.d.getElementById('collection-stats').hidden,true);assert.equal(a.d.getElementById('add-button').hidden,true);
  assert.match(a.d.getElementById('statistics-panel').textContent,/Rocky Mountain Construction/);const selector=a.d.querySelector('[data-stats-measure]');selector.value='score';selector.dispatchEvent(new a.w.Event('change'));
  assert.match(a.d.querySelector('[data-stats-group="manufacturers"]').textContent,/100/);a.click('[data-map-pin]');assert.match(a.d.querySelector('[data-map-selection]').textContent,/Favorite/);assert.match(a.d.querySelector('[data-map-selection]').textContent,/Unranked/);
  a.click('[data-map-area]');assert.equal(a.d.querySelectorAll('[data-map-pin]').length,2);const svg=a.d.querySelector('.park-map-svg'),before=svg.getAttribute('viewBox');svg.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'+',bubbles:true}));assert.notEqual(svg.getAttribute('viewBox'),before);
  a.click('[data-map-action="world"]');assert.equal(svg.getAttribute('viewBox'),'0 0 1440 720');a.click('[data-map-park="unknownplace|"]');assert.match(a.d.querySelector('[data-map-selection]').textContent,/Location unavailable/);
  a.A.setView('ranked');assert.equal(a.d.getElementById('statistics-panel').textContent,'');assert.equal(a.d.getElementById('statistics-shortcut').hidden,false);
});

test('statistics regenerate after edits and account changes without leaking prior collection data',t=>{
  const a=app(t);a.A.setView('statistics');a.A.change({rides:[]},'Cleared');assert.match(a.d.getElementById('statistics-panel').textContent,/first credit/);assert(!a.d.getElementById('statistics-panel').textContent.includes('One Park'));
  assert.equal(a.d.querySelector('[data-stats-add]'),null);a.click('[data-stats-credits]');assert.equal(a.A.getView(),'all');assert.equal(a.d.getElementById('modal').open,false);
  a.A.switchAccount('new-account');a.A.setView('statistics');assert(!a.d.getElementById('statistics-panel').textContent.includes('Favorite'));
});

test('credit bars use all credits as their denominator on personal and shared statistics',t=>{
  const state={version:2,rides:Array.from({length:173},(_,i)=>({id:'r'+i,name:'Ride '+i,ranked:true,
    manufacturer:i<38?'Bolliger & Mabillard':'Maker '+Math.floor((i-38)/27),
    park:i<38?'One Park':'Other Park '+Math.floor((i-38)/27),
    country:i<38?'United States':'United Kingdom',type:i<38?'Steel':'Wooden'}))};
  const a=app(t,state);a.A.setView('statistics');
  function check(host){
    for(const [group,name] of [['manufacturers','Bolliger & Mabillard'],['types','Steel'],['parks','One Park'],['countries','United States']]){
      const row=[...host.querySelectorAll(`[data-stats-group="${group}"] .stats-breakdown-row`)].find(r=>r.querySelector('strong').textContent===name);
      assert(row);assert(Math.abs(parseFloat(row.querySelector('i').style.width)-100*38/173)<.0001);
      assert.equal(row.querySelector('span').textContent,'38 · 22%');
    }
  }
  check(a.d.getElementById('statistics-panel'));
  const host=a.d.createElement('div'),report=a.w.TracklistStatisticsModel.analyze({version:2,...S.project(state)});
  host.innerHTML=a.w.TracklistStatistics.overview(report,{shared:true});a.w.TracklistStatistics.bind(host,report);check(host);
});

test('other count bars use their own totals, strength stays absolute and undated rides stay in timeline totals',t=>{
  const state=collection();state.wishlist.push({name:'Another wish',manufacturer:'Intamin'},{name:'Third wish',manufacturer:'RMC'});
  const a=app(t,state);a.A.setView('statistics');
  const selector=a.d.querySelector('[data-stats-measure]');
  const change=value=>{selector.value=value;selector.dispatchEvent(new a.w.Event('change'));};
  const first=()=>a.d.querySelector('[data-stats-group="manufacturers"] .stats-breakdown-row');
  assert.equal(parseFloat(first().querySelector('i').style.width),40);
  change('top10');assert.equal(parseFloat(first().querySelector('i').style.width),50);assert.equal(first().querySelector('span').textContent,'2 · 50%');
  change('wishes');assert(Math.abs(parseFloat(first().querySelector('i').style.width)-200/3)<.0001);assert.equal(first().querySelector('span').textContent,'2 · 67%');
  change('score');assert(Math.abs(parseFloat(first().querySelector('i').style.width)-250/3)<.0001);
  assert.equal(a.d.querySelector('.stats-year i').style.width,'20%');
  a.A.change({wishlist:[]},'Cleared wishes');const empty=a.d.querySelector('[data-stats-measure]');empty.value='wishes';empty.dispatchEvent(new a.w.Event('change'));
  assert.equal(a.d.querySelector('[data-stats-group="manufacturers"] i'),null);
});

test('ranking and statistics count the same visited parks across aliases and missing locations',t=>{
  const state={version:2,rides:[{id:'one',name:'One',park:'One Park',ranked:true},{id:'two',name:'Two',park:'Former Park',country:'United States',ranked:true},{id:'three',name:'Three',park:'Unmapped park',ranked:false},{id:'four',name:'Four',ranked:false}]};
  const a=app(t,state);a.A.setView('ranked');assert.equal(a.d.getElementById('stat-parks').textContent,'2');
  a.A.setView('statistics');assert.equal(a.d.querySelector('.stats-totals > div:nth-child(3) strong').textContent,'2');
  assert.match(a.d.querySelector('.stats-park-list summary').textContent,/All visited parks \(2\).*1 location unavailable/);
  assert.equal(a.A.getState().rides.find(r=>r.id==='two').park,'Former Park');
});

test('escaped names are inert, long breakdowns paginate, and shared views never show private years',t=>{
  const state={version:1,rides:Array.from({length:25},(_,i)=>({id:'r'+i,name:'<img src=x onerror=alert(1)> '+i,park:'Park '+i,manufacturer:'Maker '+i,ranked:true,riddenOn:'2025-01-01'}))};
  const a=app(t,state);a.A.setView('statistics');assert.equal(a.d.querySelector('#statistics-panel img'),null);assert.equal(a.d.querySelectorAll('[data-stats-group="manufacturers"] .stats-breakdown-row').length,8);a.click('[data-stats-group="manufacturers"] [data-stats-page="1"]');assert.equal(a.d.querySelectorAll('[data-stats-group="manufacturers"] .stats-breakdown-row').length,8);
  assert.equal(a.d.querySelector('[data-stats-group="manufacturers"] i').style.width,'4%');
  const host=a.d.createElement('div');a.d.body.append(host);const report=a.w.TracklistStatisticsModel.analyze({version:1,...S.project(state)});host.innerHTML=a.w.TracklistStatistics.overview(report,{shared:true});a.w.TracklistStatistics.bind(host,report);assert.equal(host.querySelector('.stats-years'),null);assert(!host.textContent.includes('2025'));assert.equal(host.querySelector('img'),null);
});

test('bundled map has valid public provenance and safe projection paths',()=>{
  const context={};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'park-map-data.js'),'utf8'),context);const data=context.TRACKLIST_PARK_MAP;
  assert(data.parks.length>500);assert(/^[MLZ\d.,-]+$/.test(data.landPath));for(const p of data.parks){assert(Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180);const u=new URL(p.source);assert.equal(u.protocol,'https:');assert.equal(u.username+u.password+u.port,'');assert(['www.wikidata.org','coasterpedia.net'].includes(u.hostname));if(p.approximate){assert.equal(p.license,'CC-BY-SA-4.0');assert(p.sources.length);for(const source of p.sources)assert.match(source,/^https:\/\/coasterpedia\.net\/w\/index\.php\?title=.+&oldid=\d+$/);}}
});
