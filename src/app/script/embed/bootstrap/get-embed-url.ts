

let embedUrl;

function getBaseURL(url) {
    return ('' + url).replace(/^((?:https?|file|ftp):\/\/.+)\/[^/]+$/, '$1') + '/';
}

export function getEmbedUrl(): string {
    if (embedUrl) {
        return embedUrl;
    }

    let match;
    try {
        throw new Error();
    } catch (e) {
        match = ('' + e.stack).match(/(https?|file|ftp):\/\/[^)\n]+/g);
    }
    embedUrl = getBaseURL(match[match.length - 1]);
    return embedUrl;
}