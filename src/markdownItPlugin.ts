export default function (context) {
    return {
        plugin: function (markdownIt, _options) {
            const contentScriptId = context.contentScriptId;

            // Remember the old renderer if overridden, or proxy to the default renderer.
            var defaultRender =
                markdownIt.renderer.rules.link_open ||
                function (tokens, idx, options, env, self) {
                    return self.renderToken(tokens, idx, options);
                };

            markdownIt.renderer.rules.link_open = function (
                tokens,
                idx,
                options,
                env,
                self
            ) {
                // Add a new `target` attribute, or replace the value of the existing one.
                const title = tokens[idx].attrGet('title');
                const href = tokens[idx].attrGet('href');

                const postMessageWithResponseTest = `
                    webviewApi.postMessage('${contentScriptId}', {'type': 'url', data: '${href}'});
                    return false;
                `;

                return `
                    <a
                        data-from-md
                        title="${title}"
                        href="${href}"
                        onclick="${postMessageWithResponseTest.replace(
                            /\n/g,
                            ' '
                        )}">
                `;
            };
        },
        assets: function () {
            // return [{ name: 'markdownItPlugin.css' }];
            return [];
        },
    };
}
