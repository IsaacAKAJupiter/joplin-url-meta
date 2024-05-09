import joplin from 'api';
import { ContentScriptType, ToolbarButtonLocation } from 'api/types';
// import axios from 'axios';
// import * as cheerio from 'cheerio';

joplin.plugins.register({
    onStart: async function () {
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

        async function updateTocView() {
            const note = await joplin.workspace.selectedNote();

            if (note) {
                const headers = noteHeaders(note.body);
                const urls = noteURLs(note.body);
                console.log(urls);
                if (urls.length > 0) {
                    // const result = await fetchMetaTags(urls[0]);
                    // console.log(result);
                }

                // First create the HTML for each header:
                const itemHtml = [];
                for (const header of headers) {
                    // - We indent each header based on header.level.
                    //
                    // - The slug will be needed later on once we implement clicking on a header.
                    //   We assign it to a "data" attribute, which can then be easily retrieved from JavaScript
                    //
                    // - Also make sure you escape the text before inserting it in the HTML to avoid XSS attacks
                    //   and rendering issues. For this use the `escapeHtml()` function you've added earlier.
                    itemHtml.push(`
                        <p class="toc-item" style="padding-left:${
                            (header.level - 1) * 15
                        }px">
                            <a class="toc-item-link" href="#" data-slug="">
                                ${escapeHtml(header.text)}
                            </a>
                        </p>
                    `);
                }

                // Finally, insert all the headers in a container and set the webview HTML:
                await joplin.views.panels.setHtml(
                    panel,
                    `
                    <div class="container">
                        ${itemHtml.join('\n')}
                    </div>
                `
                );
            } else {
                await joplin.views.panels.setHtml(
                    panel,
                    'Please select a note to view the table of content'
                );
            }
        }

        // This event will be triggered when the user selects a different note
        await joplin.workspace.onNoteSelectionChange(() => {
            updateTocView();
        });

        // This event will be triggered when the content of the note changes
        // as you also want to update the TOC in this case.
        await joplin.workspace.onNoteChange(() => {
            updateTocView();
        });

        // Also update the TOC when the plugin starts
        await updateTocView();

        // Register command/toolbar for viewing.
        await joplin.commands.register({
            name: 'toggleLinksMetadata',
            label: 'Toggle Links Metadata',
            iconName: 'fas fa-link',
            execute: async () => {
                const isVisible = await joplin.views.panels.visible(panel);
                joplin.views.panels.show(panel, !isVisible);
            },
        });
        await joplin.views.toolbarButtons.create(
            'toggleLinksMetadata',
            'toggleLinksMetadata',
            ToolbarButtonLocation.EditorToolbar
        );
    },
});

function noteHeaders(noteBody: string) {
    const headers = [];
    const lines = noteBody.split('\n');
    for (const line of lines) {
        const match = line.match(/^(#+)\s(.*)*/);
        if (!match) continue;
        headers.push({
            level: match[1].length,
            text: match[2],
        });
    }
    return headers;
}

function noteURLs(noteBody: string) {
    const regex =
        /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/g;
    const urls: string[] = [];
    let arr: RegExpExecArray;
    while ((arr = regex.exec(noteBody)) !== null) {
        if (!arr[0]) break;

        urls.push(arr[0]);
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

// async function fetchMetaTags(url) {
//     try {
//         const { data } = await axios.get(url);
//         const $ = cheerio.load(data);
//         const metaTags = {};

//         $('meta').each((i, element) => {
//             const name = $(element).attr('name') || $(element).attr('property');
//             if (name) {
//                 metaTags[name] = $(element).attr('content');
//             }
//         });

//         return metaTags;
//     } catch (error) {
//         return { error: error.message };
//     }
// }
