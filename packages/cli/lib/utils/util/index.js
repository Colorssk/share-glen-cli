'use strict';
const fs = require('fs');
function isObject(o) {
  return Object.prototype.toString.call(o) === '[object Object]';
}
//
function spinnerStart(msg, spinnerString = '|/-\\') {
  const Spinner = require('cli-spinner').Spinner;
  const spinner = new Spinner(msg + ' %s');
  spinner.setSpinnerString(spinnerString);
  spinner.start();
  return spinner;
}

function sleep(timeout = 1000) {
  return new Promise(resolve => setTimeout(resolve, timeout));
}

function exec(command, args, options) {
  const win32 = process.platform === 'win32';

  const cmd = win32 ? 'cmd' : command;
  const cmdArgs = win32 ? ['/c'].concat(command, args) : args;

  return require('child_process').spawn(cmd, cmdArgs, options || {});
}

function execAsync(command, args, options) {
  return new Promise((resolve, reject) => {
    const p = exec(command, args, options);
    p.on('error', e => {
      reject(e);
    });
    p.on('exit', c => {
      resolve(c);
    });
  });
}

// 查看目录下面是否有文件， 文件夹不算
function checkFilesRecursive(totalPath) {
  let res = { files: [], subDirs: []}
  function getFileOrDirPath(path) {
    const files = fs.readdirSync(path);
    for (const file of files) {
      const filePath = `${path}/${file}`;
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        res.files.push(filePath)
      } else if (stats.isDirectory()) {
        res.subDirs.push(filePath)
        getFileOrDirPath(filePath);
      }
    }
  }
  getFileOrDirPath(totalPath)
  return res
}

function abbPath(flatArr = [], str = ''){
  return (Array.isArray(flatArr) &&  flatArr.length>0 && String(str).trim().length > 0) ? flatArr.map(el=>{
    el = el.replace(str, '');
    return el;
  }) : []
}

module.exports = {
  isObject,
  spinnerStart,
  sleep,
  exec,
  execAsync,
  checkFilesRecursive,
  abbPath
};
