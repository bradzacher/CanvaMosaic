// load the settings
const settings = require('../mosaic.js');

const inputImage = document.getElementById('inputImage');
const tileResult = document.getElementById('tileResult');
const svgResult  = document.getElementById('result');

// converts an integer to a two digit hex number
function toTwoDigitHex(integer) {
    // round and conver to hex
    const hex = Math.round(integer).toString(16);
    // make sure 2 digits
    return `0${hex}`.slice(-2);
}

function generateTiles(dataUrl) {
    const image = new Image();
    image.src = dataUrl;

    // set the canvases to the same size as the input image
    inputImage.height = image.height;
    inputImage.width = image.width;
    const inputImageCtx = inputImage.getContext('2d');
    inputImageCtx.drawImage(image, 0, 0);

    // appropriately size the intermediate tile canvas so it matches the exact tile sizing
    tileResult.height = Math.floor(image.height / settings.TILE_HEIGHT) * settings.TILE_HEIGHT;
    tileResult.width = Math.floor(image.width / settings.TILE_WIDTH) * settings.TILE_WIDTH;
    const tileResultCtx = tileResult.getContext('2d');

    // appropriately size the result container
    svgResult.style.height = `${Math.ceil(image.height / settings.TILE_HEIGHT) * settings.TILE_HEIGHT}px`;
    svgResult.style.width = `${Math.ceil(image.width / settings.TILE_WIDTH) * settings.TILE_WIDTH}px`;
    svgResult.innerHTML = ''; // clear the container

    const tiles = [];

    // build the tiles from the canvas
    for (let h = 0; h < image.height; h += settings.TILE_HEIGHT) {
        for (let w = 0; w < image.width; w += settings.TILE_WIDTH) {
            const sourceTile = inputImageCtx.getImageData(w, h, settings.TILE_WIDTH, settings.TILE_HEIGHT);
            const destTile = tileResultCtx.getImageData(w, h, settings.TILE_WIDTH, settings.TILE_HEIGHT);
            tiles.push({
                x: w,
                y: h,
                sourceTile,
                destTile,
                destCtx: tileResultCtx,
            });
        }
    }

    // calculate the averages for each tile
    tiles.forEach((t) => {
        const average = {
            r: 0,
            g: 0,
            b: 0,
            // a: 0,
        };
        let pixelCount = 0;

        const destTile = t.destTile;
        const destPixels = destTile.data;

        const sourceTile = t.sourceTile;
        const pixels = sourceTile.data;

        // sum the colour values for the tile's pixels
        for (let i = 0; i < pixels.length; i += 4) {
            // todo - if the image is bigger than a multiple of TILE_WIDTH x TILE_HEIGHT
            //        then the last tile in the row/column will be heavily weighted toward black
            //        because of how the image data object works (it marks the pixels as black!)

            average.r += pixels[i + 0];
            average.g += pixels[i + 1];
            average.b += pixels[i + 2];
            // average.a += pixels[i + 3];

            pixelCount += 1;
        }

        // calculate the averages
        average.r /= pixelCount;
        average.g /= pixelCount;
        average.b /= pixelCount;
        // average.a /= pixelCount;

        // convert to hex
        t.average = toTwoDigitHex(average.r) + toTwoDigitHex(average.g) + toTwoDigitHex(average.b);

        // draw the average colour to the intermediate canvas
        for (let i = 0; i < destPixels.length; i += 4) {
            destPixels[i + 0] = average.r;
            destPixels[i + 1] = average.g;
            destPixels[i + 2] = average.b;
            destPixels[i + 3] = 255;
            // destPixels[i + 3] = average.a;
        }
        t.destCtx.putImageData(destTile, t.x, t.y);
    });

    // use promises to queue the drawing of the SVGs
    // each SVG can't render until the previous one renders
    let currentPromise = Promise.resolve();
    tiles.forEach((t) => {
        const previousPromise = currentPromise;
        currentPromise = new Promise((resolve) => {
            // fetch the tile from the server and add it to the result container
            fetch(`color/${t.average}`)
                .then(response => response.text())
                .then((svgText) => {
                    // convert the svg string to a dom element
                    const intermediateDiv = document.createElement('div');
                    intermediateDiv.innerHTML = svgText;
                    const svg = intermediateDiv.childNodes[0];

                    // don't render this svg until the previous one has rendered
                    previousPromise.then(() => {
                        svgResult.appendChild(svg);
                        resolve();
                    });
                });
        });
    });
}

module.exports = generateTiles;
