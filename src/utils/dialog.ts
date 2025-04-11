import joplin from 'api';
import { isMobile } from './mobile';

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

    // Return handler.
    return dialog;
}
