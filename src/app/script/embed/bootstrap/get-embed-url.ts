let embedUrl: string;

function getBaseUrl(url: string): string {
    return ('' + url).replace(/^((?:https?|file|ftp):\/\/.+)\/[^/]+$/, '$1') + '/';
}

export function getEmbedUrl(): string {
    if (embedUrl) {
        return embedUrl;
    }

    const stack = new Error().stack ?? '';
    const matches = stack.match(/(https?|file|ftp):\/\/[^)\n]+/g);
    if (matches === null) {
        throw new Error('Could not determine the embed URL');
    }
    const embedScriptUrl = matches.find((item) => item.includes('embed.js')) ?? matches[0];
    embedUrl = getBaseUrl(embedScriptUrl);
    return embedUrl;
}
