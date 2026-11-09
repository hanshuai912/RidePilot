// Use the Worklets JS implementation in Node, as in its provided Jest resolver.
// Match the actual package directory: pnpm peer hashes also contain the string
// "react-native-worklets" in unrelated packages such as expo-modules-core.
module.exports = (request, options) => {
  const insideWorklets =
    /[/\\]node_modules[/\\]react-native-worklets(?:[/\\]|$)/.test(
      options.basedir,
    );
  const requestsWorklets = /^react-native-worklets(?:\/|$)/.test(request);
  return options.defaultResolver(
    request,
    insideWorklets || requestsWorklets
      ? {
          ...options,
          extensions: options.extensions?.filter(
            (ext) => !ext.includes("native"),
          ),
        }
      : options,
  );
};
