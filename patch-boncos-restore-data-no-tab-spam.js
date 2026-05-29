const fs = require('fs');
const path = require('path');

const root = process.cwd();
const candidates = {
  home: [
    path.join(root, 'frontend', 'app', '(tabs)', 'index.tsx'),
    path.join(root, 'app', '(tabs)', 'index.tsx'),
  ],
  history: [
    path.join(root, 'frontend', 'app', '(tabs)', 'history.tsx'),
    path.join(root, 'app', '(tabs)', 'history.tsx'),
  ],
};

function firstExisting(paths) {
  return paths.find((p) => fs.existsSync(p));
}

function rel(file) {
  return path.relative(root, file);
}

function read(file) {
  if (!file) throw new Error('target file not found');
  return fs.readFileSync(file, 'utf8');
}

function write(file, before, after) {
  if (before !== after) {
    fs.writeFileSync(file, after, 'utf8');
    console.log(`updated: ${rel(file)}`);
  } else {
    console.log(`unchanged: ${rel(file)}`);
  }
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function ensureReactNamedImports(code, names) {
  if (/import React, \{[^}]*\} from ['"]react['"];/.test(code)) {
    return code.replace(/import React, \{([^}]*)\} from ['"]react['"];\s*/, (_, inside) => {
      const current = inside.split(',').map((x) => x.trim()).filter(Boolean);
      return `import React, { ${uniq([...current, ...names]).join(', ')} } from 'react';\n`;
    });
  }

  if (/import React from ['"]react['"];/.test(code)) {
    return code.replace(/import React from ['"]react['"];\s*/, `import React, { ${names.join(', ')} } from 'react';\n`);
  }

  return `import React, { ${names.join(', ')} } from 'react';\n${code}`;
}

function ensureUseFocusImport(code) {
  if (code.includes("from '@react-navigation/native'") && code.includes('useFocusEffect')) return code;
  if (/import \{[^}]*\} from ['"]@react-navigation\/native['"];/.test(code)) {
    return code.replace(/import \{([^}]*)\} from ['"]@react-navigation\/native['"];\s*/, (_, inside) => {
      const current = inside.split(',').map((x) => x.trim()).filter(Boolean);
      return `import { ${uniq([...current, 'useFocusEffect']).join(', ')} } from '@react-navigation/native';\n`;
    });
  }
  return code.replace(/(import[^;]+;\s*)/, `$1\nimport { useFocusEffect } from '@react-navigation/native';\n`);
}

function findMatchingParen(str, openIndex) {
  let depth = 0;
  let inString = null;
  let escaped = false;
  for (let i = openIndex; i < str.length; i++) {
    const ch = str[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function removeAllCalls(code, callee) {
  while (true) {
    const idx = code.indexOf(`${callee}(`);
    if (idx === -1) return code;
    const start = code.lastIndexOf('\n', idx);
    const open = code.indexOf('(', idx);
    const close = findMatchingParen(code, open);
    if (close === -1) return code;
    let end = close + 1;
    while (code[end] && /\s/.test(code[end])) end++;
    if (code[end] === ';') end++;
    code = code.slice(0, start >= 0 ? start : idx) + code.slice(end);
  }
}

function removeGeneratedRefs(code) {
  // Remove the refs from previous patches so we can install one clean set.
  code = code
    .replace(/\n\s*const didInitialFetchRef = useRef\(false\);/g, '')
    .replace(/\n\s*const lastLoadedBudgetIdRef = useRef<string \| null>\(null\);/g, '')
    .replace(/\n\s*const lastFetchedBudgetIdRef = useRef<string \| null>\(null\);/g, '')
    .replace(/\n\s*const hasFetchedOnceRef = useRef\(false\);/g, '')
    .replace(/\n\s*const lastBudgetKeyRef = useRef<string \| null>\(null\);/g, '');
  return code;
}

function insertRefs(code) {
  const refs = `\n  const hasFetchedOnceRef = useRef(false);\n  const lastBudgetKeyRef = useRef<string | null>(null);`;
  if (code.includes('const amountInputRef = useRef(null);')) {
    return code.replace(/const amountInputRef = useRef\(null\);\s*/, (m) => `${m}${refs}\n`);
  }
  const firstState = code.match(/\n\s*const \[[^\]]+\] = useState[^;]+;/);
  if (firstState) return code.replace(firstState[0], `${firstState[0]}${refs}`);
  return code;
}

function insertBeforeRender(code, block) {
  const markers = ['\n  if (loading)', '\n  if (!token)', '\n  return ('];
  for (const marker of markers) {
    const idx = code.indexOf(marker);
    if (idx !== -1) return code.slice(0, idx) + block + code.slice(idx);
  }
  return code + block;
}

function patchHome() {
  const file = firstExisting(candidates.home);
  const before = read(file);
  let code = before;

  code = ensureReactNamedImports(code, ['useState', 'useCallback', 'useRef']);
  code = ensureUseFocusImport(code);
  code = removeGeneratedRefs(code);
  code = removeAllCalls(code, 'useFocusEffect');
  code = removeAllCalls(code, 'useEffect');
  code = insertRefs(code);

  const block = `\n\n  useFocusEffect(\n    useCallback(() => {\n      if (!token || hasFetchedOnceRef.current) return;\n\n      hasFetchedOnceRef.current = true;\n      lastBudgetKeyRef.current = selectedBudgetId || '__none__';\n      setLoading(true);\n      Promise.resolve(fetchAll())\n        .catch((error) => {\n          console.error('Failed to load home data:', error);\n        })\n        .finally(() => {\n          setLoading(false);\n        });\n    }, [token])\n  );\n\n  useEffect(() => {\n    if (!token || !hasFetchedOnceRef.current) return;\n\n    const budgetKey = selectedBudgetId || '__none__';\n    if (lastBudgetKeyRef.current === budgetKey) return;\n\n    lastBudgetKeyRef.current = budgetKey;\n    setLoading(true);\n    Promise.resolve(fetchAll())\n      .catch((error) => {\n        console.error('Failed to reload home data after budget change:', error);\n      })\n      .finally(() => {\n        setLoading(false);\n      });\n  }, [token, selectedBudgetId]);`;

  code = ensureReactNamedImports(code, ['useEffect']);
  code = insertBeforeRender(code, block);
  write(file, before, code);
}

function patchHistory() {
  const file = firstExisting(candidates.history);
  const before = read(file);
  let code = before;

  code = ensureReactNamedImports(code, ['useState', 'useCallback', 'useRef']);
  code = ensureUseFocusImport(code);
  code = removeGeneratedRefs(code);
  code = removeAllCalls(code, 'useFocusEffect');
  code = removeAllCalls(code, 'useEffect');
  code = insertRefs(code);

  const block = `\n\n  useFocusEffect(\n    useCallback(() => {\n      if (!token || hasFetchedOnceRef.current) return;\n\n      hasFetchedOnceRef.current = true;\n      lastBudgetKeyRef.current = selectedBudgetId || '__none__';\n      setLoading(true);\n      setSelectedIds(new Set());\n      Promise.resolve(fetchData())\n        .catch((error) => {\n          console.error('Failed to load history data:', error);\n        })\n        .finally(() => {\n          setLoading(false);\n        });\n    }, [token])\n  );\n\n  useEffect(() => {\n    if (!token || !hasFetchedOnceRef.current) return;\n\n    const budgetKey = selectedBudgetId || '__none__';\n    if (lastBudgetKeyRef.current === budgetKey) return;\n\n    lastBudgetKeyRef.current = budgetKey;\n    setLoading(true);\n    setSelectedIds(new Set());\n    Promise.resolve(fetchData())\n      .catch((error) => {\n        console.error('Failed to reload history data after budget change:', error);\n      })\n      .finally(() => {\n        setLoading(false);\n      });\n  }, [token, selectedBudgetId]);`;

  code = ensureReactNamedImports(code, ['useEffect']);
  code = insertBeforeRender(code, block);
  write(file, before, code);
}

try {
  patchHome();
  patchHistory();
  console.log('\nApplied restore-data/no-tab-spam fix. Next:');
  console.log('  git diff');
  console.log('  npx expo start -c');
  console.log('\nExpected: Home/History fetch on first screen focus only, not every tab switch. Budget changes still reload.');
} catch (error) {
  console.error('\nPatch failed:', error.message);
  process.exit(1);
}
