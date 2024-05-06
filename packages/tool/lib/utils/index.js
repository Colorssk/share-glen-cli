'use strict';
const fs = require('fs');
const inquirer = require('./inquirer');
function serialize(){
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
    return args;
}

function spinnerStart(msg, spinnerString = '|/-\\') {
  const Spinner = require('cli-spinner').Spinner;
  const spinner = new Spinner(msg + ' %s');
  spinner.setSpinnerString(spinnerString);
  spinner.start();
  return spinner;
}

function writeFile(path, data, { rewrite = true } = {}) {
  if (fs.existsSync(path)) {
    if (rewrite) {
      fs.writeFileSync(path, data);
      return true;
    } else {
      return false;
    }
  } else {
    fs.writeFileSync(path, data);
    return true;
  }
}

function readFile(path, options = {}) {
  if (fs.existsSync(path)) {
    console.log('path----', path)
    const buffer = fs.readFileSync(path);
    if (buffer) {
      if (options.toJson) {
        return buffer.toJSON();
      } else {
        return buffer.toString();
      }
    }
  } else {
    console.log('no file dir-------------------')
    return null;
  }
}

function terminalLink(key, url) {
  if (!url) {
    return require('terminal-link')(key, key);
  } else {
    return require('terminal-link')(key, url);
  }
}



module.exports = {
    serialize,
    readFile,
    writeFile,
    terminalLink,
    inquirer,
    spinnerStart
}