import joplin from 'api';
import { URLMeta } from 'src/types/data';
import { LOGGING_HEADER } from './settings';

export async function deleteMetaImage(meta: URLMeta) {
    // Else, if resource, remove it.
    if (meta.image && !/^https?:\/\//.test(meta.image)) {
        console.log(
            `${LOGGING_HEADER}: Deleting resource "${meta.image}" for URL "${meta.url}".`,
        );
        try {
            await joplin.data.delete(['resources', meta.image]);
        } catch (_) {}
    }
}

export async function getResourceURL(resource: string) {
    let fullPath: string = '';
    try {
        fullPath = await joplin.data.resourcePath(resource);

        // If version 3.1.1 or newer, return new way of accessing resources, else use file://.
        const prefix = (await isSameOrNewerVersion('3.1.1'))
            ? 'joplin-content://note-viewer/'
            : 'file://';
        return `${prefix}${fullPath}?t=${Date.now()}`;
    } catch (_) {}

    return fullPath;
}

export async function isSameOrNewerVersion(againstVersion: string) {
    const { version: currentVersion } = await joplin.versionInfo();

    // Get the parts of the version.
    const againstParts = againstVersion.split('.');
    const currParts = currentVersion.split('.');

    // Check each part of the parts to see if
    for (var i = 0; i < againstParts.length; i++) {
        // Parse against into an int.
        let againstPart = +againstParts[i];
        if (Number.isNaN(againstPart)) againstPart = 0;

        // Parse curr into a part.
        let currPart = +currParts[i];
        if (Number.isNaN(currPart)) currPart = 0;

        // If against version part is less than the same part in curr version, it is newer.
        if (currPart > againstPart) return true;

        // If against version part is greater than the same part in the curr version, it is older.
        if (currPart < againstPart) return false;
    }

    // If got here, it is the same.
    return true;
}
