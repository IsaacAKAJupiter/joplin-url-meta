import joplin from 'api';
import { escapeHtml } from './html';
import { isMobile } from './mobile';
import { getSetting, LOGGING_HEADER } from './settings';
import { URLMeta } from 'src/types/data';
import { getResourceURL } from './resource';
import { getYouTubeIDFromURL, getYouTubeMetaTags } from './youtube';

export const imagesConverting: {
    [key: string]: (value: string | null) => void | Promise<void>;
} = {};
export const fetchingMetaURLs: string[] = [];

export async function fetchMetaTags(
    libraries: { [key: string]: any },
    url: string,
    youtubeAPIKey?: string,
) {
    if (!libraries.axios || !libraries.cheerio || (await isMobile())) return;

    try {
        // Handle via YouTube API if setup.
        const youtubeID = getYouTubeIDFromURL(url);
        if (youtubeAPIKey && youtubeID) {
            return getYouTubeMetaTags(libraries, youtubeID, youtubeAPIKey);
        }

        // Handle normally.
        const { data } = await libraries.axios.get(url);

        // If debugCopyHTML.
        const debugCopyHTML = await getSetting<boolean>('debugCopyHTML');
        if (debugCopyHTML) {
            await joplin.clipboard.writeText(data);
        }

        // Load the HTML and get the meta tags.
        const $ = libraries.cheerio.load(data);
        const metaTags: { [key: string]: string } = {
            '|title|': $('title').text(),
        };

        $('meta').each((i, element) => {
            const name = $(element).attr('name') || $(element).attr('property');
            if (name) {
                metaTags[name] = $(element).attr('content');
            }
        });

        return metaTags;
    } catch (error) {
        return { error: error.message };
    }
}

export async function getURLMetaHTML(
    meta: URLMeta,
    displayMethod: 'markdown' | 'panel' | 'dialog',
) {
    const mobile = await isMobile();
    const imageIsLink = !!meta.image && /^https?:\/\//.test(meta.image);

    let maxDescriptionLines: number = 0;
    if (displayMethod != 'dialog') {
        maxDescriptionLines =
            (await getSetting<number>('maxDescriptionLines')) ?? 0;
    }

    const clampCSS =
        maxDescriptionLines > 0
            ? `overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: ${maxDescriptionLines};`
            : '';

    // If resource ID, fetch the full path.
    let imagePath = '';
    if (meta.image && !imageIsLink) {
        imagePath = await getResourceURL(meta.image);
    }

    let title = meta.title;
    if (!title) {
        title = meta.url.replace(/https?:\/\//, '').split('/')[0];
    }

    // Get the command for onclick.
    const onClickOpen = `openURL(&quot;${meta.url}&quot;)`;
    const onClickCopy = `copy(&quot;${meta.url}&quot;)`;
    const onClickRefetch = `refetchSingle(&quot;${meta.url}&quot;)`;

    return `
        <div class="url-meta-container">
            ${
                meta.image
                    ? `
                        <div class="url-meta-container-image">
                            <img src="${
                                imageIsLink ? meta.image : imagePath
                            }" />
                        </div>
                    `
                    : ''
            }
            <div class="url-meta-container-body">
                ${
                    mobile
                        ? `
                            <p class="url-meta-container-title">
                                <a class="url-meta-container-title-link" target="_blank" rel="noopener noreferrer" href="${
                                    meta.url
                                }">
                                    ${escapeHtml(title)}
                                </a>
                            </p>
                        `
                        : `
                            <p class="url-meta-container-title" onclick="${
                                displayMethod !== 'markdown'
                                    ? onClickOpen
                                    : '{_REPLACE_OPEN_}'
                            }">
                                ${escapeHtml(title)}
                            </p>
                        `
                }
                ${
                    meta.description
                        ? `
                            <p class="url-meta-container-description" style="${clampCSS}">
                                ${escapeHtml(meta.description)}
                            </p>
                        `
                        : ''
                }
                ${
                    displayMethod === 'panel'
                        ? `
                            <div class="url-meta-container-buttons">
                                <button class="url-meta-container-copy" onclick="${onClickCopy}">Copy</button>
                                ${
                                    mobile
                                        ? `
                                            <a class="url-meta-container-open" target="_blank" rel="noopener noreferrer" href="${meta.url}">Open</a>
                                        `
                                        : `
                                            <button class="url-meta-container-open" onclick="${onClickOpen}">Open</button>
                                        `
                                }
                                ${
                                    mobile
                                        ? ''
                                        : `
                                            <button class="url-meta-container-refetch" onclick="${onClickRefetch}">Refetch</button>
                                        `
                                }
                            </div>
                        `
                        : ''
                }
            </div>
            ${
                displayMethod !== 'panel' || !mobile
                    ? `<p class="url-meta-container-footer">${meta.url}</p>`
                    : `
                        <p class="url-meta-container-footer url-meta-container-footer-icon">
                            <a href="${meta.url}" target="_blank" rel="noopener noreferrer">${meta.url}</a>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="icon icon-tabler icons-tabler-outline icon-tabler-external-link"><path stroke="none" d="M0 0h24v24H0z"></path><path d="M12 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6M11 13l9-9M15 4h5v5"></path></svg>
                        </p>
                    `
            }
        </div>
    `;
}

/**
 * This function will be replaced with the following code when supported (currently only working in pre-release 3.0.6).
 * ```ts
 *    await joplin.imaging.createFromPath(url);
 * ```
 */
export async function getImageHandleFromURL(
    libraries: { [key: string]: any },
    url: string,
    panel: string,
): Promise<{ handle: string; ext: string } | null> {
    console.log(`${LOGGING_HEADER}: Getting image from URL: ${url}.`);
    // await joplin.imaging.createFromPath(url)
    //
    try {
        // GET request via axios to image URL.
        const response = await libraries.axios({
            method: 'GET',
            url,
            responseType: 'arraybuffer',
        });
        if (response.status !== 200 || !response.data) {
            return null;
        }

        // Get the type.
        const buffer = Buffer.from(response.data);
        const fileType = await libraries.FileType.fromBuffer(response.data);
        const uuid = crypto.randomUUID();

        // If not png, convert.
        let converted: Buffer | null = null;
        if (fileType.ext !== 'png') {
            const maxDimension = await getSetting<number>('maxDimension');
            console.log(
                `${LOGGING_HEADER}: Converting image to PNG with a max dimension of ${maxDimension}.`,
            );

            const data = await new Promise<string | null>((resolve) => {
                // On converted, resolve with data.
                imagesConverting[uuid] = (value) => {
                    resolve(value);
                };

                // Send message to convert.
                joplin.views.panels.postMessage(panel, {
                    type: 'imageConvert',
                    data: {
                        uid: uuid,
                        b64: `data:${fileType.mime};base64,${buffer.toString(
                            'base64',
                        )}`,
                        max: maxDimension,
                    },
                });
            });
            if (!data) return null;

            // Convert b64 to buffer.
            converted = Buffer.from(data.split(',')[1], 'base64');
        }

        // Create a write stream to save the image.
        const fileName = `${uuid}.png`;
        const fullPath = libraries.path.join(libraries.os.tmpdir(), fileName);
        libraries.fs.writeFileSync(fullPath, converted ?? buffer);
        console.log(`${LOGGING_HEADER}: Wrote to file: ${fullPath}`);

        // Return the joplin file handle.
        return {
            handle: await joplin.imaging.createFromPath(fullPath),
            ext: fileType.ext,
        };
    } catch (e) {
        console.error(
            `${LOGGING_HEADER}: Error downloading image: ${e.message}`,
        );
        return null;
    }
}

export async function handleMetaTags(
    libraries: { [key: string]: any },
    url: string,
    panel: string,
) {
    // If already being handled.
    if (fetchingMetaURLs.includes(url)) return;

    fetchingMetaURLs.push(url);

    const youtubeAPIKey = await getSetting<string>('youtubeAPIKey');
    const tags = await fetchMetaTags(libraries, url, youtubeAPIKey);
    const tagGet = (key: string) => {
        // Try og: first, then plain, then pipes (custom). If neither, default empty string.
        if (`og:${key}` in tags) return tags[`og:${key}`];
        if (key in tags) return tags[key];
        if (`|${key}|` in tags) return tags[`|${key}|`];
        return '';
    };

    // Save the image as a resource.
    let image = tagGet('image');
    if (image !== '') {
        console.log(
            `${LOGGING_HEADER}: Attempting to save image "${image}" as resource for URL "${url}".`,
        );
        const imageHandle = await getImageHandleFromURL(
            libraries,
            image,
            panel,
        );
        if (imageHandle) {
            const resource = await joplin.imaging.toPngResource(
                imageHandle.handle,
                {
                    url: image,
                },
            );
            console.log(
                `${LOGGING_HEADER}: Saved image "${image}" as resource "${resource.id}" for URL "${url}".`,
            );

            // Store resource ID.
            image = resource.id;

            // Free the image.
            await joplin.imaging.free(imageHandle.handle);
        }
    }

    // Remove from array of fetching.
    const idx = fetchingMetaURLs.indexOf(url);
    if (idx > -1) fetchingMetaURLs.splice(idx, 1);

    return {
        url,
        title: tagGet('title'),
        description: tagGet('description'),
        image,
    };
}

export async function panelHTML(metas: (URLMeta | null | undefined)[]) {
    // Get the meta HTML joined.
    let joinedMetaHTML = '';
    for (const meta of metas) {
        if (!meta) continue;

        joinedMetaHTML += await getURLMetaHTML(meta, 'panel');
    }

    return `
        <div class="container">
            <div class="url-meta-top-container">
                <p>URL Meta Tags</p>
                ${
                    (await isMobile())
                        ? ''
                        : `<button onclick="refetchMeta()">Refetch All</button>`
                }
            </div>

            <div class="url-meta-containers">
                ${joinedMetaHTML}
            </div>
        </div>
    `;
}
