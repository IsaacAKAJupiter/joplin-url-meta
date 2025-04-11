export const multiUrlRegex =
    /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[-\.\!\/\\\w]*))?)/g;

export function getURLs(str: string) {
    const urls: string[] = [];
    let arr: RegExpExecArray;
    while ((arr = multiUrlRegex.exec(str)) !== null) {
        if (!arr[0]) break;

        const url = arr[0].endsWith('~') ? arr[0].replace(/~*$/g, '') : arr[0];

        if (!urls.includes(url)) {
            urls.push(url);
        }
    }

    return urls.map((url, i) => ({ url, index: i }));
}
