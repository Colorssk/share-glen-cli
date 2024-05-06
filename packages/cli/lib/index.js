'use strict';

module.exports = core;
const path = require('path');
const semver = require('semver')
const colors = require('colors/safe');
const userHome = require('user-home');
const pathExists = require('path-exists').sync;
const log = require('./utils/log')
const pkg = require('../package.json');
const constant = require('./const');
const commander = require('commander');
const exec = require('./exec');
const uploadExec = require('./uploadExec')

const program = new commander.Command();
async function  core() {
    try {
        await prepare();
        registerCommand();
      } catch (e) {
        log.error(e.message);
        if (program.debug) {
          console.log(e);
        }
      }
}

function registerCommand() {
  program
    .name(Object.keys(pkg.bin)[0])
    .usage('<command> [options]')
    .version(pkg.version)
    .option('-d, --debug', 'whether open debug', false)
    .option('-tp, --targetPath <targetPath>', 'whether specify the local script', '')
    .option('-io, --isOriginal <isOriginal>', 'where use original (npm)mirroring ', false)
    .option('-p, --platform <platform>', 'which platform you want to upload, option only support for command: upload', 'fileStoreService')
    .option('-upUri, --uploadUri <uploadUri>', 'the server uri that you want to connect to upload front-end assers', 'http://xxx.xxx.xxx.xx:18183')
    .option('-dc, --defaultType <defaultType>', 'default component type', 'component') // 快捷初始化选择仓库类型
    .option('-dn, --defaultName <defaultName>', 'default project name', 'basePlatform') // 快捷初始化模块名称
    .option('-ddn, --defaultDownloadTemplateName <defaultDownloadTemplateName>', 'default project  template name, want to download', '@glen-tool/component-model'); // 快捷初始化模块想要下载的模板名称

  // 初始化 搭建项目，选用模板
  program
    .command('init [projectName]')
    .option('-f, --force', 'whether initialize forcibly')
    .action(exec);

  // 资源文件上传 新增文件上传到存储服务(会归类到灰度平台管控， 实际文件存储位置，可选： 私服：unpkg/个人存储服务(http service)：xxx)
  program
  .command('upload')
  .action(uploadExec);

  // 开启debug模式
  program.on('option:debug', function() {
    if (program.debug) {
      process.env.LOG_LEVEL = 'verbose';
    } else {
      process.env.LOG_LEVEL = 'info';
    }
    log.level = process.env.LOG_LEVEL;
  });

  // 指定targetPath
  program.on('option:targetPath', function() {
    process.env.CLI_TARGET_PATH = program.targetPath;
  });

  // 指定上传的平台 仅对 upload 指令有效
  program.on('option:platform', function() {
    process.env.CLI_UPLOAD_PLATFORM = program.platform ?? 'fileStoreService'
  })

  // 指定连接的服务器地址：用于调用上传服务
  program.on('option:uploadUri', function() {
    process.env.CLI_UPLOAD_SERVER = program.uploadUri
  })

  // 下载的镜像源默认淘宝， 支持为true 选择npm
  program.on('option:isOriginal', function() {
    log.info('option:isOriginal:', program.isOriginal);
    process.env.CLI_IS_ORIGINAL = program.isOriginal;
  });

  // 默认的模板类型
  program.on('option:defaultType', function() {
    log.verbose('option:defaultType:', program.defaultType);
    process.env.CLI_DEFAULT_TYPE = program.defaultType;
  });

  // 默认的模板名称
  program.on('option:defaultName', function() {
    log.verbose('option:defaultName:', program.defaultName);
    process.env.CLI_DEFAULT_NAME = program.defaultName;
  });

  
  // 默认的下载的模板类型名称
  program.on('option:defaultDownloadTemplateName', function() {
    log.verbose('option:defaultDownloadTemplateName:', program.defaultDownloadTemplateName);
    process.env.CLI_DEFAULT_TEMPLATENAME = program.defaultDownloadTemplateName;
  });

  // 对未知命令监听
  program.on('command:*', function(obj) {
    const availableCommands = program.commands.map(cmd => cmd.name());
    console.log(colors.red('unavailable command：' + obj[0]));
    if (availableCommands.length > 0) {
      console.log(colors.red('valid commands：' + availableCommands.join(',')));
    }
  });

  program.parse(process.argv);

  if (program.args && program.args.length < 1) {
    program.outputHelp();
  }
}

async function prepare() {
    checkPkgVersion();
    log.success('cli version check success');
    checkRoot();
    log.success('root check success');
    checkUserHome();
    log.success('useHome exist');
    checkEnv();
    log.success('.env set success');
    await checkGlobalUpdate();
    log.success('have check cli version normal')
  }
  function checkPkgVersion() {
    log.info('cli', pkg.version);
  }
  function checkEnv() {
    const dotenv = require('dotenv');
    const dotenvPath = path.resolve(userHome, '.env');
    if (pathExists(dotenvPath)) {
      dotenv.config({
        path: dotenvPath,
      });
    }
    createDefaultConfig();
}
async function checkGlobalUpdate() {
    const currentVersion = pkg.version;
    const npmName = pkg.name;
    const { getNpmSemverVersion } = require('./utils/get-npm-info');
    const lastVersion = await getNpmSemverVersion(currentVersion, npmName);
    if (lastVersion && semver.gt(lastVersion, currentVersion)) {
      log.warn(colors.yellow(`please manual update ${npmName}，current version：${currentVersion}，latest version：${lastVersion}
                  update command： npm install -g ${npmName}`));
    }
}
// cli-releative-config global
function createDefaultConfig() {
    const cliConfig = {
      home: userHome,
    };
    if (process.env.CLI_HOME) {
      cliConfig['cliHome'] = path.join(userHome, process.env.CLI_HOME);
    } else {
      cliConfig['cliHome'] = path.join(userHome, constant.DEFAULT_CLI_HOME);
    }
    process.env.CLI_HOME_PATH = cliConfig.cliHome;
}

function checkRoot() {
    const rootCheck = require('root-check');
    rootCheck();
}

// for sure next step of cache or operations of directory
function checkUserHome() {
    if (!userHome || !pathExists(userHome)) {
      throw new Error(colors.red('current login user-directory is not exist！'));
    }
}
