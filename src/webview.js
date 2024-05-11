function copy(url) {
    webviewApi.postMessage({
        type: 'copy',
        data: url,
    });
}

function openURL(url) {
    webviewApi.postMessage({
        type: 'open',
        data: url,
    });
}

function refetchMeta() {
    webviewApi.postMessage({
        type: 'refetch',
        data: null,
    });
}
