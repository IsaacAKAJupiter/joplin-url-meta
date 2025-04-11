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

### v1.0.7

- Remove BR elements if using compact/ultraCompact display type when they exist right after the anchor tags. This should make the display closer to how it would render without the plugin (with just an injection for the meta information).

### v1.0.8

- Added new setting "Metadata In Markdown Click Behaviour" (special thanks to [deepspaceaxolotl](https://github.com/IsaacAKAJupiter/joplin-url-meta/issues/4#issue-2591373344) for the idea). This can be one of the following options.
  - Dialog (with option of copy/open)
  - Copy
  - Open
  - Do Nothing
- Added fallback to the webpage title if no title meta tag found.
  - This fixes [this issue](https://github.com/IsaacAKAJupiter/joplin-url-meta/issues/3#issuecomment-2416413276).
- Add new advanced setting for "Debug Copy HTML Content". If enabled, the entire webpage used to parse the meta tags will be copied to the clipboard. This is mainly for use in Github issues.

### v1.0.9

- Added new setting "YouTube Data API v3 Key" to fetch YouTube video (including shorts) and playlist metadata via the API instead of a normal GET request.
  - This fixes [this issue](https://github.com/IsaacAKAJupiter/joplin-url-meta/issues/3)
  - Note, this will most-likely **not** work for private videos/playlists.
  - To get an **API Key**, follow [this](https://developers.google.com/youtube/v3/getting-started) getting started guide by Google.
    - When creating credentials, it may ask you **What data will you be accessing?** For this, choose **Public data**.

### v1.0.10

- Possible fix for mobile metadata images not correctly showing.

### v1.0.11

- Added new setting "Max Description Lines" which enables the ability to truncate/cut off/curtail long descriptions after a certain line count. Special thanks to [deepspaceaxolotl](https://github.com/IsaacAKAJupiter/joplin-url-meta/issues/7#issue-2979378438) for the idea.
- Added new setting "Hide Empty Meta URLs" which enables the ability to not show anything within the markdown if the link has no title, description, and image. Special thanks to [deepspaceaxolotl](https://github.com/IsaacAKAJupiter/joplin-url-meta/issues/8#issue-2979421179) for the idea.
- Within the metadata container, you can now click the title to open the URL immediately.
- The title in the container will fallback to display the domain name.
  - For example, a URL for `https://github.com/IsaacAKAJupiter/joplin-url-meta/issues/3` would display `github.com` if no title was found.
- The description in the container will no longer display `No description found.` and instead will just not display anything.
- Hide specific links in the markdown preview by making sure the link ends with 1 (or more) `~` (tilde) characters.

### v1.0.12

- Added support for wrapping links with `<` and `>` to hide the URL in the markdown preview.
  - Note, the following does not work `[github](<https://github.com>)`, but for something equivalent, `[github](https://github.com~)` should work.
- Fixed an issue related to how the `~` (tilde) hiding worked.
  - If the URL had path (more than just the FQDN), it would not remain clickable.

## Roadmap/Known Issues
