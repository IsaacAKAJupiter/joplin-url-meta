import joplin from 'api';
import { isMobile } from './mobile';
import { getURLMetaHTML } from './meta';
import { ModelType } from 'api/types';
import { URLMeta } from 'src/types/data';
import { NOTE_DATA_KEY } from './settings';
import { escapeHtml } from './html';

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
                const clickBehaviour = await joplin.settings.value(
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
                                    ${await getURLMetaHTML(url, true)}
                                </div>
                            `,
                        );
                        const result = await joplin.views.dialogs.open(dialog);
                        await handleClickBehaviour(result.id);
                    }
                };

                await handleClickBehaviour(clickBehaviour);
            }

            // Handle inlineURLs.
            if (type === 'inlineURLs') {
                // Get the setting for display method.
                const displayMethod = await joplin.settings.value(
                    'inlineMarkdownItDisplayMethod',
                );

                // If not allowed to display inline.
                if (!(await joplin.settings.value('inlineMarkdownIt'))) {
                    return { urls: [], displayMethod };
                }

                // If no data.
                if (!noteData) return { urls: [], displayMethod };

                // Return the data with HTML.
                return {
                    urls: await Promise.all(
                        noteData.map(async (d) => ({
                            ...d,
                            html: `<div class="url-meta-markdown-container" data-url="${escapeHtml(
                                d.url,
                            )}">${await getURLMetaHTML(d, true)}</div>`,
                        })),
                    ),
                    displayMethod,
                };
            }
        },
    );

    // Return handler.
    return dialog;
}
