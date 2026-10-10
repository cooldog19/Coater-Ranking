(() => {
  'use strict';
  const A = globalThis.TracklistApp, C = globalThis.Tracklist, Q = globalThis.TracklistComparison;
  if (!A || !C || !Q) return;
  const $ = id => document.getElementById(id), esc = A.escape;
  const signature = () => JSON.stringify(A.getState().rides.map(r => [r.id,r.ranked]));
  let owner = A.getStorageKey(), session = null, applying = false, durable = true;
  const key = () => owner + '.comparison';
  const active = () => $('modal').open && !!$('comparison-session');
  function anchors(s = session) {
    const rides = A.getState().rides, target = s.queue[s.index];
    return s.mode === 'full' ? s.placed.map(id => rides.find(r => r.id === id)) : rides.filter(r => r.ranked && r.id !== target);
  }
  function load() {
    session = null; durable = true;
    try {
      const raw = localStorage.getItem(key());
      if (!raw) return;
      const s = JSON.parse(raw), ids = new Set(A.getState().rides.map(r => r.id));
      const list = value => Array.isArray(value) && value.length <= C.LIMIT && new Set(value).size === value.length && value.every(id => typeof id === 'string' && ids.has(id));
      if (s.version !== 1 || !['single','queue','full'].includes(s.mode) || !list(s.queue) || !s.queue.length || !list(s.placed) || !list(s.skipped) || !Number.isInteger(s.index) || s.index < 0 || s.index >= s.queue.length || s.expected !== signature()) throw new Error('Stale quiz.');
      const finished = s.queue.slice(0,s.index);
      if (s.placed.length + s.skipped.length !== s.index || finished.some(id => !s.placed.includes(id) && !s.skipped.includes(id)) || s.placed.some(id => s.skipped.includes(id)) || (s.mode === 'single' && s.queue.length !== 1)) throw new Error('Invalid progress.');
      if (!Array.isArray(s.answers)) throw new Error('Invalid answers.');
      Q.search(anchors(s).length,s.answers);
      session = s;
    } catch { try { localStorage.removeItem(key()); } catch {} }
  }
  function persist() {
    try {
      if (session) localStorage.setItem(key(),JSON.stringify(session));
      else localStorage.removeItem(key());
      durable = true;
    } catch { durable = false; }
    updateButton();
  }
  function updateButton() {
    const b = $('compare-button');
    if (b) { b.textContent = session ? 'Resume comparison quiz' : 'Rank by comparison'; b.disabled = !A.getState().rides.length; }
  }
  function storageCopy() {
    return durable ? 'Confirmed ranks use your usual saving settings. Paused quiz progress stays on this device; it isn’t included in backups.' : 'Quiz progress could not be saved on this device. Keep this tab open to resume. Confirmed ranks use your usual saving settings.';
  }
  function start({mode = 'queue',ids} = {}) {
    if (!['single','queue','full'].includes(mode)) return;
    const rides = A.getState().rides;
    const queue = ids ? rides.filter(r => ids.includes(r.id)).map(r => r.id) : rides.filter(r => mode === 'full' || !r.ranked).map(r => r.id);
    if (!queue.length || (mode === 'single' && queue.length !== 1)) { A.toast('Choose a ride to compare.',false); return; }
    const begin = () => {
      session = {version:1,mode,queue,index:0,placed:[],skipped:[],answers:[],expected:signature()};
      persist(); render();
    };
    if (session) {
      A.openModal(`${A.modalHeader('Start a new quiz?')}<div class="modal-body comparison-body"><p>This replaces your paused quiz. Confirmed rankings are already saved.</p></div><div class="modal-actions"><button class="button quiet" id="comparison-keep">Keep paused quiz</button><button class="button primary" id="comparison-restart">Start new quiz</button></div>`);
      $('comparison-keep').onclick = () => render(); $('comparison-restart').onclick = begin;
    } else begin();
  }
  function choices() {
    const rides = A.getState().rides, unranked = rides.filter(r => !r.ranked);
    A.openModal(`${A.modalHeader('Rank by comparison','Choose which rides to work through.')}<div class="modal-body comparison-body comparison-modes">${session ? `<button class="comparison-mode" id="comparison-resume"><strong>Resume paused quiz</strong><span>${session.index} of ${session.queue.length} rides reviewed</span></button>` : ''}<button class="comparison-mode" id="comparison-unranked" ${unranked.length ? '' : 'disabled'}><strong>Rank unranked credits</strong><span>${unranked.length} rides · keep your existing ranking as the reference</span></button><div class="comparison-one"><label class="field" for="comparison-ride"><span>Rerank one ride</span><select id="comparison-ride">${rides.map(r => `<option value="${esc(r.id)}">${esc(r.name)}${r.park ? ' · '+esc(r.park) : ''}</option>`).join('')}</select></label><button class="button" id="comparison-single" ${rides.length ? '' : 'disabled'}>Compare this ride</button></div><button class="comparison-mode" id="comparison-full" ${rides.length ? '' : 'disabled'}><strong>Rebuild the whole ranking</strong><span>Compare all ${rides.length} credits from scratch. Save as you go and pause anytime.</span></button><p class="comparison-help">Choose the ride you prefer. Each answer narrows the position; strong answers move the next question closer to the top or bottom. A normal search takes at most ${Math.ceil(Math.log2(Math.max(1,rides.length+1)))} comparisons per ride for this collection.</p><p class="privacy-note">${storageCopy()}</p></div><div class="modal-actions"><button class="button quiet" data-close>Close</button></div>`);
    if ($('comparison-resume')) $('comparison-resume').onclick = () => render();
    $('comparison-unranked').onclick = () => start({mode:'queue'});
    $('comparison-single').onclick = () => start({mode:'single',ids:[$('comparison-ride').value]});
    $('comparison-full').onclick = () => start({mode:'full'});
  }
  function card(r, label, rank) {
    const pov = r.pov || `https://www.youtube.com/results?search_query=${encodeURIComponent(`${r.name} ${r.park} roller coaster POV`)}`;
    const rcdb = r.rcdb || `https://rcdb.com/qs.htm?qs=${encodeURIComponent(`${r.name} ${r.park}`)}`;
    return `<article class="comparison-card"><span class="comparison-label">${label}</span>${A.art(r)}<h3>${esc(r.name)}</h3><p>${esc(r.park || 'Park not specified')}</p><small>${esc(rank)}${r.type ? ' · '+esc(r.type) : ''}</small>${r.notes ? `<details><summary>Personal notes</summary><p class="comparison-notes">${esc(r.notes)}</p></details>` : ''}<div class="comparison-links"><a href="${esc(pov)}" target="_blank" rel="noopener noreferrer">${r.pov ? 'Watch POV' : 'Find POV'} ↗</a><a href="${esc(rcdb)}" target="_blank" rel="noopener noreferrer">${r.rcdb ? 'RCDB' : 'Find RCDB'} ↗</a></div></article>`;
  }
  function render(focusId) {
    if (!session) { choices(); return; }
    const previousScroll = active() && focusId ? $('modal').scrollTop : 0;
    const rides = A.getState().rides, target = rides.find(r => r.id === session.queue[session.index]);
    const refs = anchors(), search = Q.search(refs.length,session.answers), full = session.mode === 'full';
    const current = rides.filter(r => r.ranked).findIndex(r => r.id === target.id)+1;
    const title = full ? 'Rebuild your ranking' : session.mode === 'single' ? 'Find this ride’s place' : 'Rank your unranked credits';
    const progress = `${session.index} of ${session.queue.length} reviewed · ${session.placed.length} saved${session.skipped.length ? ' · '+session.skipped.length+' skipped' : ''}`;
    const result = search.position + 1;
    A.openModal(`${A.modalHeader(title)}<div id="comparison-session" class="modal-body comparison-body"><div class="comparison-progress"><span>${progress}</span><progress value="${session.index}" max="${session.queue.length}" aria-label="Rides reviewed"></progress></div>${search.done ? `<div class="comparison-result" role="status"><span>${refs.length ? 'Your suggested place' : 'Your first ride'}</span><strong>#${result}</strong><p>${full ? `Among ${refs.length+1} compared rides in this rebuild. The remaining rides keep their places until you compare them.` : refs.length ? 'Save this position, or go back to change an answer.' : 'Save this ride to start your ranking.'}</p></div>${card(target,'Ride to place',current ? 'Currently #'+current : 'Unranked')}${refs.length ? `<p class="comparison-neighbors">${result > 1 ? 'Below '+esc(refs[result-2].name) : 'At the top'}${result <= refs.length ? ' · Above '+esc(refs[result-1].name) : ' · At the bottom'}</p>` : ''}` : `<p id="comparison-question" class="comparison-question" role="status">Do you prefer <strong>${esc(target.name)}</strong> to <strong>${esc(refs[search.pivot].name)}</strong>?</p><div class="comparison-pair">${card(target,'Ride to place',current ? 'Currently #'+current : 'Unranked')}${card(refs[search.pivot],'Compare against','#'+(search.pivot+1)+(full ? ' in this rebuild' : ''))}</div><div class="comparison-answers" role="group" aria-labelledby="comparison-question"><button class="button" data-comparison-answer="much-better"><strong>Much better</strong><span>Jump toward the top <kbd>1</kbd></span></button><button class="button primary" data-comparison-answer="better"><strong>Better</strong><span>I prefer this ride <kbd>2</kbd></span></button><button class="button" data-comparison-answer="worse"><strong>Worse</strong><span>I prefer the other ride <kbd>3</kbd></span></button><button class="button" data-comparison-answer="much-worse"><strong>Much worse</strong><span>Jump toward the bottom <kbd>4</kbd></span></button></div><p class="comparison-help">Possible position: #${search.low+1}–#${search.high+1} · ${session.answers.length} answers. Strong answers change the next question; every placement is still based on your comparisons.</p>`}<p class="privacy-note">${storageCopy()}</p></div><div class="modal-actions comparison-actions"><button class="button quiet" id="comparison-back" ${session.answers.length ? '' : 'disabled'}>Back</button><button class="button quiet" id="comparison-skip">Skip ride</button><button class="button quiet" id="comparison-pause">Pause</button>${search.done ? '<button class="button primary" id="comparison-save">Save position</button>' : ''}</div>`);
    document.querySelectorAll('[data-comparison-answer]').forEach(b => b.onclick = () => answer(b.dataset.comparisonAnswer));
    $('comparison-back').onclick = () => { session.answers.pop(); persist(); render('comparison-back'); };
    $('comparison-skip').onclick = () => { session.skipped.push(target.id); advance(); };
    $('comparison-pause').onclick = () => { A.closeModal(); A.toast('Quiz paused. Resume from your ranking.',false); };
    if (search.done) $('comparison-save').onclick = () => save(target,refs,search.position);
    const focus = focusId ? $(focusId) || document.querySelector(`[data-comparison-answer="${focusId}"]`) : search.done ? $('comparison-save') : document.querySelector('[data-comparison-answer="better"]');
    $('modal').scrollTop = search.done ? 0 : previousScroll;
    (focus && !focus.disabled ? focus : $('comparison-save') || document.querySelector('[data-comparison-answer="better"]') || $('comparison-pause')).focus({preventScroll:true});
    $('announcement').textContent = search.done ? `${target.name}: suggested position ${result}${full ? ' in this rebuild' : ''}. Review and save.` : `Do you prefer ${target.name} to ${refs[search.pivot].name}? Possible position ${search.low+1} to ${search.high+1}.`;
  }
  function answer(value) {
    if (!session || !Q.ANSWERS.includes(value) || Q.search(anchors().length,session.answers).done) return;
    session.answers.push(value); persist(); render(value);
  }
  function save(target,refs,position) {
    const placed = session.mode === 'full' ? [...session.placed] : refs.map(r => r.id);
    placed.splice(position,0,target.id);
    const rides = A.getState().rides;
    const next = session.mode === 'full' ? Q.weave(rides,placed) : C.move(rides,[target.id],position+1);
    applying = true;
    let ok;
    try { ok = A.change({rides:next},`${target.name} ranked${session.mode === 'full' ? ' in your rebuild' : ' #'+(position+1)}.`); }
    finally { applying = false; }
    if (!ok) return;
    session.placed = session.mode === 'full' ? placed : [...session.placed,target.id];
    session.expected = signature(); advance();
  }
  function advance() {
    session.index++; session.answers = [];
    if (session.index < session.queue.length) { persist(); render(); return; }
    const {placed,skipped} = session;
    session = null; persist();
    A.openModal(`${A.modalHeader('Quiz complete')}<div class="modal-body comparison-body"><div class="comparison-result"><strong>${placed.length}</strong><p>${placed.length === 1 ? 'ride' : 'rides'} ranked${skipped.length ? ' · '+skipped.length+' skipped' : ''}.</p></div><p>Your confirmed placements are saved with your collection. Skipped rides keep their previous ranking status.</p></div><div class="modal-actions"><button class="button primary" id="comparison-done">View ranking</button></div>`);
    $('comparison-done').onclick = () => { A.closeModal(); A.setView('ranked'); };
    $('comparison-done').focus();
  }
  document.addEventListener('tracklist:render',() => {
    if (applying) return;
    if (owner !== A.getStorageKey()) { owner = A.getStorageKey(); load(); }
    else if (session && session.expected !== signature()) {
      const wasActive = active(); session = null; persist();
      if (wasActive) { A.closeModal(); A.toast('Your ranking changed. Start a fresh comparison quiz with the updated list.',false); }
    }
    updateButton();
  });
  window.addEventListener('storage',e => {
    if (e.key !== key()) return;
    const wasActive = active(); load(); updateButton();
    if (wasActive) { A.closeModal(); A.toast('Quiz progress changed in another tab. Resume to continue.',false); }
  });
  document.addEventListener('keydown',e => {
    if (!active() || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.target.matches('input,textarea,select,[contenteditable]')) return;
    const index = ['1','2','3','4'].indexOf(e.key);
    if (index >= 0 && !$('comparison-save')) { e.preventDefault(); answer(Q.ANSWERS[index]); }
  });
  globalThis.TracklistQuiz = {start,choices};
  $('compare-button').onclick = choices;
  load(); updateButton();
})();
