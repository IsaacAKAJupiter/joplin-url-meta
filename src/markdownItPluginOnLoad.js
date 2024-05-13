function getClosestNonTextElement(el) {
    // If text element, try next parent.
    const textElements = [
        'p',
        'span',
        'code',
        'pre',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
    ];
    if (textElements.includes(el.parentElement.tagName.toLowerCase())) {
        return getClosestNonTextElement(el.parentElement);
    }

    return { parent: el.parentElement, el };
}

async function handleURLMetaAnchors() {
    const anchors = Array.from(document.querySelectorAll('a'));
    if (anchors.length < 1) return;

    const mappedURLs = anchors.reduce((prev, curr) => {
        if (!curr.href) return prev;

        prev[curr.href] = curr;
        return prev;
    }, {});
    const urls = Object.keys(mappedURLs);
    if (urls.length < 1) return;

    // Get the data for the URLs.
    const response = await webviewApi.postMessage('url_meta_mdit', {
        type: 'inlineURLs',
        data: null,
    });

    const metaData = [];
    for (const url of urls) {
        const { parent, el } = getClosestNonTextElement(mappedURLs[url]);

        // If the element already has a div with the required class, ignore it.
        if (
            el.nextElementSibling &&
            el.nextElementSibling.classList.contains(
                'url-meta-markdown-container',
            )
        ) {
            continue;
        }

        // Get the URL without ending slash if required.
        const withoutEndingSlash =
            url[url.length - 1] === '/' && url.slice(0, -1);

        // Get the metadata from response.
        const meta = response.find(
            (d) =>
                d.url === url ||
                (withoutEndingSlash && d.url === withoutEndingSlash),
        );
        if (!meta) continue;

        // If matching, insert.
        el.insertAdjacentHTML('afterend', meta.html);
    }
}

handleURLMetaAnchors();

document.addEventListener('joplin-noteDidUpdate', () => {
    handleURLMetaAnchors();
});
