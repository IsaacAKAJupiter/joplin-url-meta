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

function refetchSingle(url) {
    webviewApi.postMessage({
        type: 'refetchSingle',
        data: url,
    });
}

function handleImageConvert({ uid, b64, max }) {
    const resize = (img) => {
        // Setup canvas.
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = max;
        canvas.height = max;

        // Get image sizes.
        const w = img.width;
        const h = img.height;

        // Resize/draw.
        const sizer = Math.min(max / w, max / h);
        const newW = Math.round(w * sizer);
        const newH = Math.round(h * sizer);
        canvas.width = newW;
        canvas.height = newH;
        ctx.drawImage(img, 0, 0, w, h, 0, 0, newW, newH);

        // Get the data and send back to webviewApi.
        const data = canvas.toDataURL();
        console.log({ data });
        webviewApi.postMessage({
            type: 'imageConvertDone',
            data: { uid, value: data },
        });
    };

    const img = new Image();
    img.addEventListener('load', () => resize(img), { once: true });
    img.addEventListener(
        'error',
        () => {
            // If error, send null back to webviewApi.
            webviewApi.postMessage({
                type: 'imageConvertDone',
                data: { uid, value: null },
            });
        },
        { once: true },
    );
    img.src = b64;
}

webviewApi.onMessage((event) => {
    if (event.message.type === 'imageConvert') {
        handleImageConvert(event.message.data);
        return;
    }
});
