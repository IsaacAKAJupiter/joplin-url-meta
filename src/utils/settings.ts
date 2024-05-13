import joplin from 'api';
import { SettingItemType } from 'api/types';

export const LOGGING_HEADER = 'URL_META';
export const SETTINGS_SECTION = 'urlMetaSettings';
export const NOTE_DATA_KEY = 'urlMetaPluginData';

export async function registerSettings() {
    // Section.
    await joplin.settings.registerSection(SETTINGS_SECTION, {
        label: 'URL Meta',
        iconName: 'fas fa-bars',
    });

    // Register.
    await joplin.settings.registerSettings({
        inlineMarkdownIt: {
            type: SettingItemType.Bool,
            value: true,
            section: SETTINGS_SECTION,
            public: true,
            label: 'Show Metadata In Markdown',
            description:
                'Enable to show the metadata information for each URL within the rendered markdown.',
        },
        maxDimension: {
            type: SettingItemType.Int,
            value: 500,
            section: SETTINGS_SECTION,
            public: true,
            label: 'Max Downloaded Image Dimension',
            description:
                'The metadata image downloaded will resize each dimension (with respect to aspect ratio) to be a maximum of this value. E.g: if set to 500, a 1920x1080 image would turn into 500x281.',
        },
    });
}
