const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src/app');
let modifiedCount = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  content = content.replace(/color:\s*['"]#(f3f4f6|e5e7eb)['"]/g, "color: 'var(--text-primary)'");
  content = content.replace(/color:\s*['"]#(d1d5db)['"]/g, "color: 'var(--text-secondary)'");
  content = content.replace(/color:\s*['"]#(9ca3af|94a3b8)['"]/g, "color: 'var(--text-muted)'");
  
  content = content.replace(/color:\s*['"]rgba\(255,\s*255,\s*255,\s*0\.6\)['"]/g, "color: 'var(--text-muted)'");
  content = content.replace(/color:\s*['"]rgba\(255,\s*255,\s*255,\s*0\.5\)['"]/g, "color: 'var(--text-muted)'");
  content = content.replace(/color:\s*['"]rgba\(255,\s*255,\s*255,\s*0\.4\)['"]/g, "color: 'var(--text-muted)'");
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated:', file);
    modifiedCount++;
  }
});
console.log('Total files updated:', modifiedCount);
