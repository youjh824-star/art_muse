const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Metro가 인식하지 못하는 Expo 기본값 제거 (SDK 54 / Metro 버전 불일치 경고 억제)
if (config.watcher && "unstable_workerThreads" in config.watcher) {
  delete config.watcher.unstable_workerThreads;
}

module.exports = config;
