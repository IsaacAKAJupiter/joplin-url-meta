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
        inlineMarkdownItDisplayMethod: {
            type: SettingItemType.String,
            value: 'default',
            section: SETTINGS_SECTION,
            public: true,
            isEnum: true,
            options: {
                default: 'Default',
                compact: 'Compact',
                ultraCompact: 'Ultra Compact',
            },
            label: 'Metadata In Markdown Display Method',
            description:
                'The display method when displaying metadata in the rendered markdown. Default requires empty line between links, compact requires line break (not an extra empty line) between links, ultra compact renders immediately after the link no matter what (not recommended).',
        },
        inlineMarkdownItClickBehaviour: {
            type: SettingItemType.String,
            value: 'dialog',
            section: SETTINGS_SECTION,
            public: true,
            isEnum: true,
            options: {
                dialog: 'Dialog (with option of copy/open)',
                copy: 'Copy',
                open: 'Open',
                nothing: 'Do Nothing',
            },
            label: 'Metadata In Markdown Click Behaviour',
            description:
                'This defines what should happen when a link is clicked in the rendered markdown.',
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
        maxDescriptionLines: {
            type: SettingItemType.Int,
            value: 0,
            section: SETTINGS_SECTION,
            public: true,
            label: 'Max Description Lines',
            description:
                'This will truncate the description to a set maximum line count in the preview panel and in the markdown. Set to 0 or less to always show the full description.',
        },
        youtubeAPIKey: {
            type: SettingItemType.String,
            value: '',
            section: SETTINGS_SECTION,
            advanced: true,
            public: true,
            label: 'YouTube Data API v3 Key',
            description:
                'If set, YouTube playlist / video metadata will be fetched from the YouTube API via the key provided instead of a normal GET request.',
        },
        debugCopyHTML: {
            type: SettingItemType.Bool,
            value: false,
            section: SETTINGS_SECTION,
            advanced: true,
            public: true,
            label: 'Debug Copy HTML Content',
            description:
                'If enabled, it will copy the HTML of the webpage being fetched for meta tags. For use in Github issues.',
        },
    });
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
    try {
        if (typeof joplin.settings.values === 'function') {
            const settings = await joplin.settings.values(key);
            if (settings && settings[key] !== undefined) {
                return settings[key] as T;
            } else {
                return undefined;
            }
        } else {
            try {
                return (await joplin.settings.value(key)) as T | undefined;
            } catch {
                return undefined;
            }
        }
    } catch {
        return undefined;
    }
}
