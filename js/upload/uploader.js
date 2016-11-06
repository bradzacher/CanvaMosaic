'use strict';

const MosaicGenerator = require('../generator/MosaicGenerator');

// start up the background file reader
const fileReadWorker = new Worker('js/upload/fileReadWorker.js');

// attach listener to the input element so we can grab the file when the user selects it
document.getElementById('uploader').addEventListener('change', function uploadHandler() {
    // grab the file that was selected
    const file = this.files[0];

    // send it to the background loader
    fileReadWorker.postMessage({
        file,
    });

    // clear the input box so the user can select the same file again if needs be
    this.value = '';
});

// add a listner to the worker so we know when it's done uploading
fileReadWorker.addEventListener('message', (msg) => {
    const dataUrl = msg.data.dataUrl;

    // send the buffer to the generator
    const generator = new MosaicGenerator(dataUrl, 'inputImage', 'tileResult', 'result');
    generator.generate();
});

