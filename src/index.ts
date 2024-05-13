import joplin from 'api';
import { ContentScriptType, ModelType, ToolbarButtonLocation } from 'api/types';
import { NOTE_DATA_KEY, registerSettings } from './utils/settings';
import { createURLMetaDialog } from './utils/dialog';
import { isMobile } from './utils/mobile';
import { handleMetaTags, panelHTML } from './utils/meta';
import { createURLMetaPanel } from './utils/panel';
import { URLMeta } from './types/data';
import { getURLs } from './utils/regex';
import { deleteMetaImage } from './utils/resource';
// import axios from 'axios';
// import * as cheerio from 'cheerio';
// import * as FileType from 'file-type';

let libraries: { [key: string]: any } = {};
let librariesLoaded: boolean = false;

joplin.plugins.register({
    onStart: async function () {
        await loadMetaLibraries();
        await registerSettings();

        // Panel.
        const panel = await createURLMetaPanel();

        // Register MarkdownIt plugin.
        await joplin.contentScripts.register(
            ContentScriptType.MarkdownItPlugin,
            'url_meta_mdit',
            './markdownItPlugin.js',
        );

        // Dialog.
        await createURLMetaDialog();

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
            const data = await joplin.data.userDataGet<URLMeta[] | undefined>(
                ModelType.Note,
                note.id,
                NOTE_DATA_KEY,
            );

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
            const urls = getURLs(note.body);
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

                    await deleteMetaImage(d);
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
                        NOTE_DATA_KEY,
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
            const fetched: URLMeta[] = [];
            for (let i = 0; i < newUrls.length; i++) {
                const newUrl = newUrls[i];

                // Set HTML.
                await joplin.views.panels.setHtml(
                    panel,
                    `Fetching: ${newUrl} (${i + 1}/${newUrls.length})`,
                );

                // Fetch.
                const result = await handleMetaTags(libraries, newUrl, panel);
                if (result) fetched.push(result);
            }

            // If all failed, ignore.
            if (fetched.length === 0) return;

            // Set data with old URLs and new URLs.
            const newData = [...dataUrls, ...fetched];
            await joplin.data.userDataSet(
                ModelType.Note,
                note.id,
                NOTE_DATA_KEY,
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

async function loadMetaLibraries() {
    if ((await isMobile()) || librariesLoaded) return;

    libraries = {
        cheerio: await import('cheerio'),
        axios: await import('axios'),
        FileType: await import('file-type'),
        os: await import('os'),
        path: await import('path'),
        fs: await import('fs'),
        crypto: await import('crypto'),
    };

    librariesLoaded = true;
}
