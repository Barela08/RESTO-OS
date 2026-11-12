const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'services', 'databaseAdapter.ts');
let content = fs.readFileSync(file, 'utf8');

// Replace .catch(err => ...) on supabase calls with .then(() => {}, (err: any) => ...)
content = content.replace(/\.catch\(\s*(?:err|\(err:\s*unknown\))\s*=>\s*([^)]+\))\);?/g, (match, body) => {
  return `.then(() => {}, (err: any) => ${body});`;
});

// Also remove any stray void Promise.resolve( that may have been wrapped
content = content.replace(/void Promise\.resolve\(\s*([\s\S]+?)\s*\)\.then\(\(\) => {},/g, (match, inner) => {
  return `${inner}.then(() => {},`;
});

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed supabase PromiseLike handlers in databaseAdapter.ts');
