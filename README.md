# Pure JavaScript Image Mosaic Generator

## requirements

This requires a browser that supports the following JS features:
- es6 classes
- async/await
- fetch
- promises
- web workers

Note that chrome has async/await support as of v52, though it is locked behind flags.
Open chrome's [flags](chrome://flags/) page, then search for and enable the "Experimental JavaScript" option.

## usage

1. clone the repo.
1. run `npm install .`.
1. run `npm run build`.
1. run `npm start`.

# Notes

### Refactoring of the tile fetching and average calculation steps so that fetching happens as soon as calculation finishes.

I logically split the code into a few sections; file loading, tile selection, average calculation, tile fetching.
Each step is performant, though as I have logically split the average calculation and tile fetching steps, it means the tile fetching does not start until after the averages have been calculated.

Due to the performance of the average calculation - merging the last two steps would at best save around 1-2 seconds (the time it takes for average calculation on a 1920x1920 image).
In my opinion makes it fall under the 80/20 rule (80% of the effort for 20% of the features).

From the original challenge email, it was written that - "you're not trying to re-invent or over-engineer the wheel here... We value simple, fast, pragmatic, and reliable/resilient solutions so that's what they'll really want to see. Don't over-engineer it, keep it simple and ensure you stick to the requirements.".
A quick refactoring for this change would blur the line between steps and over-complicate the code.
A proper refactoring would not, but would take me outside the advised time limit of 8 hours

### Use of ESLint

ESLint (and Airbnb's base ruleset) were added to the package to ensure the code adheres to a consistent, best practice style.

### Use of Webpack

As visible from within `build` script added to the package.json, and from the config file `webpack.config.js`, Webpack has been included and is only used for two reasons:
1) For bundling of all JS files into a single bundle file.
2) Proper management and load order of the dependencies between the JavaScript files.

#### Note that no other libraries or tools were used.
