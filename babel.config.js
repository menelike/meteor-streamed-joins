module.exports = {
    presets: [
        ["@babel/preset-env", { modules: "commonjs" }],
        "@babel/preset-typescript",
    ],
    plugins: [
        "@babel/plugin-transform-runtime",
        "@babel/plugin-proposal-class-properties",
    ],
    env: {
        production: {
            presets: ["minify"],
        },
    },
};
