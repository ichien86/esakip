const fs = require('fs');

let content = fs.readFileSync('src/app/globals.css', 'utf8');

const replacements = [
  { search: 'background: rgba(255, 255, 255, 0.05);', replace: 'background: var(--item-bg);' },
  { search: 'background: rgba(255, 255, 255, 0.02);', replace: 'background: var(--item-hover-bg);' },
  { search: 'border-left: 2px dashed rgba(255, 255, 255, 0.15);', replace: 'border-left: 2px dashed var(--glass-border);' },
  { search: 'background: rgba(255, 255, 255, 0.04);', replace: 'background: var(--item-bg);' },
  { search: 'background: rgba(255, 255, 255, 0.08);', replace: 'background: var(--item-hover-bg);' },
  { search: 'background: rgba(255, 255, 255, 0.03);', replace: 'background: var(--item-bg);' },
  { search: 'background: rgba(255, 255, 255, 0.04) !important;', replace: 'background: var(--item-hover-bg) !important;' },
  { search: 'border-color: rgba(255, 255, 255, 0.1) !important;', replace: 'border-color: var(--glass-border) !important;' },
  { search: 'color: white;', replace: 'color: var(--text-primary);' }
];

// We want to be careful with 'color: white;'.
// Let's only replace it if it's inside .ql-toolbar or if we specifically target it.
// Actually, earlier I found 4 instances of "color: white;" in globals.css.
// .btn-primary, .btn-orange, .btn-danger, and .ql-toolbar.
// I should ONLY replace it for .ql-toolbar.

// Let's do it with regex to be safer for the specific blocks
content = content.replace(/\.user-simulator-box\s*\{[^}]*\}/g, match => match.replace('rgba(255, 255, 255, 0.05)', 'var(--item-bg)'));
content = content.replace(/\.table tbody tr:hover\s*\{[^}]*\}/g, match => match.replace('rgba(255, 255, 255, 0.02)', 'var(--item-hover-bg)'));
content = content.replace(/\.timeline-item::before\s*\{[^}]*\}/g, match => match.replace('rgba(255, 255, 255, 0.15)', 'var(--glass-border)'));
content = content.replace(/\.timeline-content\s*\{[^}]*\}/g, match => match.replace('rgba(255, 255, 255, 0.04)', 'var(--item-bg)'));
content = content.replace(/\.timeline-content:hover\s*\{[^}]*\}/g, match => match.replace('rgba(255, 255, 255, 0.08)', 'var(--item-hover-bg)'));
content = content.replace(/\.form-section\s*\{[^}]*\}/g, match => match.replace('rgba(255, 255, 255, 0.05)', 'var(--item-bg)'));
content = content.replace(/\.evaluation-item\s*\{[^}]*\}/g, match => match.replace('rgba(255, 255, 255, 0.03)', 'var(--item-bg)'));
content = content.replace(/\.review-box\s*\{[^}]*\}/g, match => match.replace('rgba(255, 255, 255, 0.05)', 'var(--item-bg)'));
content = content.replace(/\.row-highlight\s*\{[^}]*\}/g, match => match.replace('rgba(255, 255, 255, 0.02)', 'var(--item-bg)'));
content = content.replace(/\.row-highlight:hover\s*\{[^}]*\}/g, match => match.replace('rgba(255, 255, 255, 0.04)', 'var(--item-hover-bg)'));
content = content.replace(/\.ql-toolbar\s*\{[^}]*\}/g, match => match.replace('rgba(255, 255, 255, 0.05)', 'var(--item-bg)').replace('rgba(255, 255, 255, 0.1)', 'var(--glass-border)').replace('color: white;', 'color: var(--text-primary);'));
content = content.replace(/\.ql-container\s*\{[^}]*\}/g, match => match.replace('rgba(255, 255, 255, 0.1)', 'var(--glass-border)'));

fs.writeFileSync('src/app/globals.css', content, 'utf8');
console.log('globals.css updated successfully.');
