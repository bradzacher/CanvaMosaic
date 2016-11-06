'use strict';

/* eslint-disable operator-assignment */

/**
 * Input Messages:
 *  {
 *      image: {        // the size of the source image
 *          width, height
 *      },
 *      tiles: [        // the list of tiles to process
 *          {
 *              origin: {   // the top-left corner of the tile
 *                  x, y,
 *              },
 *              id,         // a unique identifier for the tile
 *              sourceTile  // the ImageData object
 *          }
 *      ]
 *  }
 *
 * Output Messages:
 *  {
 *      tiles: [ // list of results
 *          {
 *              average: {
 *                  raw: { // the raw average
 *                      r, g, b
 *                  },
 *                  hex // the average represented as a hex string
 *              },
 *              id // the unique identifier for the tile the average was calculated from
 *          }
 *      ]
 *  }
 */


// converts an integer to a two digit hex number
function toTwoDigitHex(integer) {
    // round and conver to hex
    const hex = Math.round(integer).toString(16);
    // make sure 2 digits
    return `0${hex}`.slice(-2);
}

self.addEventListener('message', (e) => {
    const tiles = e.data.tiles;
    if (!tiles) {
        throw new Error('Expected message to contain a "tiles" property.');
    }
    const image = e.data.image;
    if (!tiles) {
        throw new Error('Expected message to contain a "image" property.');
    }

    const returnTiles = [];

    tiles.forEach((t) => {
        const average = {
            r: 0,
            g: 0,
            b: 0,
        };
        let pixelCount = 0;

        const sourceTile = t.sourceTile;
        const pixels = sourceTile.data;
        const byteWidth = sourceTile.width * 4;

        // If the image is bigger than a multiple of TILE_WIDTH x TILE_HEIGHT
        // then the last tile in the row/column will be heavily weighted toward black
        // because of how the image data object works (it marks the pixels as black!).

        // check if the tile contains out of bound pixels
        // we do this so we can short circuit the if checks inside the loop
        const containsPixelsOutsideWidthBound = t.origin.x + sourceTile.width > image.width;
        const containsPixelsOutsideHeightBound = t.origin.y + sourceTile.height > image.height;

        // sum the colour values for the tile's pixels
        for (let y = 0; y < sourceTile.height; y = y + 1) {
            if (containsPixelsOutsideHeightBound &&
                y + t.origin.y >= image.height) {
                // outside bounds - ignore
                continue;
            }
            for (let x = 0; x < sourceTile.width; x = x + 1) {
                if (containsPixelsOutsideWidthBound &&
                    x + t.origin.x >= image.width) {
                    // outside bounds - ignore
                    continue;
                }

                // calculate the flat index
                const i = (y * byteWidth) + (x * 4);

                average.r = average.r + pixels[i + 0];
                average.g = average.g + pixels[i + 1];
                average.b = average.b + pixels[i + 2];

                pixelCount = pixelCount + 1;
            }
        }

        // calculate the averages
        average.r = average.r / pixelCount;
        average.g = average.g / pixelCount;
        average.b = average.b / pixelCount;

        // convert to hex
        const hexAvg = toTwoDigitHex(average.r) + toTwoDigitHex(average.g) + toTwoDigitHex(average.b);

        // prepare it to be returned
        returnTiles.push({
            average: {
                raw: average,
                hex: hexAvg,
            },
            id: t.id,
        });
    });

    // send the results back
    postMessage({
        tiles: returnTiles,
    });
});
