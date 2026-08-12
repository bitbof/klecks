export function canRegisterServiceWorker(): boolean {
    if (process.env.NODE_ENV !== 'production') {
        return false;
    }
    if (!('serviceWorker' in navigator) || !window.isSecureContext) {
        return false;
    }
    return true;
}
