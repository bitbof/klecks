import { canRegisterServiceWorker } from './can-register-service-worker';

// Registering this service worker allows the app to be accessible and
// fully functional when offline (after an initial visit for caching).
if (canRegisterServiceWorker()) {
    void navigator.serviceWorker.register(
        new URL('../../../klecks-service-worker.ts', import.meta.url),
        {
            type: 'module',
            // Parcel produces a stable url for the service worker so we must revalidate every time.
            updateViaCache: 'none',
        },
    );
}
