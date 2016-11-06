// load the settings
const settings = require('../mosaic.js');

const inputImage = document.getElementById('inputImage');
const tileResult = document.getElementById('tileResult');

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
        const average = t.average = {
            r: 0,
            g: 0,
            b: 0,
            a: 0,
        };
        let pixelCount = 0;

        const destTile = t.destTile;
        const destPixels = destTile.data;

        const sourceTile = t.sourceTile;
        const pixels = sourceTile.data;

        // sum the colour values for the tile's pixels
        for (let i = 0; i < pixels.length; i += 4) {
            average.r += pixels[i + 0];
            average.g += pixels[i + 1];
            average.b += pixels[i + 2];
            average.a += pixels[i + 3];

            pixelCount += 1;
        }

        // calculate the averages
        average.r /= pixelCount;
        average.g /= pixelCount;
        average.b /= pixelCount;
        average.a /= pixelCount;

        // draw the average colour to the intermediate canvas
        for (let i = 0; i < destPixels.length; i += 4) {
            destPixels[i + 0] = average.r;
            destPixels[i + 1] = average.g;
            destPixels[i + 2] = average.b;
            destPixels[i + 3] = average.a;
        }
        t.destCtx.putImageData(destTile, t.x, t.y);
    });
}

module.exports = generateTiles;
