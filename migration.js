(function(root){
  'use strict';
  function parse(text,core,catalog,Parser,catalogRecords=root.TRACKLIST_CATALOG?.rides||[]){
    if(text.length>15*1024*1024)throw new Error('Choose a file or pasted list smaller than 15 MB.');
    if(!text.trim())throw new Error('Paste your ridden-coaster table or choose a saved HTML/CSV file.');
    const header=text=>text.toLowerCase().replace(/[^a-z]/g,'');
    let records=[];
    if(/^\s*</.test(text)){
      const doc=new Parser().parseFromString(text,'text/html');
      for(const table of doc.querySelectorAll('table')){
        const rows=[...table.querySelectorAll('tr')].map(row=>[...row.querySelectorAll('th,td')].filter(cell=>cell.closest('tr')===row));
        const first=rows.findIndex(cells=>cells.some(c=>/^(name|ride|coaster|rollercoaster|coastername|rollercoastername|ridename)$/.test(header(c.textContent))));
        if(first<0)continue;
        const columns=rows[first].map(c=>header(c.textContent));
        const name=columns.findIndex(c=>/^(name|ride|coaster|rollercoaster|coastername|rollercoastername|ridename)$/.test(c));
        const park=columns.findIndex(c=>/^(park|parkname|location|amusementpark)$/.test(c));
        for(const cells of rows.slice(first+1)){
          if(!cells[name]||cells[name].tagName==='TH')continue;
          const rcdbLink=[...cells[name].querySelectorAll('a')].find(a=>/^https?:\/\/rcdb\.com\/[1-9]\d*\.htm$/.test(a.getAttribute('href')||''));
          const nameText=cells[name].textContent.replace(/\s+/g,' ').trim();
          if(nameText)records.push({name:nameText,park:park>=0?cells[park]?.textContent.replace(/\s+/g,' ').trim()||'':'',rcdb:rcdbLink?rcdbLink.getAttribute('href').replace(/^http:/,'https:'):'',ranked:false});
        }
      }
      if(!records.length)throw new Error('No ride table was found in this page. Copy the ridden-coaster table and paste it, or use a CSV with Name and Park columns.');
    }else{
      try{records=core.importText(text,'credits.csv').rides.map(r=>({...r,ranked:false}));}
      catch(error){
        const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
        if(lines.some(l=>l.includes(',')||l.includes(';')))throw error;
        records=lines.filter(l=>!/^#?\s*(name|coaster|roller coaster|park|ridden coasters|credits)\s*$/i.test(l)).map(line=>{
          const parts=line.split(/\t|\s*\|\s*/).filter(Boolean);
          if(/^\d+[.)]?$/.test(parts[0]))parts.shift();
          return {name:parts[0]?.replace(/^\d+[.)]\s*/,''),park:parts[1]||'',ranked:false};
        });
      }
    }
    if(!records.length)throw new Error('No rides were found.');
    if(records.length>core.LIMIT)throw new Error('This list contains too many rides.');
    const ids=new Set();
    return records.map(raw=>{const ride=core.ride({...raw,ranked:false,demoRide:false},ids);const matching=catalog.match(ride,catalogRecords);return {ride,matchedId:matching.match?.id||'',candidates:matching.candidates};});
  }
  const api={parse};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TracklistMigration=api;
})(globalThis);
