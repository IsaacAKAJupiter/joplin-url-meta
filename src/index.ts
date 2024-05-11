import joplin from 'api';
import { ContentScriptType, ModelType, ToolbarButtonLocation } from 'api/types';
// import axios from 'axios';
// import * as cheerio from 'cheerio';
// import * as FileType from 'file-type';

let axios: any;
let cheerio: any;
let FileType: any;
let os: any;
let path: any;
let fs: any;
let crypto: any;
let librariesLoaded: boolean = false;

const fetchingMetaURLs: string[] = [];

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
            console.log({ type, data });

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
        });

        await joplin.contentScripts.register(
            ContentScriptType.MarkdownItPlugin,
            'url_meta_mdit',
            './markdownItPlugin.js'
        );

        await joplin.contentScripts.onMessage(
            'url_meta_mdit',
            ({ type, data }) => {
                // TODO: Handle URLs here to open a dialog for information about it.
                if (type === 'url') {
                    console.log(data);
                }
            }
        );

        async function updateView() {
            const mobile = await isMobile();
            const note = await joplin.workspace.selectedNote();

            // If no note.
            if (!note) {
                await joplin.views.panels.setHtml(
                    panel,
                    'Please select a note to view the table of content'
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
                        'Either no URLs in note or not loaded. Note, URLs must be loaded with the desktop application due to CORS issues.'
                    );
                    return;
                }

                // Set HTML for data.
                await joplin.views.panels.setHtml(panel, await panelHTML(data));
                return;
            }

            // Get the URLs in the note.
            // TODO: Get note diff instead of just exists.
            if (!data) {
                const urls = noteURLs(note.body);
                console.log(urls);
                if (urls.length > 0) {
                    // Get/set results for meta.
                    const results = await Promise.all(
                        urls.map((u) => handleMetaTags(u))
                    );
                    await joplin.data.userDataSet(
                        ModelType.Note,
                        note.id,
                        'urlMetaPluginData',
                        results
                    );

                    // Set HTML.
                    await joplin.views.panels.setHtml(
                        panel,
                        await panelHTML(results)
                    );
                }
            } else {
                // Set HTML for data.
                await joplin.views.panels.setHtml(panel, await panelHTML(data));
            }
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
            ToolbarButtonLocation.EditorToolbar
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

async function handleMetaTags(url: string) {
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
        const imageHandle = await getImageHandleFromURL(image);
        if (imageHandle) {
            const resource = await joplin.imaging.toJpgResource(imageHandle, {
                url: image,
            });

            // Store resource ID.
            image = resource.id;

            // Free the image.
            await joplin.imaging.free(imageHandle);
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
    )[]
) {
    // Get the meta HTML joined.
    let joinedMetaHTML = '';
    for (const meta of metas) {
        if (!meta) continue;

        joinedMetaHTML += await getURLMetaHTML(meta);
    }

    // TODO: Button to re-fetch the URLs.
    /*
		await joplin.data.userDataDelete(
			ModelType.Note,
			note.id,
			'urlMetaPluginData'
		);
		updateView();
	*/

    return `
		<div class="container">
			<div>
				<p>Some Header!</p>
			</div>

			<div class="url-meta-containers">
				${joinedMetaHTML}
			</div>
		</div>
	`;
}

async function getURLMetaHTML(meta: {
    url: string;
    title: string;
    description: string;
    image: string;
}) {
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

    return `
		<div class="url-meta-container">
			${
                meta.image
                    ? `
						<div class="url-meta-container-image">
							<img src="${imageIsLink ? meta.image : imagePath}" />
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
				</div>
			</div>
			<p class="url-meta-container-footer">${meta.url}</p>
		</div>
	`;
}

/**
 * This function will be replaced with the following code when supported (currently only working in pre-release 3.0.6).
 * ```ts
 *    await joplin.imaging.createFromPath(url);
 * ```
 */
async function getImageHandleFromURL(url: string): Promise<string | null> {
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

        // Create a write stream to save the image.
        const fileType = await FileType.fromBuffer(response.data);
        const fileName = `${crypto.randomUUID()}.${fileType.ext}`;
        const fullPath = path.join(os.tmpdir(), fileName);
        fs.writeFileSync(fullPath, Buffer.from(response.data));

        // Return the joplin file handle.
        return await joplin.imaging.createFromPath(fullPath);
    } catch (e) {
        console.log('Error downloading image: ', e.message);
        return null;
    }
}
