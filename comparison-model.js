(function(root) {
  'use strict';
  const ANSWERS = ['much-better','better','worse','much-worse'];
  function search(count, answers = []) {
    if (!Number.isInteger(count) || count < 0 || count > 5000 || !Array.isArray(answers) || answers.length > 64) throw new Error('Invalid comparison search.');
    let low = 0, high = count, pivot = Math.floor(count / 2);
    for (const answer of answers) {
      if (!ANSWERS.includes(answer) || low === high) throw new Error('Invalid comparison answer.');
      if (answer.endsWith('better')) high = pivot;
      else low = pivot + 1;
      // Strong answers change the next question, never infer comparisons with untested rides.
      const bias = answer === 'much-better' ? .2 : answer === 'much-worse' ? .8 : .5;
      pivot = low + Math.floor((high - low) * bias);
    }
    return {low, high, pivot: low === high ? null : pivot, done: low === high, position: low};
  }
  function weave(rides, placed) {
    const ids = new Set(placed), byId = new Map(rides.map(r => [r.id,r]));
    if (ids.size !== placed.length || placed.some(id => !byId.has(id))) throw new Error('Invalid compared rides.');
    // Keep unprocessed ranked slots in place while ordering processed slots by the new comparisons.
    const slots = rides.filter(r => r.ranked).map(r => ids.has(r.id) ? null : r);
    for (const id of placed) if (!byId.get(id).ranked) slots.push(null);
    let index = 0;
    const ranked = slots.map(r => r || {...byId.get(placed[index++]),ranked:true});
    return [...ranked,...rides.filter(r => !r.ranked && !ids.has(r.id))];
  }
  const api = {ANSWERS,search,weave};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TracklistComparison = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
