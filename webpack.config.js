const path = require('path');

module.exports = {
    mode: 'development',
    entry: './src/app.ts',
    devtool: 'inline-source-map',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist')
    },
    devServer: {
        static: [
            {
                directory: path.join(__dirname, 'dist'),
            },
            {
                directory: path.join(__dirname, 'res'),
                publicPath: '/res/',
            }
        ],
        compress: true,
        port: 8080,
    },
};


