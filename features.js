(() => {
  'use strict';
  const A=TracklistApp,C=Tracklist,K=TracklistCatalog,Cloud=TracklistCloud,R=TracklistRecovery;
  const $=id=>document.getElementById(id),e=A.escape;
  const data=TRACKLIST_CATALOG,records=data.rides,allParks=K.parks(records);
  let catalogMode='parks',catalogQuery='',country='',parkId='',status='current',catalogPage=0,migrationRows=[];
  const date=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;};
  const credited=record=>A.getState().rides.find(r=>!r.demoRide&&K.same(r,record));
  const planned=record=>A.getState().wishlist.find(r=>K.same(r,record));
  const current=r=>['Operating','Unknown','Closed','Standing but not operating'].includes(r.status);
  const selectedRecords=()=>{
    const q=K.fold(catalogQuery);
    return records.filter(r=>(!parkId||K.parkKey(r)===parkId)&&(!country||r.country===country)&&(status==='all'||current(r))&&(!q||K.fold(`${r.name} ${(r.aliases||[]).join(' ')} ${r.park} ${r.manufacturer}`).includes(q)));
  };
  function recordCard(r,wishlist=false){
    const owned=credited(r),wish=planned(r);
    const pov=r.pov||`https://www.youtube.com/results?search_query=${encodeURIComponent(`${r.name} ${r.park} roller coaster POV`)}`;
    return `<article class="catalog-ride" data-catalog-id="${e(r.id)}"><div class="catalog-ride-main">${A.art(r)}<div><h3>${e(r.name)}</h3><p>${e(r.park)} · ${e(r.country||'Country not listed')}</p><div class="catalog-tags"><span>${e(r.type)}</span>${r.manufacturer?`<span>${e(r.manufacturer)}</span>`:''}${r.status?`<span class="catalog-status">${e(r.status)}</span>`:''}</div></div></div><div class="catalog-ride-actions"><div class="catalog-links">${r.rcdb?`<a href="${e(r.rcdb)}" target="_blank" rel="noopener noreferrer">RCDB ↗</a>`:`<a href="https://rcdb.com/qs.htm?qs=${encodeURIComponent(`${r.name} ${r.park}`)}" target="_blank" rel="noopener noreferrer">Find on RCDB ↗</a>`}<a href="${e(pov)}" target="_blank" rel="noopener noreferrer">${r.pov?'Watch':'Find'} POV ↗</a>${r.source?`<a href="${e(r.source)}" target="_blank" rel="noopener noreferrer">Source ↗</a>`:''}</div><div class="catalog-buttons">${owned?`<button class="button small" data-catalog-action="rank">${owned.ranked?'Ranked #'+(A.getState().rides.filter(r=>r.ranked).findIndex(x=>x.id===owned.id)+1):'Credit logged · Rank it'}</button>`:`<button class="button small primary" data-catalog-action="log">${A.icon('plus')}Log credit</button>`}${wishlist?'<button class="button small quiet" data-catalog-action="remove">Remove</button>':owned?'':`<button class="button small quiet" data-catalog-action="plan" ${wish?'disabled':''}>${wish?'On trip list':'Plan ride'}</button>`}</div></div></article>`;
  }
  function renderCatalog(){
    if(A.getView()!=='explore')return;
    const active=document.activeElement?.id,caret=active==='catalog-search'?document.activeElement.selectionStart:null;
    const park=allParks.find(p=>p.id===parkId),filtered=selectedRecords();
    const parkResults=allParks.filter(p=>(!country||p.country===country)&&K.fold(`${p.name} ${p.country}`).includes(K.fold(catalogQuery)));
    const items=parkId||catalogMode==='rides'?filtered:parkResults;
    const pageSize=30,shown=items.slice(catalogPage*pageSize,(catalogPage+1)*pageSize);
    if(catalogPage>0&&!shown.length){catalogPage=0;return renderCatalog();}
    $('explore-panel').innerHTML=`<div class="catalog-toolbar"><div class="modal-tabs"><button data-catalog-mode="parks" class="${catalogMode==='parks'?'active':''}">Parks</button><button data-catalog-mode="rides" class="${catalogMode==='rides'?'active':''}">Rides</button></div><label class="catalog-search field"><span class="sr-only">Search park or ride catalog</span><input id="catalog-search" type="search" value="${e(catalogQuery)}" placeholder="${park?'Search rides in this park…':catalogMode==='parks'?'Search a park you want to visit…':'Search any coaster or manufacturer…'}"></label><label class="field"><span class="sr-only">Country</span><select id="catalog-country"><option value="">Every country</option>${[...new Set(records.map(r=>r.country).filter(Boolean))].sort().map(c=>`<option ${c===country?'selected':''}>${e(c)}</option>`).join('')}</select></label><label class="field"><span class="sr-only">Ride status</span><select id="catalog-status"><option value="current" ${status==='current'?'selected':''}>Current / status unknown</option><option value="all" ${status==='all'?'selected':''}>Include historic & planned</option></select></label></div>
    <div class="catalog-caption">${park?`<button class="text-button" id="catalog-back">← All parks</button><h2>${e(park.name)}</h2><p>${e(park.country)} · ${filtered.length} catalog rides in this view</p>`:`<strong>${items.length.toLocaleString()} ${catalogMode==='parks'?'parks':'rides'} found</strong>`}<p>Community catalog: ${records.length.toLocaleString()} rides · ${allParks.length.toLocaleString()} parks. Coverage may be incomplete; status is not live. Check the source before a trip.</p></div>
    ${shown.length?parkId||catalogMode==='rides'?`<div class="catalog-rides">${shown.map(r=>recordCard(r)).join('')}</div>`:`<div class="park-grid">${shown.map(p=>`<button class="park-card" data-park-id="${e(p.id)}"><span class="park-card-symbol">${A.icon('park')}</span><strong>${e(p.name)}</strong><span>${e(p.country||'Country not listed')}</span><small>${p.rides.filter(r=>status==='all'||current(r)).length} rides in catalog <span>Explore →</span></small></button>`).join('')}</div>`:'<div class="empty-state"><h2>No catalog matches.</h2><p>Try a broader search. You can always add a credit manually if this community catalog is missing a ride.</p></div>'}
    <div class="catalog-footer"><span>Data: <a href="${e(data.sourceURL)}" target="_blank" rel="noopener noreferrer">${e(data.source)}</a> · ${new Date(data.updatedAt).toLocaleDateString()} · <a href="${e(data.licenseURL)}" target="_blank" rel="noopener noreferrer">${e(data.license)}</a></span><div><button class="button small" id="catalog-previous" ${catalogPage===0?'disabled':''}>Previous</button><span>${items.length?catalogPage+1:0} / ${Math.ceil(items.length/pageSize)}</span><button class="button small" id="catalog-next" ${(catalogPage+1)*pageSize>=items.length?'disabled':''}>Next</button></div></div>`;
    $('catalog-search').oninput=event=>{catalogQuery=event.target.value;catalogPage=0;renderCatalog();};
    $('catalog-country').onchange=event=>{country=event.target.value;parkId='';catalogPage=0;renderCatalog();};
    $('catalog-status').onchange=event=>{status=event.target.value;catalogPage=0;renderCatalog();};
    $('catalog-previous').onclick=()=>{catalogPage--;renderCatalog();};$('catalog-next').onclick=()=>{catalogPage++;renderCatalog();};
    if($('catalog-back'))$('catalog-back').onclick=()=>{parkId='';catalogQuery='';catalogPage=0;renderCatalog();};
    if(active==='catalog-search'){const input=$('catalog-search');input.focus({preventScroll:true});try{input.setSelectionRange(caret,caret);}catch{}}
  }
  function renderWishlist(){
    if(A.getView()!=='wishlist')return;
    const list=A.getState().wishlist;
    $('wishlist-panel').innerHTML=`<div class="catalog-caption"><strong>${list.length} rides on your trip list</strong><p>Planning a ride doesn’t count as a credit. Log it after you ride, then give it a rank.</p></div>${list.length?`<div class="catalog-rides">${list.map(r=>recordCard(r,true)).join('')}</div>`:'<div class="empty-state"><h2>Where to next?</h2><p>Explore a park and choose Plan ride to build your next trip.</p><button class="button primary" id="wishlist-explore">Explore parks</button></div>'}`;
    if($('wishlist-explore'))$('wishlist-explore').onclick=()=>A.setView('explore');
  }
  function logRecord(record){
    const state=A.getState();if(state.rides.some(r=>!r.demoRide&&K.same(r,record))){A.toast('This ride is already in your credits.',false);return;}
    const wish=state.wishlist.find(r=>K.same(r,record));
    const ride=C.ride({...K.fromRecord(record,C),notes:wish?.notes||'',riddenOn:date(),ranked:false});
    A.change({rides:[...state.rides.filter(r=>!(r.demoRide&&K.same(r,record))),ride],wishlist:state.wishlist.filter(r=>!K.same(r,record))},`${ride.name} logged. Find it in Unranked.`);
  }
  for(const panel of ['explore-panel','wishlist-panel'])$(panel).addEventListener('click',event=>{
    const mode=event.target.closest('[data-catalog-mode]');if(mode){catalogMode=mode.dataset.catalogMode;parkId='';catalogQuery='';catalogPage=0;renderCatalog();return;}
    const park=event.target.closest('[data-park-id]');if(park){parkId=park.dataset.parkId;catalogQuery='';catalogPage=0;renderCatalog();return;}
    const action=event.target.closest('[data-catalog-action]');if(!action)return;
    const card=action.closest('[data-catalog-id]'),id=card.dataset.catalogId;
    const record=records.find(r=>r.id===id)||A.getState().wishlist.find(r=>r.id===id);if(!record)return;
    const state=A.getState();
    if(action.dataset.catalogAction==='log')logRecord(record);
    else if(action.dataset.catalogAction==='rank'){const own=credited(record);if(own)A.rankModal(own.id);}
    else if(action.dataset.catalogAction==='plan'){if(!planned(record)&&!credited(record))A.change({wishlist:[...state.wishlist,K.fromRecord(record,C)]},`${record.name} added to your trip list.`);}
    else if(action.dataset.catalogAction==='remove')A.change({wishlist:state.wishlist.filter(r=>r.id!==id)},'Ride removed from your trip list.');
  });
  document.addEventListener('tracklist:render',()=>{renderCatalog();renderWishlist();});
  document.addEventListener('tracklist:add-form',event=>{
    if(event.detail.multiple)return;
    const form=$('ride-form');form.insertAdjacentHTML('afterbegin','<div class="catalog-autofill"><label class="field"><span>Find in the ride catalog</span><input type="search" id="add-catalog-search" placeholder="Search a ride or park to fill its details…"></label><div id="add-catalog-results"></div></div>');
    $('add-catalog-search').oninput=event=>{
      const q=K.fold(event.target.value),matches=q.length>=2?records.filter(r=>K.fold(`${r.name} ${(r.aliases||[]).join(' ')} ${r.park}`).includes(q)).slice(0,8):[];
      $('add-catalog-results').innerHTML=matches.map(r=>`<button class="autofill-result" type="button" data-autofill="${e(r.id)}"><strong>${e(r.name)}</strong><span>${e(r.park)}</span></button>`).join('');
    };
    $('add-catalog-results').onclick=event=>{
      const button=event.target.closest('[data-autofill]');if(!button)return;const record=records.find(r=>r.id===button.dataset.autofill);
      for(const field of ['name','park','country','manufacturer','type','pov','rcdb'])if($('field-'+field))$('field-'+field).value=record[field]||'';
      form.dataset.catalogId=record.id;$('add-catalog-results').innerHTML='';$('add-catalog-search').value=record.name;
    };
  });
  function migrationModal(){
    A.openModal(`${A.modalHeader('Bring your credits over.', 'Import the ridden-coaster list from Coaster-Count.')}<div class="modal-body"><div class="help-copy"><p>Open your <strong>Ridden coasters</strong> page on Coaster-Count. Copy its ride table and paste below, or save that page as HTML and choose the file. CSV/TSV exports also work if your account offers them. Tracklist does not ask for your Coaster-Count password.</p><p>Only use a list of rides you have ridden. We’ll match catalog records where names and parks agree, and let you review unmatched or ambiguous entries. Imported credits start unranked.</p></div><form id="migration-form"><label class="field"><span>Your copied ride table or ride names</span><textarea id="migration-text" rows="7" placeholder="Ride name [tab] Park name\nOr: Ride name | Park name"></textarea></label><p><label class="button file-label" for="migration-file">Choose saved HTML, CSV or text</label><input class="sr-only" id="migration-file" type="file" accept=".html,.htm,.csv,.tsv,.txt"></p><p id="migration-error" class="form-error" hidden role="alert"></p></form></div><div class="modal-actions"><button class="button quiet" data-close>Cancel</button><button class="button primary" type="submit" form="migration-form">Review credits</button></div>`);
    $('migration-form').onsubmit=event=>{event.preventDefault();try{migrationRows=TracklistMigration.parse($('migration-text').value,C,K,DOMParser);migrationReview();}catch(error){$('migration-error').hidden=false;$('migration-error').textContent=error.message;}};
    $('migration-file').onchange=async event=>{const input=event.target,file=input.files[0];if(!file)return;try{if(file.size>15*1024*1024)throw new Error('Choose a file smaller than 15 MB.');const text=await file.text();if(!input.isConnected)return;$('migration-text').value=text;migrationRows=TracklistMigration.parse(text,C,K,DOMParser);migrationReview();}catch(error){if(input.isConnected){$('migration-error').hidden=false;$('migration-error').textContent=error.message;}}};
  }
  function migrationReview(){
    const matched=migrationRows.filter(r=>r.matchedId).length;
    A.openModal(`${A.modalHeader('Review your credits.', `${migrationRows.length} entries · ${matched} matched · ${migrationRows.length-matched} need review`)}<div class="modal-body"><p class="privacy-note">Matched records fill park, type, manufacturer, country and links. An unmatched entry can be kept with the details from your pasted list. A matching existing credit will be skipped.</p><div class="migration-preview">${migrationRows.map((row,i)=>`<div class="migration-row"><label><input type="checkbox" data-migration-include="${i}" checked> <strong>${e(row.ride.name)}</strong><small>${e(row.ride.park||'Park not supplied')}</small></label><label class="field"><span class="sr-only">Catalog match for ${e(row.ride.name)}</span><select data-migration-match="${i}"><option value="">Keep as entered · no catalog match</option>${row.candidates.map(r=>`<option value="${e(r.id)}" ${row.matchedId===r.id?'selected':''}>${e(r.name)} · ${e(r.park)}</option>`).join('')}</select></label></div>`).join('')}</div><p id="migration-error" class="form-error" hidden role="alert"></p></div><div class="modal-actions"><button class="button quiet" id="migration-back">Back</button><button class="button primary" id="migration-import">Import selected credits</button></div>`);
    $('migration-back').onclick=migrationModal;
    $('migration-import').onclick=()=>{
      try{
        const chosen=migrationRows.filter((row,i)=>document.querySelector(`[data-migration-include="${i}"]`).checked).map(row=>{
          const i=migrationRows.indexOf(row),id=document.querySelector(`[data-migration-match="${i}"]`).value,record=records.find(r=>r.id===id);
          return C.ride({...K.enrich(row.ride,record),ranked:false});
        });
        if(!chosen.length)throw new Error('Select at least one credit.');
        const state=A.getState(),merged=C.merge(state.rides.filter(r=>!r.demoRide),chosen);
        A.change({rides:merged.rides,wishlist:state.wishlist.filter(w=>!merged.rides.some(r=>K.same(r,w)))},`${merged.added} credits imported; ${merged.skipped} duplicates skipped.`);A.closeModal();A.setView('unranked');
      }catch(error){$('migration-error').textContent=error.message;$('migration-error').hidden=false;}
    };
  }
  function recoveryModal(){
    let snapshots=[];try{snapshots=R.list(localStorage,A.getStorageKey());}catch{}
    A.openModal(`${A.modalHeader('Recovery checkpoints.', 'Earlier collections saved automatically on this browser.')}<div class="modal-body"><p class="privacy-note">Checkpoints help recover earlier edits. They are stored in the same browser as your collection, so clearing browser data removes both. Keep downloaded JSON backups too.</p>${snapshots.length?snapshots.map(s=>`<div class="recovery-row"><div><strong>${e(new Date(s.at).toLocaleString())}</strong><span>${s.rides} credits · ${s.wishlist} planned rides</span></div><button class="button small" data-recovery-export="${e(s.id)}">Download</button><button class="button small" data-recovery-restore="${e(s.id)}">Restore</button></div>`).join(''):'<p class="help-copy">No checkpoints yet. Your next collection changes will create them.</p>'}</div><div class="modal-actions"><button class="button quiet" data-close>Done</button></div>`);
    $('modal-content').onclick=event=>{
      const button=event.target.closest('[data-recovery-export],[data-recovery-restore]');if(!button)return;
      const snapshot=snapshots.find(s=>s.id===(button.dataset.recoveryExport||button.dataset.recoveryRestore));if(!snapshot)return;
      if(button.dataset.recoveryExport){const url=URL.createObjectURL(new Blob([snapshot.data],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`tracklist-recovery-${snapshot.at.slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);return;}
      A.openModal(`${A.modalHeader('Restore this checkpoint?')}<div class="modal-body help-copy">Your current collection will be checkpointed before this version replaces it. This change can also be undone.</div><div class="modal-actions"><button class="button quiet" data-close>Cancel</button><button class="button primary" id="restore-checkpoint">Restore collection</button></div>`);
      $('restore-checkpoint').onclick=()=>{A.restore(JSON.parse(snapshot.data),'Recovery checkpoint restored.');A.closeModal();};
    };
  }
  document.addEventListener('tracklist:backup',()=>{
    $('modal-content').querySelector('.modal-body').insertAdjacentHTML('afterbegin','<div class="backup-card"><h3>Coaster-Count & recovery</h3><p>Bring over your ridden list, recover an earlier version, or connect an account for cross-device saves.</p><div class="backup-buttons"><button class="button" id="open-migration">Import Coaster-Count list</button><button class="button" id="open-recovery">Recovery checkpoints</button><button class="button" id="open-cloud">Account & sync</button></div></div>');
    $('open-migration').onclick=migrationModal;$('open-recovery').onclick=recoveryModal;$('open-cloud').onclick=cloudModal;
  });
  let account=null,cloudState=null;
  const coordinator=Cloud.init({
    getState:A.getState,
    onAccount:user=>{
      const uid=user?.uid||null;if(account?.uid===uid)return {base:coordinator.base,dirty:coordinator.dirty};
      account=user;const local=A.switchAccount(uid);let meta={};try{meta=JSON.parse(localStorage.getItem(A.getStorageKey()+'.sync')||'{}');}catch{}
      if(user&&!meta.base)meta.dirty=local.meaningful;
      if(user&&local.unreadable){meta={base:'unreadable-local-save',dirty:true};}
      cloudState=coordinator;updateCloudStatus();return meta;
    },
    onMetadata:meta=>{try{localStorage.setItem(A.getStorageKey()+'.sync',JSON.stringify(meta));}catch{}},
    onRemote:A.applyRemote,
    onStatus:state=>{cloudState=state;updateCloudStatus();},
    merge:(remote,local)=>{const rides=C.merge(remote.rides,local.rides).rides;return C.normalize({...remote,rides,wishlist:C.merge(remote.wishlist,local.wishlist).rides.filter(w=>!rides.some(r=>K.same(r,w)))});},
  });
  function updateCloudStatus(){
    const labels={local:'Local only',connecting:'Connecting…',pending:'Sync pending',saving:'Saving to cloud…',loading:'Loading cloud…',synced:'Cloud saved',offline:'Saved locally · offline',error:'Sync needs attention',conflict:'Sync conflict'};
    const value=cloudState?.status||'local';$('cloud-top').textContent=labels[value];$('cloud-top').dataset.status=value;
    const warn=['conflict','error','offline'].includes(value);$('sync-warning').hidden=!warn;
    if(warn){$('sync-warning').textContent=(cloudState.message||'Cloud sync needs attention.')+' Open Account & sync to resolve.';}
  }
  function cloudModal(){
    if(!Cloud.configured()){
      A.openModal(`${A.modalHeader('Cloud saving setup.')}<div class="modal-body help-copy">Firebase has not been configured. Add your public web-app configuration to firebase-config.js and follow FIREBASE_SETUP.md.</div><div class="modal-actions"><button class="button quiet" data-close>Done</button></div>`);return;
    }
    if(account){
      const conflict=coordinator.status==='conflict';
      A.openModal(`${A.modalHeader('Your account & saves.',e(account.email||'Signed in'))}<div class="modal-body"><div class="review-summary"><strong>${e($('cloud-top').textContent)}</strong><br>${e(coordinator.message||'Local saves stay available on this device. Cloud saves keep the last 10 revisions.')}</div>${conflict?'<div class="backup-card"><h3>Both collections are preserved</h3><p>Download this device’s backup before choosing. Merge keeps the cloud ranking and adds missing local credits; existing cloud notes take priority. Using this device’s version replaces the cloud head while retaining earlier cloud revisions.</p><div class="backup-buttons"><button class="button" id="conflict-backup">Export this device</button><button class="button" id="use-cloud">Use cloud</button><button class="button" id="merge-cloud">Merge both</button><button class="button primary" id="use-local">Use this device</button></div></div>':'<button class="button primary" id="sync-now">Sync now / retry</button>'}<div class="backup-buttons" style="margin-top:16px"><button class="button" id="cloud-history">Cloud recovery</button><button class="button quiet" id="sign-out">Sign out</button></div><p class="privacy-note">Signing out returns to this browser’s guest collection. Your account’s local copy is retained separately. Sync requires an internet connection. Exported JSON backups remain your independent backup.</p><p id="cloud-error" class="form-error" hidden role="alert"></p></div><div class="modal-actions"><button class="button quiet" data-close>Done</button></div>`);
      if(conflict){$('conflict-backup').onclick=()=>A.exportData();for(const [id,mode]of [['use-cloud','cloud'],['merge-cloud','merge'],['use-local','local']])$(id).onclick=async()=>{try{await coordinator.resolve(mode);if($('modal').open)cloudModal();}catch(error){cloudError(error.message);}};}
      else $('sync-now').onclick=async()=>{try{await coordinator.retry();if($('modal').open)cloudModal();}catch(error){cloudError(error.message);}};
      $('sign-out').onclick=()=>{
        A.openModal(`${A.modalHeader('Sign out of this account?')}<div class="modal-body help-copy">${coordinator.dirty?'There are unsynced changes. They will stay in this account’s local copy on this device. Export them or resolve sync before switching devices.':'Your cloud collection and this account’s local copy will be kept.'}</div><div class="modal-actions"><button class="button" id="signout-backup">Export backup</button><button class="button quiet" data-close>Cancel</button><button class="button primary" id="confirm-signout">Sign out</button></div>`);$('signout-backup').onclick=()=>A.exportData();$('confirm-signout').onclick=async()=>{try{await Cloud.signOut();A.closeModal();}catch(error){A.toast(error.message,false);}};
      };
      $('cloud-history').onclick=cloudHistory;return;
    }
    A.openModal(`${A.modalHeader('A home for your ranking.', 'Sign in on each device to use the same collection.')}<div class="modal-body"><p class="privacy-note">Use an email and password for your Tracklist account. Signing in keeps a separate local collection for this account. Existing local credits are offered for merge if a cloud collection already exists.</p><form id="cloud-auth-form" class="form-grid"><label class="field full"><span>Email</span><input name="email" id="cloud-email" type="email" autocomplete="email" required></label><label class="field full"><span>Password</span><input name="password" type="password" autocomplete="current-password" minlength="6" required></label><label class="inline-check field full"><span><input type="checkbox" name="create"> Create a new account</span></label><p id="cloud-error" class="form-error field full" hidden role="alert"></p></form><button class="text-button" id="password-reset">Forgot password?</button><p class="privacy-note">Account data is sent to your configured Firebase project. No analytics are enabled.</p></div><div class="modal-actions"><button class="button quiet" data-close>Cancel</button><button class="button primary" id="auth-submit" type="submit" form="cloud-auth-form">Continue</button></div>`);
    $('cloud-auth-form').onsubmit=async event=>{event.preventDefault();const form=event.target,button=$('auth-submit'),values=new FormData(form);button.disabled=true;try{await Cloud.signIn(values.get('email'),values.get('password'),values.has('create'));if(form.isConnected)cloudModal();}catch(error){if(form.isConnected)cloudError(error.message);}finally{if(button.isConnected)button.disabled=false;}};
    $('password-reset').onclick=async()=>{try{if(!$('cloud-email').reportValidity())return;await Cloud.resetPassword($('cloud-email').value);A.toast('If that account exists, a password-reset email will arrive.',false);}catch(error){cloudError(error.message);}};
  }
  function cloudError(message){if($('cloud-error')){$('cloud-error').hidden=false;$('cloud-error').textContent=message;}else A.toast(message,false);}
  async function cloudHistory(){
    const uid=account?.uid;if(!uid)return;
    A.openModal(`${A.modalHeader('Cloud recovery.', 'Previous collections saved to your account.')}<div class="modal-body" id="cloud-history-content"><p class="help-copy">Loading saved revisions…</p></div><div class="modal-actions"><button class="button quiet" data-close>Done</button></div>`);
    try{
      const items=await Cloud.adapter.history(uid);if(!$('cloud-history-content')||account?.uid!==uid)return;
      $('cloud-history-content').innerHTML=items.length?items.map(item=>`<div class="recovery-row"><div><strong>${e(new Date(item.at).toLocaleString())}</strong><span>${item.rides} credits · ${item.wishlist} planned rides</span></div><button class="button small" data-cloud-restore="${e(item.revision)}">Restore</button></div>`).join(''):'<p class="help-copy">No cloud revisions yet.</p>';
      $('cloud-history-content').onclick=event=>{
        const button=event.target.closest('[data-cloud-restore]');if(!button)return;
        const item=items.find(i=>i.revision===button.dataset.cloudRestore);
        A.openModal(`${A.modalHeader('Restore this cloud revision?')}<div class="modal-body help-copy">This replaces your collection on this device and queues it as a new cloud revision. A local checkpoint will be kept first. If another device has newer edits, the conflict flow will protect them.</div><div class="modal-actions"><button class="button quiet" data-close>Cancel</button><button class="button primary" id="restore-cloud-revision">Restore</button></div>`);
        $('restore-cloud-revision').onclick=async()=>{try{const state=await Cloud.adapter.read(uid,item);if(account?.uid!==uid)return;A.restore(state,'Cloud recovery revision restored.');A.closeModal();}catch(error){A.toast(error.message,false);}};
      };
    }catch(error){if($('cloud-history-content'))$('cloud-history-content').textContent=error.message;}
  }
  $('cloud-button').onclick=$('cloud-top').onclick=cloudModal;
  document.addEventListener('tracklist:change',()=>coordinator.changed());
  window.addEventListener('online',()=>coordinator.retry());
  window.addEventListener('offline',()=>{if(account)coordinator.report('offline','Local saving continues. Pending changes will retry when online.');});
  if(Cloud.configured())Cloud.start().catch(error=>{coordinator.report('error',error.message);});
  renderCatalog();renderWishlist();
})();
