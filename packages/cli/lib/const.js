const DEFAULT_CLI_HOME = '.glen-tool';
const PLATFORM_UNPKG = 'unpkg';
const PLATFORM_FILE_STORE = 'fileStoreService';
const formatPath = require('./utils/format-path');
const path = require('path');
const platformMaps = {
  [PLATFORM_UNPKG]: {
    mirrorUri: 'http://xxx.xxx.xxx.xx:4873/', // 替换 unpkg
    label: 'private unpkg',
    scriptLocation: formatPath(path.resolve(__dirname,'./localScript/upload/unpkgUpload.js')),
  },
  [PLATFORM_FILE_STORE]: {
    serviceUri: 'http://xxx.xxx.xxx.xx:18183/',  // 替换 文件服务
    label: 'customized file services',
    scriptLocation: formatPath(path.resolve(__dirname,'./localScript/upload/httpServiceUpload.js')),
  }
}
module.exports = {
  DEFAULT_CLI_HOME,
  platformMaps,
  PLATFORM_UNPKG,
  PLATFORM_FILE_STORE
};