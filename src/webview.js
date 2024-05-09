document.addEventListener('click', (event) => {
    const element = event.target;
    // If a TOC header has been clicked:
    if (element.className === 'toc-item-link') {
        // Get the slug and display it:
        webviewApi.postMessage({
            name: 'scrollToHash',
            innerText: event.innerText,
        });
    }
});
