import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '../i18n/en.json';
import hi from '../i18n/hi.json';
import mr from '../i18n/mr.json';

const dictionaries = { en, hi, mr };
const LOCALES = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(() => {
    return localStorage.getItem('finshield_lang') || 'en';
  });

  const setLang = (newLang) => {
    if (['en', 'hi', 'mr'].includes(newLang)) {
      setLangState(newLang);
      localStorage.setItem('finshield_lang', newLang);
    }
  };

  const t = (key, params = {}) => {
    const dict = dictionaries[lang] || dictionaries.en;
    let template = dict[key] ?? dictionaries.en[key] ?? key;

    if (typeof template === 'string') {
      Object.keys(params).forEach((paramKey) => {
        template = template.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), params[paramKey]);
      });
    }

    return template;
  };

  // Translate a fixed English phrase produced by the backend (e.g. the frozen
  // ML model's factor/flag text). Unknown phrases fall back to the original
  // text rather than showing a raw key.
  const tx = (text) => {
    if (!text) return text;
    const dict = dictionaries[lang] || dictionaries.en;
    return dict[`text:${text}`] || text;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tx, locale: LOCALES[lang] || 'en-IN' }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Used only if a component renders outside the provider - in practice that's
// a dev hot-reload swapping the context module under a mounted tree. English
// keeps the page usable instead of crashing it.
const englishFallback = {
  lang: 'en',
  setLang: () => {},
  locale: 'en-IN',
  t: (key, params = {}) => {
    let template = en[key] ?? key;
    Object.keys(params).forEach((k) => {
      template = template.replace(new RegExp(`\\{${k}\\}`, 'g'), params[k]);
    });
    return template;
  },
  tx: (text) => (text && en[`text:${text}`]) || text,
};

export const useLanguage = () => useContext(LanguageContext) || englishFallback;
