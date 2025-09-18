const fs = require('fs');
const vm = require('vm');

const file = fs.readFileSync('./js/chronogramData.js', 'utf8');
// sandbox with a window object
const sandbox = { window: {} };
vm.createContext(sandbox);
try{
  vm.runInContext(file, sandbox, { filename: 'chronogramData.js' });
}catch(e){
  console.error('eval error', e);
  process.exit(2);
}
const tasks = (sandbox.window && sandbox.window.chronogramData && sandbox.window.chronogramData.tasks) || sandbox.window.CHRONO_TASKS || [];
console.log(`Found ${tasks.length} tasks`);

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const soon = new Date(today.getTime() + 14*24*60*60*1000);

function parseDate(s){
  if(!s) return null;
  const d = new Date(s);
  if(!isNaN(d)) return d;
  return null;
}

const upcoming = tasks.map(t=>({t, date: parseDate(t.end||t.due||t.date||t.finish)}))
  .filter(x=> x.date && x.date >= today && x.date <= soon)
  .sort((a,b)=> a.date - b.date);

console.log(`Tasks within ${14} days (inclusive): ${upcoming.length}`);
upcoming.forEach(x=>{
  console.log('-', (x.t.name||x.t.title||x.t.id||'<unnamed>').trim(), '->', (x.date.toISOString().slice(0,10)) );
});

// print all tasks and their end dates (for debugging)
console.log('\nAll tasks (end date):');
tasks.forEach(t=> console.log('-', (t.name||t.title||t.id||'<name>').trim(), '->', (t.end||t.due||t.date||t.finish||'---')));
