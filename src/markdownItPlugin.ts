export default function (context) {
    return {
        plugin: function (markdownIt, _options) {
            const contentScriptId = context.contentScriptId;

            const defaultRender =
                markdownIt.renderer.rules.link_open ||
                function (tokens, idx, options, env, self) {
                    return self.renderToken(tokens, idx, options, env, self);
                };

            markdownIt.renderer.rules.link_open = function (
                tokens,
                idx,
                options,
                env,
                self,
            ) {
                const title = tokens[idx].attrGet('title');
                const href = tokens[idx].attrGet('href');

                // If href is not a URL use default renderer.
                if (
                    !href ||
                    !/((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[-\.\!\/\\\w]*))?)/.test(
                        href,
                    )
                ) {
                    return defaultRender(tokens, idx, options, env, self);
                }

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
