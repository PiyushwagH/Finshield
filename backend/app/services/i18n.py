import json
from pathlib import Path
from typing import Dict, Any

_I18N_DIR = Path(__file__).resolve().parent.parent / "i18n"
_TRANSLATIONS: Dict[str, Dict[str, Any]] = {}

def load_translations():
    global _TRANSLATIONS
    for lang in ["en", "hi", "mr"]:
        file_path = _I18N_DIR / f"{lang}.json"
        if file_path.exists():
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    _TRANSLATIONS[lang] = json.load(f)
            except Exception:
                _TRANSLATIONS[lang] = {}
        else:
            _TRANSLATIONS[lang] = {}

def t(key: str, lang: str = "en", default: str = "") -> str:
    if not _TRANSLATIONS:
        load_translations()
    
    lang_code = (lang or "en").lower().strip()
    if lang_code not in ["en", "hi", "mr"]:
        lang_code = "en"
        
    val = _TRANSLATIONS.get(lang_code, {}).get(key)
    if val is not None:
        return val
        
    # Fallback to English
    val_en = _TRANSLATIONS.get("en", {}).get(key)
    if val_en is not None:
        return val_en
        
    return default or key
