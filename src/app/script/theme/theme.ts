import { addIsDarkListener, isDark } from '../bb/base/base';
import { LocalStorage } from '../bb/base/local-storage';

const LS_THEME_KEY = 'klecks-theme';

export type TTheme = 'dark' | 'light';
type TThemeListener = () => void;

class Theme {
    private storedTheme: TTheme | undefined;
    // initialization will be overwritten.
    private mediaQueryTheme: TTheme = 'light'; // prefers-color-scheme
    private theme: TTheme = 'light';
    private readonly listeners: TThemeListener[] = [];

    private updateTheme(): void {
        const oldTheme = this.theme;
        this.theme = this.storedTheme || this.mediaQueryTheme;

        if (this.theme === oldTheme) {
            return;
        }
        document.documentElement.classList.toggle('kl-theme-dark', this.theme === 'dark');
        this.listeners.forEach((item) => item());
    }

    private readLocalStorage(): TTheme | undefined {
        let result = LocalStorage.getItem(LS_THEME_KEY) as unknown;
        if (!result || (typeof result === 'string' && !['dark', 'light'].includes(result))) {
            result = undefined;
            LocalStorage.removeItem(LS_THEME_KEY); // reset because invalid
        }
        return result as TTheme | undefined;
    }

    // ----------------------------------- public -----------------------------------
    constructor() {
        // init media query
        this.mediaQueryTheme = isDark() ? 'dark' : 'light';
        addIsDarkListener(() => {
            this.mediaQueryTheme = isDark() ? 'dark' : 'light';
            this.updateTheme();
        });

        // init local storage
        this.storedTheme = this.readLocalStorage();
        addEventListener('storage', (e) => {
            if (e.key === LS_THEME_KEY) {
                this.storedTheme = this.readLocalStorage();
                this.updateTheme();
            }
        });

        this.updateTheme();
    }

    isDark(): boolean {
        return this.theme === 'dark';
    }

    addIsDarkListener(func: TThemeListener): void {
        if (this.listeners.includes(func)) {
            return;
        }
        this.listeners.push(func);
    }

    removeIsDarkListener(func: TThemeListener): void {
        for (let i = 0; i < this.listeners.length; i++) {
            if (this.listeners[i] === func) {
                this.listeners.splice(i, 1);
                return;
            }
        }
    }

    getMediaQueryTheme(): TTheme {
        return this.mediaQueryTheme;
    }

    getStoredTheme(): TTheme | undefined {
        return this.storedTheme;
    }

    setStoredTheme(theme: TTheme | undefined): void {
        if (theme) {
            LocalStorage.setItem(LS_THEME_KEY, theme);
        } else {
            LocalStorage.removeItem(LS_THEME_KEY);
        }
        this.storedTheme = theme;
        this.updateTheme();
    }
}

export const THEME = new Theme();
