// load the settings
const settings = require('../mosaic');
const fetchQueue = require('./fetchQueue');

const inputImage = document.getElementById('inputImage');
const tileResult = document.getElementById('tileResult');
const svgResult  = document.getElementById('result');

// splits an array into N chunks
// adapted from http://stackoverflow.com/a/10456644/3736051
function chunkArray(arr, n) {
    const chunkSize = Math.ceil(arr.length / n);

    return Array.from(Array(n), (x, i) => arr.slice(i * chunkSize, (i * chunkSize) + chunkSize));
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
                id: tiles.length,
            });
        }
    }

    const workerPromises = [];
    // split the set of tiles into packages of work for background threads
    const workPackages = chunkArray(tiles, 8);
    // calculate the averages for each tile by sending them to the workers
    workPackages.forEach((tileChunk) => {
        // build the payload to send to the worker
        const tilePayload = [];
        tileChunk.forEach((t) => {
            tilePayload.push({
                origin: {
                    x: t.x,
                    y: t.y,
                },
                id: t.id,
                sourceTile: t.sourceTile,
            });
        });
        const message = {
            image: {
                width: image.width,
                height: image.height,
            },
            tiles: tilePayload,
        };

        // build the worker
        const worker = new Worker('js/generator/tileCalculationWorker.js');

        const prom = new Promise((resolve) => {
            // listen for responses
            worker.addEventListener('message', (msg) => {
                const tileAverages = msg.data.tiles;

                // save the averages back to the original tile objects
                tileAverages.forEach((t) => {
                    const tile = tiles[t.id];
                    tile.average = t.average.hex;

                    // draw the average colour to the intermediate canvas
                    const average = t.average.raw;
                    const destPixels = tile.destTile.data;
                    for (let i = 0; i < destPixels.length; i += 4) {
                        destPixels[i + 0] = average.r;
                        destPixels[i + 1] = average.g;
                        destPixels[i + 2] = average.b;
                        destPixels[i + 3] = 255;
                        // destPixels[i + 3] = average.a;
                    }
                    tile.destCtx.putImageData(tile.destTile, tile.x, tile.y);
                });

                // we don't need the worker any more, so free up the resources
                worker.terminate();

                resolve();
            });

            // send the message
            worker.postMessage(message);
        });
        // save the promise so we can await all of the completions
        workerPromises.push(prom);
    });

    // once all of the tiles have been calculated, we can start fetching them all
    Promise.all(workerPromises).then(() => {
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
    });
}

module.exports = generateTiles;
