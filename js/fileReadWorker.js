/* globals FileReaderSync */

/**
 * Input Messages:
 * {
 *     file - the javascript File object pointing at the file to load
 * }
 *
 * Output Messages:
 * {
 *     buffer - the ArrayBuffer representation of the input file
 * }
 */
self.addEventListener('message', (e) => {
    const file = e.data.file;
    if (!file) {
        throw new Error('Expected message to contain a "file" property.');
    }

    // read the file from disk
    const reader = new FileReaderSync();

    // convert to dataUrl for easy loading
    const buffer = reader.readAsArrayBuffer(file);

    // send it back to the main thread
    postMessage({
        buffer,
    });
}, false);
