'use strict';

// Please note that the chrome profiler reported that many functions were not being optimised.
// The error message was "Unsupported let compound assignment".
// Apparently this is a known issue with chrome.
// As per: http://stackoverflow.com/a/36254449/3736051
// There are significant performance improvements for not using compound assignments with let assignments


// load the settings
const settings = require('../mosaic');
const fetchQueue = require('./fetchQueue');

// splits an array into N chunks
// adapted from http://stackoverflow.com/a/10456644/3736051
function chunkArray(arr, n) {
    const chunkSize = Math.ceil(arr.length / n);

    return Array.from(Array(n), (x, i) => arr.slice(i * chunkSize, (i * chunkSize) + chunkSize));
}

class MosaicGenerator {
    /**
     * Constructs a new instance of the mosaic generator
     * @param dataUrl           the dataUrl of the image to generate a mosaic for
     * @param inputImageCanvas  the ID of the canvas to render the input image into
     * @param tileCanvas        the ID of the canvas to render the intermediate tile average image into
     * @param mosaicContainer   the ID of the div container to render the mosaic into
     * @public
     */
    constructor(dataUrl, inputImageCanvas, tileCanvas, mosaicContainer) {
        this.dataUrl = dataUrl;

        // build the image representation
        this.image = new Image();
        this.image.src = dataUrl;

        this.tileRows = Math.ceil(this.image.height / settings.TILE_HEIGHT);
        this.tileColumns = Math.ceil(this.image.width / settings.TILE_WIDTH);

        this.tiles = [];

        this.inputImage = document.getElementById(inputImageCanvas);
        this.inputImageCtx = this.inputImage.getContext('2d');
        this.tileResult = document.getElementById(tileCanvas);
        this.tileResultCtx = this.tileResult.getContext('2d');
        this.svgResult = document.getElementById(mosaicContainer);
    }

    /**
     * Generates the mosaic
     * @public
     */
    async generate() {
        // clear the dom
        this.resetWorkArea();

        // get the tiles
        const tiles = this.getTileData();

        // calculate the averages
        const averages = await this.calculateTileAverages(tiles);

        // fetch the mosaic
        await this.fetchAndRenderMosaic(averages);
    }

    /**
     * Resets and cleans the DOM work area
     * @private
     */
    resetWorkArea() {
        // set the canvases to the same size as the input image
        this.inputImage.height = this.image.height;
        this.inputImage.width = this.image.width;
        this.inputImageCtx.drawImage(this.image, 0, 0);

        // appropriately size the intermediate tile canvas so it matches the exact tile sizing
        this.tileResult.height = this.tileRows * settings.TILE_HEIGHT;
        this.tileResult.width = this.tileColumns * settings.TILE_WIDTH;

        // appropriately size the result container
        this.svgResult.style.height = `${this.tileResult.height}px`;
        this.svgResult.style.width = `${this.tileResult.width}px`;
        this.svgResult.innerHTML = ''; // clear the container
    }

    /**
     * Gets the initial tile data from the input image
     * @returns an array of tiles
     * @private
     */
    getTileData() {
        const tiles = [];

        // build the tiles from the canvas
        for (let h = 0; h < this.image.height; h = h + settings.TILE_HEIGHT) {
            for (let w = 0; w < this.image.width; w = w + settings.TILE_WIDTH) {
                const sourceTile = this.inputImageCtx.getImageData(w, h, settings.TILE_WIDTH, settings.TILE_HEIGHT);
                const destTile = this.tileResultCtx.getImageData(w, h, settings.TILE_WIDTH, settings.TILE_HEIGHT);
                tiles.push({
                    x: w,
                    y: h,
                    sourceTile,
                    destTile,
                    destCtx: this.tileResultCtx,
                    id: tiles.length,
                });
            }
        }

        return tiles;
    }

    /**
     * Asyncronously calculates the averages for all tiles in the iamge
     * @param   tiles     array of tiles to calculate for
     * @returns an array of averages for the tiles
     * @private
     */
    async calculateTileAverages(tiles) {
        const averages = [];

        // keeps track of which workers have finished
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
                    width: this.image.width,
                    height: this.image.height,
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
                        averages[t.id] = t.average.hex;

                        // draw the average colour to the intermediate canvas
                        const average = t.average.raw;
                        const destPixels = tile.destTile.data;
                        for (let i = 0; i < destPixels.length; i = i + 4) {
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

        return Promise.all(workerPromises)
            // just return the list of averages
            .then(() => averages);
    }

    /**
     * Fetch all of the mosaic tiles and render them, row by row, into the DOM
     * @param averages  a list of averages to render
     * @private
     */
    async fetchAndRenderMosaic(averages) {
        // use promises to queue the drawing of the SVGs
        // each row can't render until the previous one renders

        // tracks the list of promises for the current row
        let rowPromises = [];
        // tracks the current row's eventual inner HTML
        let currentRowHtml = {
            innerHTML: '',
        };
        // tracks the previous column's completion promise (used to prevent columns rendering out of order)
        let columnPromise = Promise.resolve();

        // ties off the last row and sets up its render process
        const finaliseRow = () => {
            const lastRow = currentRowHtml;
            // set the last row to renderr
            const lastRowRenderPromise = Promise.all(rowPromises).then(() => {
                const div = document.createElement('div');
                div.innerHTML = lastRow.innerHTML;
                this.svgResult.appendChild(div);
            });

            // start the new row with the promise from the last (so the new row can't render until the last one does)
            rowPromises = [lastRowRenderPromise];
            currentRowHtml = {
                innerHTML: '',
            };
        };

        averages.forEach((avg, i) => {
            // are we starting a new row?
            if (i % this.tileColumns === 0 && i !== 0) {
                finaliseRow();
            }

            // locally reference the div so we keep it in our closure
            const currentRow = currentRowHtml;
            const lastColPromise = columnPromise;

            const fetchPromise = fetchQueue(`color/${avg}`)
                .then(svg => lastColPromise.then(() => {
                    // add the svg to the row - but only after the previous row has finished rendering
                    currentRow.innerHTML = currentRow.innerHTML + svg;
                }));

            rowPromises.push(fetchPromise);
            columnPromise = fetchPromise;
        });
        // finalise the last row of the mosaic
        finaliseRow();
    }
}

module.exports = MosaicGenerator;
