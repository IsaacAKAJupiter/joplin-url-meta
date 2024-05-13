import joplin from 'api';

export async function isMobile() {
    try {
        const version = (await joplin.versionInfo?.()) as any;
        return version?.platform === 'mobile';
    } catch {
        return false;
    }
}
