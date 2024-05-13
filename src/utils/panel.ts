import joplin from 'api';
import { ModelType } from 'api/types';
import { LOGGING_HEADER, NOTE_DATA_KEY } from './settings';
import { imagesConverting } from './meta';
import { URLMeta } from 'src/types/data';

export async function createURLMetaPanel() {
    // Create the panel object
    const panel = await joplin.views.panels.create('url_meta_panel');

    // Add scripts.
    await joplin.views.panels.addScript(panel, './webview.js');
    await joplin.views.panels.addScript(panel, './webview.css');
    await joplin.views.panels.addScript(panel, './url-meta.css');

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
                URLMeta[] | undefined
            >(ModelType.Note, note.id, NOTE_DATA_KEY);

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
                    NOTE_DATA_KEY,
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
                NOTE_DATA_KEY,
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

    return panel;
}
