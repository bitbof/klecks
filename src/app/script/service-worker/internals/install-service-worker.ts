import { manifest, version } from '@parcel/service-worker';

// For: new URL('https://example.com/paint/help?mode=dark')
// url.origin   // "https://example.com"
// url.pathname // "/paint/help"
// url.search   // "?mode=dark"
// url.href     // "https://example.com/paint/help?mode=dark"

export type CustomInstallContext = {
    cache: Cache;
    serviceWorker: ServiceWorkerGlobalScope;
    appScopeUrl: URL;
};

export type InstallServiceWorkerParams = {
    // Identifies this app's cache
    cachePrefix: string;
    // run at the end of standard install-handler
    customInstall?: (context: CustomInstallContext) => Promise<void>;
    // Updates cached navigation responses after successful network requests.
    doCacheOnNavigation?: boolean;
    // Uses the cached navigation response when the network returns one of these statuses.
    navigationCacheFallbackStatuses?: readonly number[];
    // Maps supported navigations to their canonical Cache Storage key.
    // Return undefined for navigations this worker should not cache or intercept.
    getNavigationCacheUrl: (
        requestUrl: string,
        appScopeUrl: URL,
        navigationAssetUrls: string[],
    ) => string | undefined;
};

/*
A service worker that enables the app to be accessible & functional while offline.
How?
- We put every asset known to Parcel and the app's HTML files into the service worker's cache.
- Known assets are served cache-first.
- App navigations are served network-first, with the cache as a fallback for offline requests and
  configured response statuses.
- Each build gets its own cache. Once a new worker activates, older caches are removed.
*/
export function installServiceWorker({
    cachePrefix,
    getNavigationCacheUrl,
    customInstall,
    doCacheOnNavigation,
    navigationCacheFallbackStatuses,
}: InstallServiceWorkerParams): void {
    if (!version) {
        throw new Error('Service worker build version is missing');
    }

    const serviceWorker = self as unknown as ServiceWorkerGlobalScope;
    const appScopeUrl = new URL(serviceWorker.registration.scope);
    const cacheName = cachePrefix + version;
    const assetUrls = new Set(
        manifest
            .map((url) => new URL(url, appScopeUrl))
            // Fonts are pretty big. Don't precache them.
            // They will be cached once the user has interacted with the text tool.
            .filter((url) => !url.pathname.endsWith('.woff2'))
            .map((url) => url.href),
    );
    const navigationAssetUrls = [
        appScopeUrl.href,
        ...[...assetUrls].filter((url) => new URL(url).pathname.endsWith('.html')),
    ];

    function removeHtmlExtension(urlString: string): string {
        const url = new URL(urlString);
        url.pathname = url.pathname.slice(0, -'.html'.length);
        return url.href;
    }

    function hasContentHash(urlString: string): boolean {
        return /\.[0-9a-f]{8}\./i.test(new URL(urlString).pathname);
    }

    serviceWorker.addEventListener('install', (event) => {
        event.waitUntil(
            (async () => {
                try {
                    // Cache the complete Parcel bundle graph.
                    // Don't fail installation if one fails.
                    const cache = await caches.open(cacheName);
                    const precacheUrls = [...new Set([appScopeUrl.href, ...assetUrls])];
                    const precacheResults = await Promise.allSettled(
                        precacheUrls.map(async (urlStr) => {
                            const url = new URL(urlStr);
                            if (url.pathname.endsWith('.html')) {
                                // some servers remove the ".html", so we follow
                                const response = await fetch(
                                    new Request(urlStr, {
                                        cache: 'default',
                                        redirect: 'follow',
                                    }),
                                );
                                if (!response.ok) {
                                    throw new Error(
                                        `Failed to fetch ${urlStr}: ${response.status}`,
                                    );
                                }
                                if (response.redirected) {
                                    if (
                                        url.href === new URL('index.html', appScopeUrl).href &&
                                        response.url === appScopeUrl.href
                                    ) {
                                        // ignore redirect from /index.html to /
                                        return;
                                    }

                                    // e.g. /index.html might get redirected to /index
                                    const cacheUrl = removeHtmlExtension(urlStr);
                                    if (response.url !== cacheUrl) {
                                        throw new Error(
                                            `Unexpected HTML redirect from ${urlStr} to ${response.url}`,
                                        );
                                    }

                                    // Fetch the redirect destination again, so it's not marked as redirected.
                                    const finalResponse = await fetch(
                                        new Request(cacheUrl, {
                                            cache: 'default',
                                            redirect: 'error',
                                        }),
                                    );
                                    if (!finalResponse.ok) {
                                        throw new Error(
                                            `Failed to fetch ${cacheUrl}: ${finalResponse.status}`,
                                        );
                                    }
                                    await cache.put(cacheUrl, finalResponse);
                                } else {
                                    await cache.put(urlStr, response);
                                }
                            } else {
                                return cache.add(
                                    new Request(url, {
                                        cache: hasContentHash(urlStr) ? 'force-cache' : 'default',
                                        redirect: 'error',
                                    }),
                                );
                            }
                        }),
                    );
                    precacheResults.forEach((result, index) => {
                        if (result.status === 'rejected') {
                            console.error('Failed to precache', precacheUrls[index], result.reason);
                        }
                    });

                    await customInstall?.({
                        cache,
                        serviceWorker,
                        appScopeUrl,
                    });
                } catch (error) {
                    // A failed worker never activates, so clean up its versioned cache here.
                    await caches.delete(cacheName);
                    throw error;
                }
            })(),
        );
    });

    serviceWorker.addEventListener('activate', (event) => {
        event.waitUntil(
            (async () => {
                const cacheNames = await caches.keys();
                await Promise.all(
                    cacheNames
                        .filter(
                            (candidate) =>
                                candidate !== cacheName && candidate.startsWith(cachePrefix),
                        )
                        .map((candidate) => caches.delete(candidate)),
                );
            })(),
        );
    });

    serviceWorker.addEventListener('fetch', (event) => {
        const request = event.request;
        if (request.method !== 'GET') {
            // Let this request be handled normally, as if there were no service worker.
            return;
        }

        if (request.mode !== 'navigate') {
            if (!assetUrls.has(request.url)) {
                // Only intercept assets which are part of this Parcel build.
                return;
            }
            event.respondWith(
                (async () => {
                    const cache = await caches.open(cacheName);
                    return (await cache.match(request)) || fetch(request);
                })(),
            );
            return;
        }

        const cacheUrl = getNavigationCacheUrl(request.url, appScopeUrl, navigationAssetUrls);
        if (cacheUrl === undefined) {
            // Let this navigation be handled normally, as if there were no service worker.
            return;
        }
        event.respondWith(
            (async () => {
                try {
                    const response = await fetch(request);
                    if (!response.ok) {
                        if (navigationCacheFallbackStatuses?.includes(response.status)) {
                            try {
                                const cache = await caches.open(cacheName);
                                return (await cache.match(cacheUrl)) || response;
                            } catch {
                                // A cache failure should not replace the network response.
                            }
                        }
                        return response;
                    }
                    if (!doCacheOnNavigation) {
                        return response;
                    }
                    if (response.redirected) {
                        return response;
                    }
                    try {
                        const cache = await caches.open(cacheName);
                        // put response in cache before browser can consume it
                        await cache.put(cacheUrl, response.clone());
                    } catch {
                        // A cache failure should not prevent an otherwise successful navigation.
                    }
                    return response;
                } catch {
                    // If the network cannot be reached, return from the service worker cache.
                    // Only use the cache as a fallback, not cache-first.
                    const cache = await caches.open(cacheName);
                    return (await cache.match(cacheUrl)) || Response.error();
                }
            })(),
        );
    });
}
