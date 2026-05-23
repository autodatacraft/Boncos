import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { storage } from '@/src/utils/storage';
import { Language, t } from '@/src/utils/i18n';

type LanguageContextType = {
  lang: Language;
  setLang: (l: Language) => void;
  s: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType>({
  lang: 'id',
  setLang: () => {},
  s: (key: string) => key,
});

export const useLanguage = () => useContext(LanguageContext);

const LANG_KEY = 'boncos_language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('id');

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem(LANG_KEY, 'id');
      if (saved === 'id' || saved === 'en') setLangState(saved);
    })();
  }, []);

  const setLang = useCallback(async (l: Language) => {
    setLangState(l);
    await storage.setItem(LANG_KEY, l);
  }, []);

  const s = useCallback((key: string): string => {
    return t[key]?.[lang] || key;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, s }), [lang, setLang, s]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
