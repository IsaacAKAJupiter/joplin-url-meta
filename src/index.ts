import joplin from 'api';
import { ContentScriptType, ModelType, ToolbarButtonLocation } from 'api/types';
// import axios from 'axios';
// import * as cheerio from 'cheerio';
// import * as FileType from 'file-type';

const MAX_IMAGE_SIZE = 500;
const LOGGING_HEADER = 'URL_META';

let axios: any;
let cheerio: any;
let FileType: any;
let os: any;
let path: any;
let fs: any;
let crypto: any;
let librariesLoaded: boolean = false;

const fetchingMetaURLs: string[] = [];
const imagesConverting: {
    [key: string]: (value: string | null) => void | Promise<void>;
} = {};

joplin.plugins.register({
    onStart: async function () {
        await loadMetaLibraries();

        await joplin.settings.registerSection('outline.settings', {
            label: 'URL Meta',
            iconName: 'fas fa-bars',
        });

        // Create the panel object
        const panel = await joplin.views.panels.create('url_meta_panel');

        // Add scripts.
        await joplin.views.panels.addScript(panel, './webview.js');
        await joplin.views.panels.addScript(panel, './webview.css');

        // Set some initial content while the TOC is being created
        await joplin.views.panels.setHtml(panel, 'Loading...');

        // On message.
        await joplin.views.panels.onMessage(panel, async ({ type, data }) => {
            // If copy.
            if (type === 'copy') {
                await joplin.clipboard.writeText(data);
                return;
            }

            // If open.
            if (type === 'open') {
                await joplin.commands.execute('openItem', data);
                return;
            }

            // If refetch.
            if (type.startsWith('refetch')) {
                const note = await joplin.workspace.selectedNote();
                if (!note) return;

                // Get the data for the note.
                const userData = await joplin.data.userDataGet<
                    | {
                          url: string;
                          title: string;
                          description: string;
                          image: string;
                      }[]
                    | undefined
                >(ModelType.Note, note.id, 'urlMetaPluginData');

                const deleteImageResource = async (d) => {
                    // If URL or none in general, ignore.
                    if (!d.image || /^https?:\/\//.test(d.image)) return;

                    console.log(
                        `${LOGGING_HEADER}: Deleting resource "${d.image}" for URL "${d.url}".`,
                    );
                    try {
                        await joplin.data.delete(['resources', d.image]);
                    } catch (_) {}
                };

                // If single.
                if (type === 'refetchSingle') {
                    const idx = userData.findIndex((d) => d.url === data);
                    if (idx === -1) return;

                    // Splice this data.
                    const urlData = userData[idx];
                    userData.splice(idx, 1);

                    // Delete and update view.
                    await deleteImageResource(urlData);
                    await joplin.data.userDataSet(
                        ModelType.Note,
                        note.id,
                        'urlMetaPluginData',
                        userData,
                    );
                    return;
                }

                // If we have data, remove all attached resources.
                if (data) {
                    for (const d of data) {
                        await deleteImageResource(d);
                    }
                }

                // Delete the data and re-update the view.
                await joplin.data.userDataDelete(
                    ModelType.Note,
                    note.id,
                    'urlMetaPluginData',
                );
            }

            // If imageConvertDone.
            if (type === 'imageConvertDone') {
                if (!(data.uid in imagesConverting)) return;

                // Call and delete.
                await Promise.resolve(imagesConverting[data.uid](data.value));
                delete imagesConverting[data.uid];
            }
        });

        // Register MarkdownIt plugin.
        await joplin.contentScripts.register(
            ContentScriptType.MarkdownItPlugin,
            'url_meta_mdit',
            './markdownItPlugin.js',
        );

        // MarkdownIt Dialog.
        const dialog = await joplin.views.dialogs.create('urlMetaDialog');
        await joplin.views.dialogs.setFitToContent(dialog, false);
        await joplin.views.dialogs.addScript(dialog, './webview.css');
        await joplin.views.dialogs.setButtons(dialog, [
            { id: 'copy', title: 'Copy' },
            ...(!(await isMobile())
                ? [
                      {
                          id: 'open',
                          title: 'Open',
                      },
                  ]
                : []),
            { id: 'cancel', title: 'Cancel' },
        ]);

        await joplin.contentScripts.onMessage(
            'url_meta_mdit',
            async ({ type, data }) => {
                const note = await joplin.workspace.selectedNote();
                if (!note) return;

                // Handle URLs here to open a dialog for information about it.
                if (type === 'url') {
                    // Get the data for the note.
                    const noteData = await joplin.data.userDataGet<
                        | {
                              url: string;
                              title: string;
                              description: string;
                              image: string;
                          }[]
                        | undefined
                    >(ModelType.Note, note.id, 'urlMetaPluginData');
                    if (!noteData) return;

                    const url = noteData.find((d) => d.url === data);
                    if (!url) return;

                    // Open dialog.
                    await joplin.views.dialogs.setHtml(
                        dialog,
                        `
                            <div class="url-meta-dialog-container">							
                                ${await getURLMetaHTML(url, true)}
                            </div>
                        `,
                    );
                    const result = await joplin.views.dialogs.open(dialog);

                    // If copy.
                    if (result.id === 'copy') {
                        await joplin.clipboard.writeText(url.url);
                        return;
                    }

                    // If open.
                    if (result.id === 'open') {
                        await joplin.commands.execute('openItem', url.url);
                        return;
                    }
                }
            },
        );

        async function updateView() {
            const mobile = await isMobile();
            const note = await joplin.workspace.selectedNote();

            // If no note.
            if (!note) {
                await joplin.views.panels.setHtml(
                    panel,
                    'Please select a note to view URL metadata.',
                );
                return;
            }

            await joplin.views.panels.setHtml(panel, 'Loading...');

            // Get existing data.
            const data = await joplin.data.userDataGet<
                | {
                      url: string;
                      title: string;
                      description: string;
                      image: string;
                  }[]
                | undefined
            >(ModelType.Note, note.id, 'urlMetaPluginData');

            // If mobile, try and get the data.
            if (mobile) {
                if (!data) {
                    await joplin.views.panels.setHtml(
                        panel,
                        'Either no URLs in note or not loaded. Note, URLs must be loaded with the desktop application due to CORS issues.',
                    );
                    return;
                }

                // Set HTML for data.
                await joplin.views.panels.setHtml(panel, await panelHTML(data));
                return;
            }

            // Get the new URLs.
            const urls = noteURLs(note.body);
            const newUrls = !data
                ? urls
                : urls.filter(
                      (url) => data.findIndex((d) => d && d.url === url) === -1,
                  );

            // Filter out old URLs.
            const dataUrls = [];
            if (data) {
                for (const d of data) {
                    if (!d) continue;

                    // If still exists, push and continue.
                    const stillExists = urls.includes(d.url);
                    if (stillExists) {
                        dataUrls.push(d);
                        continue;
                    }

                    // Else, if resource, remove it.
                    if (d.image && !/^https?:\/\//.test(d.image)) {
                        console.log(
                            `${LOGGING_HEADER}: Deleting resource "${d.image}" for URL "${d.url}".`,
                        );
                        try {
                            await joplin.data.delete(['resources', d.image]);
                        } catch (_) {}
                    }
                }
            }

            // If no new URLs, set HTML.
            if (newUrls.length < 1) {
                // Save data if changed.
                if (
                    (!data && dataUrls.length > 0) ||
                    (data && data.length !== dataUrls.length)
                ) {
                    await joplin.data.userDataSet(
                        ModelType.Note,
                        note.id,
                        'urlMetaPluginData',
                        dataUrls,
                    );
                }

                // Set HTML.
                await joplin.views.panels.setHtml(
                    panel,
                    await panelHTML(dataUrls),
                );
                return;
            }

            // Loop through and fetch one at a time to try and fix issues with same domain.
            const fetched: {
                url: string;
                title: any;
                description: any;
                image: any;
            }[] = [];
            for (let i = 0; i < newUrls.length; i++) {
                const newUrl = newUrls[i];

                // Set HTML.
                await joplin.views.panels.setHtml(
                    panel,
                    `Fetching: ${newUrl} (${i + 1}/${newUrls.length})`,
                );

                // Fetch.
                const result = await handleMetaTags(newUrl, panel);
                if (result) fetched.push(result);
            }

            // If all failed, ignore.
            if (fetched.length === 0) return;

            // Set data with old URLs and new URLs.
            const newData = [...dataUrls, ...fetched];
            await joplin.data.userDataSet(
                ModelType.Note,
                note.id,
                'urlMetaPluginData',
                newData,
            );

            // Set HTML.
            await joplin.views.panels.setHtml(panel, await panelHTML(newData));
        }

        await joplin.workspace.onNoteSelectionChange(() => {
            updateView();
        });

        await joplin.workspace.onNoteChange((e) => {
            updateView();
        });

        await updateView();

        // Register command/toolbar for viewing.
        await joplin.commands.register({
            name: 'toggleURLMeta',
            label: 'Toggle URL Meta',
            iconName: 'fas fa-link',
            execute: async () => {
                const isVisible = await joplin.views.panels.visible(panel);
                joplin.views.panels.show(panel, !isVisible);
            },
        });
        await joplin.views.toolbarButtons.create(
            'toggleURLMeta',
            'toggleURLMeta',
            ToolbarButtonLocation.EditorToolbar,
        );
    },
});

function noteURLs(noteBody: string) {
    const regex =
        /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/g;
    const urls: string[] = [];
    let arr: RegExpExecArray;
    while ((arr = regex.exec(noteBody)) !== null) {
        if (!arr[0]) break;

        if (!urls.includes(arr[0])) {
            urls.push(arr[0]);
        }
    }

    return urls;
}

// From https://stackoverflow.com/a/6234804/561309
function escapeHtml(unsafe: string) {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function loadMetaLibraries() {
    if ((await isMobile()) || librariesLoaded) return;

    cheerio = await import('cheerio');
    axios = await import('axios');
    FileType = await import('file-type');
    os = await import('os');
    path = await import('path');
    fs = await import('fs');
    crypto = await import('crypto');

    librariesLoaded = true;
}

async function isMobile() {
    try {
        const version = (await joplin.versionInfo?.()) as any;
        return version?.platform === 'mobile';
    } catch {
        return false;
    }
}

async function fetchMetaTags(url: string) {
    if (!axios || !cheerio || (await isMobile())) return;

    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const metaTags: { [key: string]: string } = {};

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

async function handleMetaTags(url: string, panel: string) {
    // If already being handled.
    if (fetchingMetaURLs.includes(url)) return;

    fetchingMetaURLs.push(url);

    const tags = await fetchMetaTags(url);
    const tagGet = (key: string) => {
        // Try og: first, then plain. If neither, default empty string.
        if (`og:${key}` in tags) return tags[`og:${key}`];
        if (key in tags) return tags[key];
        return '';
    };

    // Save the image as a resource.
    let image = tagGet('image');
    if (image !== '') {
        console.log(
            `${LOGGING_HEADER}: Attempting to save image "${image}" as resource for URL "${url}".`,
        );
        const imageHandle = await getImageHandleFromURL(image, panel);
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

async function panelHTML(
    metas: (
        | { url: string; title: string; description: string; image: string }
        | null
        | undefined
    )[],
) {
    // Get the meta HTML joined.
    let joinedMetaHTML = '';
    for (const meta of metas) {
        if (!meta) continue;

        joinedMetaHTML += await getURLMetaHTML(meta);
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

async function getURLMetaHTML(
    meta: {
        url: string;
        title: string;
        description: string;
        image: string;
    },
    dialog: boolean = false,
) {
    const mobile = await isMobile();
    const imageIsLink = !!meta.image && /^https?:\/\//.test(meta.image);

    // If resource ID, fetch the full path.
    let imagePath = '';
    if (meta.image && !imageIsLink) {
        const fullPath = await joplin.data.resourcePath(meta.image);
        imagePath = `file:///${fullPath}?t=${Date.now()}`;
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
                <p class="url-meta-container-title">
                    ${escapeHtml(meta.title || 'No Title Found')}
                </p>
                <p class="url-meta-container-description">
                    ${escapeHtml(meta.description || 'No description found.')}
                </p>
                ${
                    !dialog
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
                !dialog || !mobile
                    ? `<p class="url-meta-container-footer">${meta.url}</p>`
                    : `
                        <p class="url-meta-container-footer">
                            <a href="${meta.url}" target="_blank" rel="noopener noreferrer">${meta.url}</a>
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
async function getImageHandleFromURL(
    url: string,
    panel: string,
): Promise<{ handle: string; ext: string } | null> {
    console.log(`${LOGGING_HEADER}: Getting image from URL: ${url}.`);
    // await joplin.imaging.createFromPath(url)
    //
    try {
        // GET request via axios to image URL.
        const response = await axios({
            method: 'GET',
            url,
            responseType: 'arraybuffer',
        });
        if (response.status !== 200 || !response.data) {
            return null;
        }

        // Get the type.
        const buffer = Buffer.from(response.data);
        const fileType = await FileType.fromBuffer(response.data);
        const uuid = crypto.randomUUID();

        // If not png, convert.
        let converted: Buffer | null = null;
        if (fileType.ext !== 'png') {
            console.log(`${LOGGING_HEADER}: Converting image to PNG.`);

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
                        max: MAX_IMAGE_SIZE,
                    },
                });
            });
            if (!data) return null;

            // Convert b64 to buffer.
            converted = Buffer.from(data.split(',')[1], 'base64');
        }

        // Create a write stream to save the image.
        const fileName = `${uuid}.png`;
        const fullPath = path.join(os.tmpdir(), fileName);
        fs.writeFileSync(fullPath, converted ?? buffer);
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
