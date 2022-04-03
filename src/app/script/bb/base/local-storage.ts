/**
 * LocalStorage wrapper that does not throw exceptions.
 * If cookies disabled in Safari localStorage interactions throw exception "insecure operation"
 */
export class LocalStorage {

    private static error;

    static getItem (key: string): string {
        let result = null;
        try {
            result = localStorage.getItem(key);
        } catch (e) {
            this.error = e;
        }
        return result;
    }

    static setItem (key: string, value: string): void {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            this.error = e;
        }
    }

    static removeItem (key: string): void {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            this.error = e;
        }
    }

    static getError (): any {
        return this.error;
    }
}