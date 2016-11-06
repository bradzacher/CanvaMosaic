const AsyncAwaitPlugin = require('webpack-async-await');

module.exports = {
    entry: ['./js/client.js'],
    output: {
        filename: 'bundle.js',
        path: './js/build',
    },
    plugins: [
        new AsyncAwaitPlugin({}),
    ],
};
