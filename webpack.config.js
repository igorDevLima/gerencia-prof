const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

/**
 * Build do app (organização package-by-feature).
 * Saída em www/ para ser consumida pelo Cordova (config.xml -> index.html).
 */
module.exports = (env, argv) => {
  const isProd = argv.mode === "production";
  return {
    entry: "./src/index.js",
    output: {
      path: path.resolve(__dirname, "www"),
      filename: "js/app.js",
      clean: true,
      publicPath: "",
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: "babel-loader",
        },
        {
          test: /\.scss$/,
          use: [MiniCssExtractPlugin.loader, "css-loader", "sass-loader"],
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, "css-loader"],
        },
        {
          // A imagem do timbre entra embutida (data URI) para o gerador de .docx.
          test: /\.jpe?g$/,
          type: "asset/inline",
        },
        {
          // Ícones e demais imagens vão para www/img.
          test: /\.(png|svg|gif)$/,
          type: "asset/resource",
          generator: { filename: "img/[name][ext]" },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "./src/index.html",
        filename: "index.html",
        minify: isProd,
      }),
      new MiniCssExtractPlugin({ filename: "css/styles.css" }),
      new CopyWebpackPlugin({
        patterns: [
          { from: "src/assets/manifest.json", to: "manifest.json" },
          { from: "src/assets/img", to: "img" },
          { from: "src/assets/sw.js", to: "sw.js" },
        ],
      }),
    ],
    devtool: isProd ? false : "source-map",
    devServer: {
      static: { directory: path.resolve(__dirname, "www") },
      port: 8080,
      hot: true,
    },
  };
};
