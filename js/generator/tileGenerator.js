// load the settings
const settings = require('../mosaic');
const fetchQueue = require('./fetchQueue');

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
    const tileRows = Math.ceil(image.height / settings.TILE_HEIGHT);
    const tileColumns = Math.ceil(image.width / settings.TILE_WIDTH);
    tileResult.height = tileRows * settings.TILE_HEIGHT;
    tileResult.width = tileColumns * settings.TILE_WIDTH;
    const tileResultCtx = tileResult.getContext('2d');

    // appropriately size the result container
    svgResult.style.height = `${tileResult.height}px`;
    svgResult.style.width = `${tileResult.width}px`;
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
        const byteWidth = sourceTile.width * 4;

        // If the image is bigger than a multiple of TILE_WIDTH x TILE_HEIGHT
        // then the last tile in the row/column will be heavily weighted toward black
        // because of how the image data object works (it marks the pixels as black!).

        // check if the tile contains out of bound pixels
        // we do this so we can short circuit the if checks inside the loop
        const containsPixelsOutsideWidthBound = t.x + sourceTile.width > image.width;
        const containsPixelsOutsideHeightBound = t.y + sourceTile.height > image.height;

        // sum the colour values for the tile's pixels
        for (let y = 0; y < sourceTile.height; y += 1) {
            if (containsPixelsOutsideHeightBound &&
                y + t.y >= image.height) {
                // outside bounds - ignore
                continue;
            }
            for (let x = 0; x < sourceTile.width; x += 1) {
                if (containsPixelsOutsideWidthBound &&
                    x + t.x >= image.width) {
                    // outside bounds - ignore
                    continue;
                }

                // calculate the flat index
                const i = (y * byteWidth) + (x * 4);

                average.r += pixels[i + 0];
                average.g += pixels[i + 1];
                average.b += pixels[i + 2];
                // average.a += pixels[i + 3];

                pixelCount += 1;
            }
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
    // each row can't render until the previous one renders

    // tracks the list of promises for the current row
    let rowPromises = [];
    // tracks the current row's div container
    let currentRowDiv = document.createElement('div');
    // tracks the previous column's completion promise (used to prevent columns rendering out of order)
    let columnPromise = Promise.resolve();

    // ties off the last row and sets up its render process
    function finaliseRow() {
        const lastRowDiv = currentRowDiv;
        // set the last row to renderr
        const lastRowRenderPromise = Promise.all(rowPromises).then(() => {
            svgResult.appendChild(lastRowDiv);
        });

        // start the new row with the promise from the last (so the new row can't render until the last one does)
        rowPromises = [lastRowRenderPromise];
        currentRowDiv = document.createElement('div');
    }

    tiles.forEach((t, i) => {
        // are we starting a new row?
        if (i % tileColumns === 0 && i !== 0) {
            finaliseRow();
        }

        // locally reference the div so we keep it in our closure
        const currentRow = currentRowDiv;
        const lastColPromise = columnPromise;

        const fetchPromise = fetchQueue(`color/${t.average}`)
            .then(svg => lastColPromise.then(() => {
                // add the svg to the row - but only after the previous row has finished rendering
                currentRow.innerHTML += svg;
            }));

        rowPromises.push(fetchPromise);
        columnPromise = fetchPromise;
    });
    // finalise the last row of the mosaic
    finaliseRow();
}

module.exports = generateTiles;
