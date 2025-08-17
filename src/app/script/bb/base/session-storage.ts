/**
 * sessionStorage wrapper that does not throw exceptions.
 * Some browsers may throw "Failed to read the 'sessionStorage' property from 'Window': Access is denied for this document."
 */
export class SessionStorage {
    private static error: unknown | undefined;

    static getItem(key: string): string | null {
        // (disabled) eslint-disable-next-line no-null/no-null
        let result = null;
        try {
            result = sessionStorage.getItem(key);
        } catch (e) {
            this.error = e;
        }
        return result;
    }

    static setItem(key: string, value: string): void {
        try {
            sessionStorage.setItem(key, value);
        } catch (e) {
            this.error = e;
        }
    }

    static removeItem(key: string): void {
        try {
            sessionStorage.removeItem(key);
        } catch (e) {
            this.error = e;
        }
    }

    static getError(): unknown {
        return this.error;
    }
}
