'use strict';

const path = require('path');
const Package = require('../models/package');
const log = require('../utils/log');
const formatPath = require('../utils/format-path');
const { exec: spawn } = require('../utils/util');

const SETTINGS = {
  init: '@glen-tool/init',
};

async function exec() {
  let targetPath = process.env.CLI_TARGET_PATH;
  const homePath = process.env.CLI_HOME_PATH;
  let pkg;
  log.verbose('targetPath', targetPath);
  log.verbose('homePath', homePath);

  const cmdObj = arguments[arguments.length - 1];
  const cmdName = cmdObj.name();
  const packageName = SETTINGS[cmdName];
  const packageVersion = 'latest';


  let rootFile =  null
  if (!targetPath) {
    // load local script need to  give selections whether use local script
    rootFile = formatPath(path.resolve(__dirname,'../localScript/index.js'))
  } else {
    pkg = new Package({
      targetPath,
      packageName,
      packageVersion,
    });
    // if this get targetPath exec targetPath file
    rootFile = pkg.getRootFilePath();
  }
  
  if (rootFile) {
    try {
      // 在当前进程中调用
      // require(rootFile).call(null, Array.from(arguments));
      // 在node子进程中调用
      const args = Array.from(arguments);
      const cmd = args[args.length - 1];
      const o = Object.create(null);
      Object.keys(cmd).forEach(key => {
        if (cmd.hasOwnProperty(key) &&
          !key.startsWith('_') &&
          key !== 'parent') {
          o[key] = cmd[key];
        }
      });
      args[args.length - 1] = o;
      const code = `require('${rootFile}').call(null, ${JSON.stringify(args)})`;
      const child = spawn('node', ['-e', code], {
        cwd: process.cwd(),
        stdio: 'inherit',
      });
      child.on('error', e => {
        log.error(e.message);
        process.exit(1);
      });
      child.on('exit', e => {
        log.verbose('execution success:' + e);
        process.exit(e);
      });
    } catch (e) {
      log.error(e.message);
    }
  }
}

module.exports = exec;
