const fs = require('fs');

function attrExists(html, selector){
  // very small heuristic checks
  if(selector === 'lang') return /<html[^>]*\slang=(["'])(.*?)\1/i.test(html) ? RegExp.$2 : null;
  if(selector === 'skipLink') return /class=["']?skip-link["' ]?/i.test(html);
  if(selector === 'ariaLive') return /id=["']?siteNotifications["']?[^>]*aria-live=["']?[^"'>]+["']?/i.test(html);
  if(selector === 'tablist') return /role=["']?tablist["']?/i.test(html);
  if(selector === 'tab') return /role=["']?tab["']?/i.test(html);
  if(selector === 'dialog') return /role=["']?dialog["']?/i.test(html);
  return false;
}

function check(path){
  const html = fs.readFileSync(path,'utf8');
  return {
    file: path,
    lang: attrExists(html, 'lang'),
    skipLink: !!attrExists(html, 'skipLink'),
    ariaLive: !!attrExists(html, 'ariaLive'),
    tablist: !!attrExists(html, 'tablist'),
    tabs: !!attrExists(html, 'tab'),
    dialogs: !!attrExists(html, 'dialog')
  };
}

const files = ['index.html','communes.html'];
const report = files.map(f=> check(f));
console.log(JSON.stringify(report, null, 2));
