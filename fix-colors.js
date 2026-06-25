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

const files = walk('./src');
let changedFiles = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(/color:\s*'(?:white|#fff|#ffffff)'/gi, (match, offset, string) => {
    const before = string.slice(Math.max(0, offset - 50), offset);
    if (
      before.includes('var(--info)') || 
      before.includes('var(--danger)') || 
      before.includes('var(--primary-orange)') || 
      before.includes('#10B981') || 
      before.includes('#F59E0B') || 
      before.includes('#3b82f6') || 
      before.includes('#EF4444')
    ) {
      return match;
    }
    return "color: 'var(--text-primary)'";
  });
  
  // also check color: "white"
  newContent = newContent.replace(/color:\s*"(?:white|#fff|#ffffff)"/gi, (match, offset, string) => {
    const before = string.slice(Math.max(0, offset - 50), offset);
    if (
      before.includes('var(--info)') || 
      before.includes('var(--danger)') || 
      before.includes('var(--primary-orange)') || 
      before.includes('#10B981') || 
      before.includes('#F59E0B') || 
      before.includes('#3b82f6') || 
      before.includes('#EF4444')
    ) {
      return match;
    }
    return "color: 'var(--text-primary)'";
  });
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    changedFiles++;
    console.log('Fixed', file);
  }
});
console.log('Changed files:', changedFiles);
