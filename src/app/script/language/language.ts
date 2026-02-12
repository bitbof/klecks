import { english, languages, loadLanguage, TTranslationCode } from '../../languages/languages';
import { LocalStorage } from '../bb/base/local-storage';

export const LS_LANGUAGE_KEY = 'klecks-language';

class LanguageStrings {
    private data: Record<string, string>; // Properly typed
    private listeners: (() => void)[] = [];
    private code: string;

    // ----------------------------------- public -----------------------------------
    constructor() {
        // need to use setLanguage for a different language
        this.data = { ...english };
        this.code = 'en';
    }

    async setLanguage(langCode: string): Promise<void> {
        if (langCode === 'en') {
            this.data = { ...english };
        } else {
            try {
                const langData = await loadLanguage(langCode);
                this.data = { ...english, ...langData };
                
                // Save to localStorage on successful language change
                try {
                    LocalStorage.setItem(LS_LANGUAGE_KEY, langCode);
                } catch (e) {
                    // Silently fail - localStorage might be disabled
                    console.debug('Failed to save language preference:', e);
                }
            } catch (e) {
                console.error(`Failed to load language: ${langCode}`, e);
                // Fall back to English
                this.data = { ...english };
                langCode = 'en';
            }
        }
        
        this.code = langCode;
        document.documentElement.setAttribute('lang', langCode);
        
        // Notify all listeners
        this.listeners.forEach((item) => {
            try {
                item();
            } catch (e) {
                console.error('Error in language change listener:', e);
            }
        });
    }

    get(code: TTranslationCode): string {
        if (!(code in this.data)) {
            console.warn(`Translation code doesn't exist: ${code}, falling back to empty string`);
            return code; // Return the code itself as fallback instead of throwing
        }
        return this.data[code];
    }

    getLanguage(): { code: string; name: string } | undefined {
        const language = languages.find((item) => item.code === this.code);
        
        if (!language) {
            console.warn(`Language not found for code: ${this.code}, falling back to English`);
            return languages.find((item) => item.code === 'en')!;
        }
        
        return language;
    }

    getAutoLanguage(): { code: string; name: string } {
        const autoCode = getLanguage(false);
        const language = languages.find((item) => item.code === autoCode);
        
        if (!language) {
            // Fallback to English if auto-detected language not found
            return languages.find((item) => item.code === 'en')!;
        }
        
        return language;
    }

    getCode(): string {
        return this.code;
    }

    // get notified on language change
    subscribe(subscriber: () => void): () => void {
        if (!this.listeners.includes(subscriber)) {
            this.listeners.push(subscriber);
        }
        
        // Return unsubscribe function for easier cleanup
        return () => this.unsubscribe(subscriber);
    }

    unsubscribe(subscriber: () => void): void {
        const index = this.listeners.indexOf(subscriber);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }

    // Get available languages
    getAvailableLanguages(): { code: string; name: string }[] {
        return [...languages];
    }
}

export function getLanguage(useLocalStorage: boolean = true): string {
    // First check localStorage if enabled
    if (useLocalStorage) {
        try {
            const storedLang = LocalStorage.getItem(LS_LANGUAGE_KEY);
            if (storedLang) {
                const found = languages.some(
                    (item) => item.code.toLowerCase() === storedLang.toLowerCase()
                );
                if (found) {
                    return storedLang;
                }
            }
        } catch (e) {
            // localStorage not available - continue to browser languages
            console.debug('localStorage not available for language detection');
        }
    }

    // Check browser languages
    const navLangs = navigator.languages && navigator.languages.length 
        ? [...navigator.languages] 
        : [navigator.language || 'en'];
    
    // Flatten language codes with and without region
    const browserLangs = navLangs.flatMap(item => {
        const split = item.split('-');
        return split.length === 2 ? [item, split[0]] : [item];
    });

    // Find first matching language
    for (const browserLang of browserLangs) {
        const found = languages.find(
            (item) => item.code.toLowerCase() === browserLang.toLowerCase()
        );
        if (found) {
            return found.code;
        }
    }

    // Default to English
    return 'en';
}

// Initialize with proper async handling
export const LANGUAGE_STRINGS = new LanguageStrings();

// Initialize language without blocking
export const initLANG = async (): Promise<void> => {
    const activeLanguageCode = getLanguage(true);
    await LANGUAGE_STRINGS.setLanguage(activeLanguageCode);
};

// Improved LANG function with better replace handling
export const LANG = (code: TTranslationCode, replace?: Record<string, string | number>): string => {
    let result = LANGUAGE_STRINGS.get(code);
    
    if (replace && Object.keys(replace).length > 0) {
        Object.entries(replace).forEach(([key, value]) => {
            // Handle both string and number values, escape regex special chars
            const safeValue = String(value);
            result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), safeValue);
        });
    }
    
    return result;
};

// Utility function to change language at runtime
export const changeLanguage = async (langCode: string): Promise<boolean> => {
    try {
        await LANGUAGE_STRINGS.setLanguage(langCode);
        return true;
    } catch (e) {
        console.error('Failed to change language:', e);
        return false;
    }
};

// Auto-initialize if not in test environment
if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
    // Don't block on init
    initLANG().catch(e => {
        console.error('Failed to initialize language system:', e);
    });
}