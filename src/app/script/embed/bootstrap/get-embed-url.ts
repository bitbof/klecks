let embedUrl: string;

function getBaseURL(url: string): string {
    return ('' + url).replace(/^((?:https?|file|ftp):\/\/.+)\/[^/]+$/, '$1') + '/';
}

export function getEmbedUrl(): string {
    if (embedUrl) {
        return embedUrl;
    }

    let match: string[];
    try {
        throw new Error();
    } catch (e) {
        if (e instanceof Error) {
            match = ('' + e.stack).match(/(https?|file|ftp):\/\/[^)\n]+/g)!;
        }
    }
    let index = 0;
    match!.forEach((item, i) => {
        if (item.indexOf('embed.js') !== -1) {
            index = i;
        }
    });
    embedUrl = getBaseURL(match![index]);
    return embedUrl;
}
