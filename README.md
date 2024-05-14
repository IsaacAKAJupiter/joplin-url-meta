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

## Roadmap

- Nothing as of now!
