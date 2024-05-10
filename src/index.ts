import joplin from 'api';
import { ContentScriptType, ModelType, ToolbarButtonLocation } from 'api/types';
// import axios from 'axios';
// import * as cheerio from 'cheerio';

let axios: any;
let cheerio: any;

let handled: boolean = false;

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
        await joplin.views.panels.onMessage(panel, (message) => {
            // TODO: Possibly copy link to clipboard, or just have the
            // UI have multiple buttons on mobile for copy/open.
            console.log(message);
            // if (message.name === 'scrollToHash') {
            //     // As the name says, the scrollToHash command makes the note scroll
            //     // to the provided hash.
            //     joplin.commands.execute('scrollToHash', message.hash)
            // }
        });

        await joplin.contentScripts.register(
            ContentScriptType.MarkdownItPlugin,
            'url_meta_mdit',
            './markdownItPlugin.js'
        );

        await joplin.contentScripts.onMessage('url_meta_mdit', (message) => {
            // TODO: Handle URLs here to open a dialog for information about it.
            console.log(message);
        });

        async function updateTocView() {
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
            if (await isMobile()) {
                if (!data) return;

                // TODO: Set HTML for data.
                return;
            }

            // Get the URLs in the note.
            // TODO: Get note diff instead of just exists.
            if (!data) {
                const urls = noteURLs(note.body);
                console.log(urls);
                if (urls.length > 0) {
                    const results = await Promise.all(
                        urls.map((u) => handleMetaTags(u))
                    );
                    await joplin.data.userDataSet(
                        ModelType.Note,
                        note.id,
                        'urlMetaPluginData',
                        results
                    );
                    handled = true;
                }
            } else {
                // TODO: Set HTML for data.
                console.log(data);
            }

            // First create the HTML for each header:
            // const headers = noteHeaders(note.body);
            // const itemHtml = [];
            // for (const header of headers) {
            //     // - We indent each header based on header.level.
            //     //
            //     // - The slug will be needed later on once we implement clicking on a header.
            //     //   We assign it to a "data" attribute, which can then be easily retrieved from JavaScript
            //     //
            //     // - Also make sure you escape the text before inserting it in the HTML to avoid XSS attacks
            //     //   and rendering issues. For this use the `escapeHtml()` function you've added earlier.
            //     itemHtml.push(`
            //             <p class="toc-item" style="padding-left:${
            //                 (header.level - 1) * 15
            //             }px">
            //                 <a class="toc-item-link" href="#" data-slug="">
            //                     ${escapeHtml(header.text)}
            //                 </a>
            //             </p>
            //         `);
            // }

            // // Finally, insert all the headers in a container and set the webview HTML:
            // await joplin.views.panels.setHtml(
            //     panel,
            //     `
            //         <div class="container">
            //             ${itemHtml.join('\n')}
            //         </div>
            //     `
            // );
        }

        // This event will be triggered when the user selects a different note
        await joplin.workspace.onNoteSelectionChange(() => {
            console.log('note selection change');
            updateTocView();
        });

        // This event will be triggered when the content of the note changes
        // as you also want to update the TOC in this case.
        await joplin.workspace.onNoteChange((e) => {
            updateTocView();
        });

        // Also update the TOC when the plugin starts
        await updateTocView();

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
    if ((await isMobile()) || cheerio || axios) return;

    cheerio = await import('cheerio');
    axios = await import('axios');
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
    const tags = await fetchMetaTags(url);
    return {
        url,
        title:
            'og:title' in tags
                ? tags['og:title']
                : 'title' in tags
                ? tags['title']
                : '',
        description:
            'og:description' in tags
                ? tags['og:description']
                : 'description' in tags
                ? tags['description']
                : '',
        image:
            'og:image' in tags
                ? tags['og:image']
                : 'image' in tags
                ? tags['image']
                : '',
    };
}
