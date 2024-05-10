// var observeDOM = (function () {
//     var MutationObserver =
//         window.MutationObserver || window.WebKitMutationObserver;

//     return function (obj, callback) {
//         if (!obj || obj.nodeType !== 1) return;

//         if (MutationObserver) {
//             // define a new observer
//             var mutationObserver = new MutationObserver(callback);

//             // have the observer observe for changes in children
//             mutationObserver.observe(obj, { childList: true, subtree: true });
//             return mutationObserver;
//         }

//         // browser support fallback
//         else if (window.addEventListener) {
//             obj.addEventListener('DOMNodeInserted', callback, false);
//             obj.addEventListener('DOMNodeRemoved', callback, false);
//         }
//     };
// })();

// var myLog = async (val) => {
//     await webviewApi.postMessage(val);
// };

// var myFetch = async (url) => {
//     try {
//         const response = await fetch(child.textContent);
//         // const response = await fetch(
//         //     `https://corsproxy.io/?${encodeURIComponent(child.textContent)}`
//         // );
//         const text = await response.text();
//         myLog(JSON.stringify({ text, status: response.status }, undefined, 4));
//         return { data: text };
//     } catch (e) {
//         myLog(e.toString());
//         return { error: e.message };
//     }
// };

// var handle = () => {
//     console.log('changes!');
//     const div = document.querySelector('[data-urls]');
//     if (!div) return;

//     const children = Array.from(div.children);
//     for (let i = 0; i < children.length; i++) {
//         const child = children[i];
//         myLog(child.textContent);

//         myFetch(child.textContent).then((v) => {
//             const p = document.createElement('p');
//             p.innerText = v.data ? v.data : v.error;
//             div.parentElement.append(p);
//         });

//         break;
//     }
// };

// // Observe a specific DOM element:
// observeDOM(document.documentElement, handle);
// handle();
