(function(root){
  'use strict';
  const KEY='tracklist.recovery.v1';
  function list(storage,owner='local'){
    try{const all=JSON.parse(storage.getItem(KEY)||'[]');return Array.isArray(all)?all.filter(s=>s.owner===owner&&typeof s.data==='string'):[];}catch{return [];}
  }
  function save(storage,state,owner='local',force=false){
    if(state.demo)return;
    try{
      let all=JSON.parse(storage.getItem(KEY)||'[]');if(!Array.isArray(all))all=[];
      const last=all.find(s=>s.owner===owner);
      if(!force&&last&&Date.now()-Date.parse(last.at)<10*60*1000)return;
      const data=JSON.stringify(state);if(last?.data===data)return;
      all.unshift({id:Date.now()+'-'+Math.random().toString(36).slice(2),owner,at:new Date().toISOString(),rides:state.rides.length,wishlist:state.wishlist?.length||0,data});
      // Keep up to 10 account-specific checkpoints within a 2 MB recovery budget.
      const counts=new Map();let size=0;
      all=all.filter(s=>{const n=(counts.get(s.owner)||0)+1;counts.set(s.owner,n);size+=s.data.length;return n<=10&&size<=2*1024*1024;});
      storage.setItem(KEY,JSON.stringify(all));
    }catch{/* A recovery snapshot failure never blocks the primary save. */}
  }
  const api={list,save};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TracklistRecovery=api;
})(globalThis);
