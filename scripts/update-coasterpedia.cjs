// Legacy offline parser retained for old fixtures. Network crawling has been retired.
const clean=value=>String(value||'').replace(/<!--[^]*?-->/g,'').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g,'$2').replace(/\[\[([^\]]+)\]\]/g,'$1').replace(/<br\s*\/?\s*>/gi,' / ').replace(/<[^>]*>/g,'').replace(/'{2,}/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
function parse(page){
  const text=page.revisions?.[0]?.slots?.main?.content||'';
  const start=text.search(/\{\{Infobox roller coaster\b/i);if(start<0)return null;
  let depth=0,end=text.length;
  for(let i=start;i<text.length-1;i++){const pair=text.slice(i,i+2);if(pair==='{{'){depth++;i++;}else if(pair==='}}'){depth--;i++;if(!depth){end=i+1;break;}}}
  const box=text.slice(start+2,end-2),fields={},segments=[];let nested=0,links=0,last=0;
  for(let i=0;i<box.length;i++){
    const pair=box.slice(i,i+2);
    if(pair==='{{'){nested++;i++;}else if(pair==='}}'){nested--;i++;}
    else if(pair==='[['){links++;i++;}else if(pair===']]'){links--;i++;}
    else if(box[i]==='|'&&!nested&&!links){segments.push(box.slice(last,i));last=i+1;}
  }
  segments.push(box.slice(last));
  for(const segment of segments){const match=segment.match(/^\s*([^=\n]+?)\s*=\s*([^]*)$/);if(match)fields[match[1].toLowerCase().trim()]=clean(match[2]);}
  if(!fields.park)return null;
  const country={USA:'United States',UK:'United Kingdom'}[fields.country]||fields.country||'';
  const rcdbTemplate=text.match(/\{\{RCDB\b[^}]*\}\}/i)?.[0]||'';
  const rcdbId=rcdbTemplate.match(/rcdb\.com\/(\d+)\.htm/i)?.[1]||(/^\d+$/.test(fields.rcdb||'')?fields.rcdb:'');
  const categories=[fields.category1,fields.category2,fields.category3,fields.category4].join(' ').toLowerCase();
  const status=fields.status?.toLowerCase();
  const statuses={operating:'Operating',closed:'Closed',sbno:'Standing but not operating',defunct:'Defunct',relocated:'Relocated',construction:'Under construction',planned:'Planned',removed:'Defunct'};
  const currentName=Object.keys(fields).filter(k=>/^name\d+$/.test(k)&&/present|current/i.test(fields[k+'to']||'')).sort((a,b)=>Number(b.slice(4))-Number(a.slice(4)))[0];
  const name=fields[currentName||'name']&&!fields[currentName||'name'].includes('{{')?fields[currentName||'name']:page.title.replace(/\s*\([^)]*\)\s*$/,'');
  const aliases=[...new Set(Object.keys(fields).filter(k=>/^name\d*$/.test(k)).map(k=>fields[k]).filter(n=>n&&n!==name&&!n.includes('{{')))];
  const video=fields[currentName?.replace('name','video')]||fields.video;
  return {id:`cp-${page.pageid}`,name,aliases,park:fields.park,parkId:'',country,manufacturer:fields.manufacturer||'',type:categories.includes('hybrid')?'Hybrid':categories.includes('wood')?'Wooden':categories.includes('steel')?'Steel':'Other',rcdb:rcdbId?`https://rcdb.com/${rcdbId}.htm`:'',pov:/^[\w-]{11}$/.test(video||'')?`https://www.youtube.com/watch?v=${video}`:'',source:`https://coasterpedia.net/w/index.php?title=${encodeURIComponent(page.title)}&oldid=${page.revisions[0].revid}`,status:statuses[status]||'Unknown'};
}
if(require.main===module){console.error('This bulk wiki crawler is retired. Use npm run catalog:refresh with the official API. See CATALOG_SETUP.md.');process.exitCode=1;}
module.exports={parse};
