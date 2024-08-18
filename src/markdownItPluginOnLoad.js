// From https://stackoverflow.com/a/6234804/561309
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

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

    return el;
}

function getElementToDisplayAfter(el, displayMethod) {
    // If display method is ultra compact, it is immediate.
    if (displayMethod == 'ultraCompact') return el;

    // If default, get the closest non text element.
    if (displayMethod == 'default') return getClosestNonTextElement(el);

    // If compact, we need to get the next br element or end of tag entirely.
    let newEl = el;
    while ((newEl = newEl.nextSibling)) {
        if (newEl.nodeName == 'BR') break;
    }

    // If br node, return it.
    if (newEl) return newEl;

    // If no other nodes, we can just display it after the last child node.
    return el.parentElement.lastElementChild;
}

async function handleURLMetaAnchors() {
    const anchors = Array.from(document.querySelectorAll('a'));
    if (anchors.length < 1) return;

    const urls = anchors.reduce((prev, curr) => {
        if (!curr.href) return prev;

        prev.push({ url: curr.href, element: curr });
        return prev;
    }, []);
    if (urls.length < 1) return;

    // Get the data for the URLs.
    const { urls: inlineURLs, displayMethod } = await webviewApi.postMessage(
        'url_meta_mdit',
        {
            type: 'inlineURLs',
            data: null,
        },
    );

    const metaData = [];
    const brToRemove = [];
    for (let i = 0; i < urls.length; i++) {
        const { url, element } = urls[i];
        const el = getElementToDisplayAfter(element, displayMethod);

        // Get the URL without ending slash if required.
        const withoutEndingSlash =
            url[url.length - 1] === '/' && url.slice(0, -1);

        // If the element already has a div with the required class and URL, ignore it.
        const urlEscaped = escapeHtml(url);
        const urlWOESEscaped =
            withoutEndingSlash && escapeHtml(withoutEndingSlash);
        const elContainer =
            el.nodeName === 'DIV' &&
            el.classList.contains('url-meta-markdown-container')
                ? el
                : el.nodeName == 'BR' &&
                  el.previousElementSibling &&
                  el.previousElementSibling.classList.contains(
                      'url-meta-markdown-container',
                  )
                ? el.previousElementSibling
                : null;
        if (
            elContainer &&
            (elContainer.dataset.url === urlEscaped ||
                (urlWOESEscaped && elContainer.dataset.url === urlWOESEscaped))
        ) {
            continue;
        }

        // Get the metadata from response.
        const meta = inlineURLs.find(
            (d) =>
                d.url === url ||
                (withoutEndingSlash && d.url === withoutEndingSlash),
        );
        if (!meta) continue;

        try {
            // Build HTML.
            let html = meta.html;

            // If compact, remove margin-bottom.
            if (displayMethod == 'compact' || displayMethod == 'ultraCompact') {
                html = html.replace(
                    'url-meta-container',
                    'url-meta-container url-meta-container-compact',
                );

                // If previous element is another container, add margin-top.
                if (elContainer) {
                    html = html.replace(
                        'url-meta-container',
                        'url-meta-container url-meta-container-compact-mt',
                    );
                }
            }

            // If BR and compact/ultraCompact, add to remove list.
            if (
                el.nodeName == 'BR' &&
                (displayMethod == 'compact' || displayMethod == 'ultraCompact')
            ) {
                brToRemove.push(el);
            }

            // If ultraCompact, check if next is BR and add it.
            if (
                displayMethod == 'ultraCompact' &&
                el.nextSibling &&
                el.nextSibling.nodeName == 'BR'
            ) {
                brToRemove.push(el.nextSibling);
            }

            el.insertAdjacentHTML(
                el.nodeName == 'BR' ? 'beforebegin' : 'afterend',
                html,
            );
        } catch (e) {
            console.error(e);
        }
    }

    // Remove the BR elements.
    for (const b of brToRemove) b.remove();
}

handleURLMetaAnchors();

document.addEventListener('joplin-noteDidUpdate', () => {
    handleURLMetaAnchors();
});
