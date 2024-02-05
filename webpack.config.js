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
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: true, // Skip type checking for speed
                    },
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
        hot: true,
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
    },
    cache: {
        type: 'filesystem',
        cacheDirectory: path.resolve(__dirname, '.webpack_cache')
    }
};


