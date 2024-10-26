export async function getYouTubeMetaTags(
    libraries: { [key: string]: any },
    idData: { id: string; type: 'playlist' | 'video' },
    apiKey: string,
) {
    try {
        // Call API.
        const urlSuffix = idData.type == 'playlist' ? 'playlists' : 'videos';
        const { data } = await libraries.axios.get(
            `https://www.googleapis.com/youtube/v3/${urlSuffix}`,
            {
                params: {
                    id: idData.id,
                    key: apiKey,
                    part: 'snippet',
                },
            },
        );

        // If no items.
        const snippet = data?.items?.[0]?.snippet;
        const title = snippet?.title;
        const description = snippet?.description;

        // Get the image.
        const image =
            snippet?.thumbnails?.maxres?.url ??
            snippet?.thumbnails?.standard?.url ??
            snippet?.thumbnails?.high?.url ??
            snippet?.thumbnails?.medium?.url ??
            snippet?.thumbnails?.default?.url;

        // Set the meta and return it.
        const meta: { [key: string]: string } = {};
        if (title) meta.title = title;
        if (image) meta.image = image;
        if (description) {
            // Cut off to 160 with an ellipsis.
            meta.description =
                description.length > 160
                    ? `${description.slice(0, 160)}...`
                    : description;
        }
        return meta;
    } catch (error) {
        return { error: error.message };
    }
}

export function getYouTubeIDFromURL(
    url: string,
): { id: string; type: 'playlist' | 'video' } | null {
    // Test for playlist.
    if (/^https?:\/\/(?:www\.)?youtube\.com\/playlist\?list=.+$/.test(url)) {
        return { id: url.split('?list=')[1], type: 'playlist' };
    }

    // Test for normal video link.
    if (/^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=.+$/.test(url)) {
        return { id: url.split('?v=')[1], type: 'video' };
    }

    // Test for shorts video link.
    if (/^https?:\/\/(?:www\.)?youtube\.com\/shorts\/.+$/.test(url)) {
        return { id: url.split('/shorts/')[1], type: 'video' };
    }

    // Test for shortened video link.
    if (/^https?:\/\/youtu\.be\/.+$/.test(url)) {
        return { id: url.split('youtu.be/')[1], type: 'video' };
    }

    return null;
}
