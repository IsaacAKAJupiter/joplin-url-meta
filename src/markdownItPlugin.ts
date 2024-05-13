export default function (context) {
    return {
        plugin: function (markdownIt, _options) {
            const contentScriptId = context.contentScriptId;

            markdownIt.renderer.rules.link_open = function (
                tokens,
                idx,
                options,
                env,
                self,
            ) {
                const title = tokens[idx].attrGet('title');
                const href = tokens[idx].attrGet('href');

                const postMessageWithResponseTest = `
                    webviewApi.postMessage('${contentScriptId}', {'type': 'url', data: '${href}'});
                    return false;
                `;

                return `
                    <a
                        data-from-md
                        ${title ? `title="${title}"` : ''}
                        href="${href}"
                        onclick="${postMessageWithResponseTest.replace(
                            /\n/g,
                            ' ',
                        )}"
                    >
                `;
            };
        },
        assets: function () {
            return [
                { name: 'markdownItPluginOnLoad.js' },
                { name: 'url-meta.css' },
            ];
        },
    };
}
