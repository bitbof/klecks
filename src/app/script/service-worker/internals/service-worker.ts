import { installServiceWorker } from './install-service-worker';

installServiceWorker({
    cachePrefix: 'klecks-app-cache-',
    getNavigationCacheUrl: (requestUrl, appScopeUrl, navigationAssetUrls): string | undefined => {
        // Example values:
        // requestUrl: "https://example.com/paint/help"
        // appScopeUrl.href: "https://example.com/paint/"
        // navigationAssetUrls: [
        //     "https://example.com/paint/",
        //     "https://example.com/paint/klecks-index.html",
        //     "https://example.com/paint/help.html",
        // ]
        const url = new URL(requestUrl);
        // e.g. https://foo.com !== https://bar.com
        if (url.origin !== appScopeUrl.origin) {
            return undefined;
        }

        for (const navigationAssetUrl of navigationAssetUrls) {
            const assetUrl = new URL(navigationAssetUrl);
            // e.g. /paint/ === /paint/ or /paint/help.html === /paint/help.html
            if (url.pathname === assetUrl.pathname) {
                return assetUrl.href;
            }

            if (!assetUrl.pathname.endsWith('.html')) {
                continue;
            }

            // it's possible the server removed the .html at the end
            assetUrl.pathname = assetUrl.pathname.slice(0, -'.html'.length);
            // e.g. /index === /index
            if (url.pathname === assetUrl.pathname) {
                return assetUrl.href;
            }
        }
        // The request does not correspond to an HTML asset from the Parcel manifest.
        return undefined;
    },
});
