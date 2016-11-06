// load the settings
const settings = require('../mosaic.js');

const inputImage = document.getElementById('inputImage');
const tileProcessor = document.getElementById('tileProcessor');

function generateTiles(dataUrl) {
    const image = new Image();
    image.src = dataUrl;

    // set the canvases to the same size as the input image
    tileProcessor.height = inputImage.height = image.height;
    tileProcessor.width = inputImage.width = image.width;

    const inputImageCtx = inputImage.getContext('2d');
    inputImageCtx.drawImage(image, 0, 0);
}

module.exports = generateTiles;
