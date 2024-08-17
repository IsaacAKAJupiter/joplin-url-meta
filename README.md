# Joplin Plugin - URL Meta

This plugin will grab and fetch meta tags (title, description and image) from URLs found in your notes. It also supports clicking on a URL in the markdown-it panel and popping up information in a dialog with options to open/copy. It also supports a panel that will show all found URLs in the note with buttons to open/copy. This plugin can only fetch these tags from the desktop client, but can display details in the mobile version.

## Changelog

### v1.0.1

- Added support for more image extensions via the canvas browser API.
- Now fetching meta tags for 1 URL at a time to prevent missing data for same domain. This also now includes a progress indicator in the panel.
- Refetch single URL now exists on desktop.

### v1.0.2

- Added support for inline URL metadata cards in the markdown viewer.
- Added setting to disable/enable inline markdown cards.
- Added setting for maximum dimension for downloaded metadata image. E.g: if set to 500, a 1920x1080 image would turn into 500x281.

### v1.0.3

- Fix bug where video resources no longer load within the markdown viewer when the plugin is loaded.
- When refetching metadata for a single URL in the panel on desktop, make the new metadata appear in the same place instead of at the bottom.

### v1.0.4

- Fixed issue [#2](https://github.com/IsaacAKAJupiter/joplin-url-meta/issues/2) by displaying URLs in reverse order and only skipping URLs if there is a container already containing that specific URL.

### v1.0.5

- Added new setting "Metadata In Markdown Display Method" (special thanks to [deepspaceaxolotl](https://github.com/IsaacAKAJupiter/joplin-url-meta/issues/2#issuecomment-2285087563) for the idea). This can be one of the following options.
  - Default: Requires empty line between links.
  - Compact: Requires line break (not an extra empty line) between links.
  - Ultra Compact: Renders immediately after the link no matter what.
- Slight fix for the regex for matching URLs (a link with a hash containing a hyphen would break).
  - E.g: <https://example.com/abc#test-123> would not work.
- Links appearing multiple times within a note are now rendered every time, not just the bottommost.
- Missing resource will no longer cause the "URL Meta Tags" panel to indefinitely load.

### v1.0.6

- Compact/Ultra Compact display methods now only apply margin between metadata containers.
- Resource image src URIs now use the `file://` prefix if before v3.1.1 and the `joplin-content://note-viewer/` prefix if v3.1.1 or newer.

## Roadmap/Known Issues
