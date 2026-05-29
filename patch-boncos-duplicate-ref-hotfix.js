const fs = require('fs');
const path = require('path');

const files = [
  path.join(process.cwd(), 'frontend', 'app', '(tabs)', 'history.tsx'),
  path.join(process.cwd(), 'frontend', 'app', '(tabs)', 'index.tsx'),
];

function dedupeLine(content, linePattern) {
  const lines = content.split(/\r?\n/);
  let seen = false;
  let removed = 0;
  const next = lines.filter((line) => {
    if (linePattern.test(line)) {
      if (seen) {
        removed += 1;
        return false;
      }
      seen = true;
    }
    return true;
  });
  return { content: next.join('\n'), removed };
}

let totalRemoved = 0;

for (const filePath of files) {
  if (!fs.existsSync(filePath)) {
    console.log(`Skipped missing file: ${filePath}`);
    continue;
  }

  const original = fs.readFileSync(filePath, 'utf8');
  let updated = original;

  const result = dedupeLine(
    updated,
    /^\s*const\s+didInitialFetchRef\s*=\s*useRef\s*\(\s*false\s*\)\s*;\s*$/
  );

  updated = result.content;
  totalRemoved += result.removed;

  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`Updated ${filePath}: removed ${result.removed} duplicate didInitialFetchRef declaration(s).`);
  } else {
    console.log(`No duplicate didInitialFetchRef declaration found in ${filePath}.`);
  }
}

console.log(`Done. Total duplicate declarations removed: ${totalRemoved}`);
console.log('Next: run `npx expo start -c` from your project root.');
