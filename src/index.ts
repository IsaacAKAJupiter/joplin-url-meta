import joplin from 'api';
import { ContentScriptType, ModelType, ToolbarButtonLocation } from 'api/types';
import { NOTE_DATA_KEY, registerSettings, getSetting } from './utils/settings';
import { createURLMetaDialog } from './utils/dialog';
import { isMobile } from './utils/mobile';
import { handleMetaTags, panelHTML } from './utils/meta';
import { createURLMetaPanel } from './utils/panel';
import { URLMeta } from './types/data';
import { getURLs } from './utils/regex';
import { deleteMetaImage } from './utils/resource';
import { getURLMetaHTML } from './utils/meta';
import { escapeHtml } from './utils/html';
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
        const dialog = await createURLMetaDialog();

        // On content script message.
        await joplin.contentScripts.onMessage(
            'url_meta_mdit',
            async ({ type, data }) => {
                const note = await joplin.workspace.selectedNote();
                if (!note) {
                    return type === 'inlineURLs'
                        ? { urls: [], displayMethod: 'default' }
                        : undefined;
                }

                // Get the data for the note.
                const noteData = await joplin.data.userDataGet<
                    URLMeta[] | undefined
                >(ModelType.Note, note.id, NOTE_DATA_KEY);

                // Handle URLs here to open a dialog for information about it.
                if (type === 'url') {
                    if (!noteData) return;

                    const url = noteData.find((d) => d.url === data);
                    if (!url) return;

                    // Get the setting for click behaviour.
                    const clickBehaviour = await getSetting<string>(
                        'inlineMarkdownItClickBehaviour',
                    );

                    const handleClickBehaviour = async (behaviour: string) => {
                        // If nothing.
                        if (behaviour === 'nothing') return;

                        // If copy.
                        if (behaviour === 'copy') {
                            await joplin.clipboard.writeText(url.url);
                            return;
                        }

                        // If open.
                        if (behaviour === 'open') {
                            await joplin.commands.execute('openItem', url.url);
                            return;
                        }

                        // If dialog.
                        if (behaviour === 'dialog') {
                            // Open dialog.
                            await joplin.views.dialogs.setHtml(
                                dialog,
                                `
                                    <div class="url-meta-dialog-container">							
                                        ${await getURLMetaHTML(url, 'dialog')}
                                    </div>
                                `,
                            );
                            const result = await joplin.views.dialogs.open(
                                dialog,
                            );
                            await handleClickBehaviour(result.id);
                        }
                    };

                    await handleClickBehaviour(clickBehaviour ?? 'dialog');
                }

                // Handle inlineURLs.
                if (type === 'inlineURLs') {
                    // Get the setting for display method.
                    const displayMethod = await getSetting<string>(
                        'inlineMarkdownItDisplayMethod',
                    );

                    // If not allowed to display inline.
                    if (!(await getSetting<boolean>('inlineMarkdownIt'))) {
                        return { urls: [], displayMethod };
                    }

                    // If no data.
                    if (!noteData) return { urls: [], displayMethod };

                    // Get the setting for hiding empty meta URLs.
                    const hideEmptyMetaURLs =
                        (await getSetting<boolean>('hideEmptyMetaURLs')) ??
                        false;

                    let transformedURLs = await Promise.all(
                        noteData.map(async (d) => ({
                            ...d,
                            html: `<div class="url-meta-markdown-container" data-url="${escapeHtml(
                                d.url,
                            )}">${await getURLMetaHTML(d, 'markdown')}</div>`,
                        })),
                    );
                    if (hideEmptyMetaURLs) {
                        transformedURLs = transformedURLs.filter(
                            (u) => !!u.description || !!u.title || !!u.image,
                        );
                    }

                    // Return the data with HTML.
                    return {
                        urls: transformedURLs,
                        displayMethod,
                    };
                }

                // If open.
                if (type === 'openURL') {
                    const withoutEndingSlash =
                        data[data.length - 1] === '/' && data.slice(0, -1);

                    const url = noteData.find(
                        (d) =>
                            d.url === data ||
                            (withoutEndingSlash &&
                                d.url === withoutEndingSlash),
                    );
                    if (!url) return;

                    await joplin.commands.execute('openItem', url.url);
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
                      ({ url }) =>
                          data.findIndex((d) => d && d.url === url) === -1,
                  );

            // Filter out old URLs.
            let dataUrls: (URLMeta & { index: number })[] = [];
            if (data) {
                for (const d of data) {
                    if (!d) continue;

                    // If still exists, push and continue.
                    const existing = urls.find(({ url }) => d.url === url);
                    if (existing) {
                        dataUrls.push({ ...d, index: existing.index });
                        continue;
                    }

                    await deleteMetaImage(d);
                }
            }
            dataUrls = dataUrls.sort((a, b) => a.index - b.index);

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
                        dataUrls.map((d) => ({ ...d, index: undefined })),
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
            const fetched: (URLMeta & { index: number })[] = [];
            for (let i = 0; i < newUrls.length; i++) {
                let newUrl = newUrls[i];
                if (newUrl.url.endsWith('~')) {
                    newUrl.url = newUrl.url.replace(/~*$/, '');
                }

                // Set HTML.
                await joplin.views.panels.setHtml(
                    panel,
                    `Fetching: ${newUrl.url} (${i + 1}/${newUrls.length})`,
                );

                // Fetch.
                const result = await handleMetaTags(
                    libraries,
                    newUrl.url,
                    panel,
                );
                if (result) fetched.push({ ...result, index: newUrl.index });
            }

            // If all failed, ignore.
            if (fetched.length === 0) return;

            // Set data with old URLs and new URLs (make sure to sort and remove index).
            const newData = [...dataUrls, ...fetched]
                .sort((a, b) => a.index - b.index)
                .map((v) => ({ ...v, index: undefined }));
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
