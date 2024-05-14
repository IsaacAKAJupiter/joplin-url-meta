import joplin from 'api';
import { isMobile } from './mobile';
import { getURLMetaHTML } from './meta';
import { ModelType } from 'api/types';
import { URLMeta } from 'src/types/data';
import { NOTE_DATA_KEY } from './settings';

export async function createURLMetaDialog() {
    // Create dialog.
    const dialog = await joplin.views.dialogs.create('urlMetaDialog');
    await joplin.views.dialogs.setFitToContent(dialog, false);

    // CSS.
    await joplin.views.dialogs.addScript(dialog, './url-meta.css');

    // Buttons.
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
            if (!note) {
                return type === 'inlineURLs' ? [] : undefined;
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

            // Handle inlineURLs.
            if (type === 'inlineURLs') {
                // If not allowed to display inline.
                if (!(await joplin.settings.value('inlineMarkdownIt'))) {
                    return [];
                }

                // If no data.
                if (!noteData) return [];

                // Return the data with HTML.
                return await Promise.all(
                    noteData.map(async (d) => ({
                        ...d,
                        html: `<div class="url-meta-markdown-container">${await getURLMetaHTML(
                            d,
                            true,
                        )}</div>`,
                    })),
                );
            }
        },
    );

    // Return handler.
    return dialog;
}
