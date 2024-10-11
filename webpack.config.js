const path = require('path');

module.exports = {
    mode: 'development',
    entry: './src/app.ts',
    devtool: 'inline-source-map',
    module: {
        rules: [
            {
                test: /\.json$/,
                loader: 'json-loader',
                type: 'javascript/auto',
            },
            {
                test: /\.tsx?$/,
                use: [{
                    loader: 'ts-loader'
                }],
                exclude: /node_modules/,
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        alias: {
            'three': path.resolve('./node_modules/three')
        }
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'docs'),
        publicPath: '/'
    },
    devServer: {
        hot: true, // Enable HMR
        liveReload: true, // Enable live reloading on file changes
        static: [
            {
                directory: path.join(__dirname, 'docs'),
            },
            {
                directory: path.join(__dirname, 'res'),
                publicPath: '/res/',
            }
        ],
        compress: true,
        port: 8080,
        watchFiles: ['src/**/*', 'docs/**/*', 'res/**/*'], // Watch these directories for changes
    },

    cache: false, // Disable caching
};


