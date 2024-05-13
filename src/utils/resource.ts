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
