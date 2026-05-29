const fs = require('fs');
const path = require('path');

const root = process.cwd();
const targets = [
  {
    name: 'Home',
    files: [
      path.join(root, 'frontend', 'app', '(tabs)', 'index.tsx'),
      path.join(root, 'app', '(tabs)', 'index.tsx'),
    ],
    fetchCall: 'fetchAll()',
    bodyExtra: '',
  },
  {
    name: 'History',
    files: [
      path.join(root, 'frontend', 'app', '(tabs)', 'history.tsx'),
      path.join(root, 'app', '(tabs)', 'history.tsx'),
    ],
    fetchCall: 'fetchData()',
    bodyExtra: '      setSelectedIds(new Set());\n',
  },
];

function firstExisting(files) {
  return files.find((f) => fs.existsSync(f));
}

function rel(file) {
  return path.relative(root, file);
}

function ensureReactHooks(code, hooks) {
  if (/import React, \{[^}]*\} from ['"]react['"];/.test(code)) {
    return code.replace(/import React, \{([^}]*)\} from ['"]react['"];\s*/, (match, inside) => {
      const parts = inside.split(',').map((x) => x.trim()).filter(Boolean);
      for (const hook of hooks) {
        if (!parts.includes(hook)) parts.push(hook);
      }
      return `import React, { ${[...new Set(parts)].join(', ')} } from 'react';\n`;
    });
  }

  if (/import React from ['"]react['"];/.test(code)) {
    return code.replace(/import React from ['"]react['"];\s*/, `import React, { ${hooks.join(', ')} } from 'react';\n`);
  }

  return `import React, { ${hooks.join(', ')} } from 'react';\n${code}`;
}

function removeReactHook(code, hook) {
  return code.replace(/import React, \{([^}]*)\} from ['"]react['"];\s*/, (match, inside) => {
    const parts = inside.split(',').map((x) => x.trim()).filter(Boolean).filter((x) => x !== hook);
    return `import React, { ${parts.join(', ')} } from 'react';\n`;
  });
}

function removeUseFocusImports(code) {
  code = code.replace(/\n?import \{ useFocusEffect \} from ['"]@react-navigation\/native['"];\s*/g, '\n');
  code = code.replace(/\n?import \{ useFocusEffect \} from ['"]expo-router['"];\s*/g, '\n');
  return code;
}

function ensureRefs(code) {
  if (code.includes('const didInitialFetchRef = useRef(false);') && code.includes('const lastLoadedBudgetIdRef = useRef<string | null>(null);')) {
    return code;
  }

  const refBlock = `\n  const didInitialFetchRef = useRef(false);\n  const lastLoadedBudgetIdRef = useRef<string | null>(null);`;

  if (code.includes('const amountInputRef = useRef(null);')) {
    return code.replace(/const amountInputRef = useRef\(null\);\s*/, (m) => `${m}${refBlock}\n`);
  }

  const firstState = code.match(/\n\s*const \[[^\]]+\] = useState[^;]+;/);
  if (firstState) {
    return code.replace(firstState[0], `${firstState[0]}${refBlock}`);
  }

  return code;
}

function findMatchingParen(str, openIndex) {
  let depth = 0;
  let inString = null;
  let escaped = false;

  for (let i = openIndex; i < str.length; i++) {
    const ch = str[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === inString) {
        inString = null;
      }
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

function removeUseFocusEffectBlock(code) {
  const idx = code.indexOf('useFocusEffect(');
  if (idx === -1) return code;

  const start = code.lastIndexOf('\n', idx);
  const open = code.indexOf('(', idx);
  const close = findMatchingParen(code, open);
  if (close === -1) return code;

  let end = close + 1;
  while (code[end] && /\s/.test(code[end])) end++;
  if (code[end] === ';') end++;

  return code.slice(0, start >= 0 ? start : idx) + code.slice(end);
}

function buildEffect({ name, fetchCall, bodyExtra }) {
  const label = name.toLowerCase();
  return `\n\n  useEffect(() => {\n    if (!token) {\n      setLoading(false);\n      return;\n    }\n\n    const budgetKey = selectedBudgetId || '__none__';\n\n    if (didInitialFetchRef.current && lastLoadedBudgetIdRef.current === budgetKey) {\n      return;\n    }\n\n    didInitialFetchRef.current = true;\n    lastLoadedBudgetIdRef.current = budgetKey;\n    setLoading(true);\n${bodyExtra}    Promise.resolve(${fetchCall})\n      .catch((error) => {\n        console.error('Failed to load ${label} data:', error);\n      })\n      .finally(() => {\n        setLoading(false);\n      });\n  }, [token, selectedBudgetId]);`;
}

function insertEffect(code, effect) {
  // Put the effect before the first early return/render branch.
  const markers = [
    '\n  if (loading)',
    '\n  if (!token)',
    '\n  return (',
  ];

  for (const marker of markers) {
    const idx = code.indexOf(marker);
    if (idx !== -1) {
      return code.slice(0, idx) + effect + code.slice(idx);
    }
  }

  return code + effect;
}

function patchTarget(target) {
  const file = firstExisting(target.files);
  if (!file) {
    console.warn(`skipped ${target.name}: file not found`);
    return;
  }

  const before = fs.readFileSync(file, 'utf8');
  let code = before;

  code = ensureReactHooks(code, ['useEffect', 'useRef']);
  code = removeReactHook(code, 'useCallback');
  code = removeUseFocusImports(code);
  code = ensureRefs(code);

  // Remove stale refs from previous patch if present; keep the new single source of truth.
  code = code.replace(/\n\s*const lastFetchedBudgetIdRef = useRef<string \| null>\(null\);/g, '');

  code = removeUseFocusEffectBlock(code);

  // Remove the previous generated data-load effect if this patch is re-run.
  code = code.replace(/\n\n  useEffect\(\(\) => \{\n\s*if \(!token\) \{\n\s*setLoading\(false\);\n\s*return;\n\s*\}\n\n\s*const budgetKey = selectedBudgetId \|\| '__none__';[\s\S]*?\n  \}, \[token, selectedBudgetId\]\);/m, '');

  code = insertEffect(code, buildEffect(target));

  if (code !== before) {
    fs.writeFileSync(file, code, 'utf8');
    console.log(`updated: ${rel(file)}`);
  } else {
    console.log(`unchanged: ${rel(file)}`);
  }
}

for (const target of targets) {
  patchTarget(target);
}

console.log('\nData load fix applied. Next:');
console.log('  git diff');
console.log('  npx expo start -c');
console.log('\nExpected behavior: Home/History fetch once on initial token/budget readiness, not on normal tab switches.');
