'use strict';

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const fse = require('fs-extra');
const glob = require('glob');
const ejs = require('ejs');
const semver = require('semver');
const userHome = require('user-home');
const Command = require('../models/command');
const Package = require('../models/package');
const log = require('../utils/log');
const { spinnerStart, sleep, execAsync } = require('../utils/util');

const getProjectTemplate = require('./getProjectTemplate');

const TYPE_PROJECT = 'project';
const TYPE_COMPONENT = 'component';

const TEMPLATE_TYPE_NORMAL = 'normal';
const TEMPLATE_TYPE_CUSTOM = 'custom';

const WHITE_COMMAND = ['npm', 'cnpm', 'yarn'];

// 有效的type 选择项目
const VALID_TYPE = [ TYPE_PROJECT, TYPE_COMPONENT ];

class InitCommand extends Command {
  init() {
    this.projectName = this._argv[0] || '';
    this.force = !!this._cmd.force;
    log.verbose('projectName', this.projectName);
    log.verbose('force', this.force);
  }

  async exec() {
    try {
      // 1. 准备阶段
      log.verbose('stop---------------')
      const projectInfo = await this.prepare();
      if (projectInfo) {
        // 2. 下载模板
        log.verbose('projectInfo', projectInfo);
        this.projectInfo = projectInfo;
        await this.downloadTemplate();
        // 3. 安装模板
        await this.installTemplate();
      }
    } catch (e) {
      log.error(e.message);
      if (process.env.LOG_LEVEL === 'verbose') {
        console.log(e);
      }
    }
  }

  async installTemplate() {
    log.verbose('templateInfo', this.templateInfo);
    if (this.templateInfo) {
      if (!this.templateInfo.type) {
        this.templateInfo.type = TEMPLATE_TYPE_NORMAL;
      }
      if (this.templateInfo.type === TEMPLATE_TYPE_NORMAL) {
        // 标准安装
        await this.installNormalTemplate();
      } else if (this.templateInfo.type === TEMPLATE_TYPE_CUSTOM) {
        // 自定义安装 有需要会执行脚本
        await this.installNormalTemplate();
        // await this.installCustomTemplate();
      } else {
        throw new Error('unknown project template type！');
      }
    } else {
      throw new Error('preject template info not exist！');
    }
  }

  checkCommand(cmd) {
    if (WHITE_COMMAND.includes(cmd)) {
      return cmd;
    }
    return null;
  }

  async execCommand(command, errMsg) {
    let ret;
    if (command) {
      const cmdArray = command.split(' ');
      const cmd = this.checkCommand(cmdArray[0]);
      if (!cmd) {
        throw new Error('command not exist！comman：' + command);
      }
      const args = cmdArray.slice(1);
      ret = await execAsync(cmd, args, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
    }
    if (ret !== 0) {
      throw new Error(errMsg);
    }
    return ret;
  }

  async ejsRender(options) {
    const dir = process.cwd();
    const projectInfo = this.projectInfo;
    return new Promise((resolve, reject) => {
      glob('**', {
        cwd: dir,
        ignore: options.ignore || '',
        nodir: true,
      }, function(err, files) {
        if (err) {
          reject(err);
        }
        Promise.all(files.map(file => {
          const filePath = path.join(dir, file);
          return new Promise((resolve1, reject1) => {
            ejs.renderFile(filePath, projectInfo, {}, (err, result) => {
              if (err) {
                console.log('issue:',err)
                reject1(err);
              } else {
                fse.writeFileSync(filePath, result);
                resolve1(result);
              }
            });
          });
        })).then(() => {
          resolve();
        }).catch(err => {
          reject(err);
        });
      });
    });
  }

  async installNormalTemplate() {
    log.verbose('templateNpm', this.templateNpm);
    // 拷贝模板代码至当前目录
    let spinner = spinnerStart('installing template...');
    await sleep();
    try {
      const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template');
      const targetPath = process.cwd();
      fse.ensureDirSync(templatePath);
      fse.ensureDirSync(targetPath);
      fse.copySync(templatePath, targetPath);
    } catch (e) {
      throw e;
    } finally {
      spinner.stop(true);
      log.success('install template success');
    }
    const templateIgnore = this.templateInfo.ignore || [];
    const ignore = ['**/node_modules/**', ...templateIgnore];
    await this.ejsRender({ ignore });
    const { installCommand, startCommand } = this.templateInfo;
    log.verbose('installCommand', installCommand);
    log.verbose('startCommand', startCommand);
    // 依赖安装
    if(installCommand){
      await this.execCommand(installCommand, 'node_modules install fail！');
    }
    
    // 启动命令执行
    if(startCommand){
      await this.execCommand(startCommand, 'execution fail！');
    }
    
  }

  async installCustomTemplate() {
    // 查询自定义模板的入口文件
    if (await this.templateNpm.exists()) {
      const rootFile = this.templateNpm.getRootFilePath();
      if (fs.existsSync(rootFile)) {
        log.notice('start execute customized template...');
        const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template');
        const options = {
          templateInfo: this.templateInfo,
          projectInfo: this.projectInfo,
          sourcePath: templatePath,
          targetPath: process.cwd(),
        };
        const code = `require('${rootFile}')(${JSON.stringify(options)})`;
        log.verbose('code', code);
        await execAsync('node', ['-e', code], { stdio: 'inherit', cwd: process.cwd() });
        log.success('customized template install success');
      } else {
        throw new Error('customized template entry file not exist！');
      }
    }
  }

  async downloadTemplate() {
    const { projectTemplate } = this.projectInfo;
    const templateInfo = this.template.find(item => item.npmName === projectTemplate);
    const targetPath = path.resolve(userHome, '.glen-cli', 'template');
    const storeDir = path.resolve(userHome, '.glen-cli', 'template', 'node_modules');
    const { npmName, version } = templateInfo;
    this.templateInfo = templateInfo;
    const templateNpm = new Package({
      targetPath,
      storeDir,
      packageName: npmName,
      packageVersion: version,
    });
    if (!await templateNpm.exists()) {
      const spinner = spinnerStart('installing template...');
      await sleep();
      try {
        await templateNpm.install();
      } catch (e) {
        throw e;
      } finally {
        spinner.stop(true);
        if (await templateNpm.exists()) {
          log.success('download template success');
          this.templateNpm = templateNpm;
        }
      }
    } else {
      const spinner = spinnerStart('installing template...');
      await sleep();
      try {
        await templateNpm.update();
      } catch (e) {
        throw e;
      } finally {
        spinner.stop(true);
        if (await templateNpm.exists()) {
          log.success('update template success');
          this.templateNpm = templateNpm;
        }
      }
    }
  }

  async prepare() {
    // 0. 判断项目模板是否存在
    const template = await getProjectTemplate();
    if (!template || template.length === 0) {
      throw new Error('project template not exist');
    }
    this.template = template;
    // 1. 判断当前目录是否为空
    const localPath = process.cwd();
    if (!this.isDirEmpty(localPath)) {
      let ifContinue = false;
      if (!this.force) {
        // 询问是否继续创建
        ifContinue = (await inquirer.prompt({
          type: 'confirm',
          name: 'ifContinue',
          default: false,
          message: 'current directory not empty,whether to continue creating the project?',
        })).ifContinue;
        if (!ifContinue) {
          return;
        }
      }
      // 2. 是否启动强制更新
      if (ifContinue || this.force) {
        // 给用户做二次确认
        const { confirmDelete } = await inquirer.prompt({
          type: 'confirm',
          name: 'confirmDelete',
          default: false,
          message: 'whether to confirm to clear current directory？',
        });
        if (confirmDelete) {
          // 清空当前目录
          fse.emptyDirSync(localPath);
        }
      }
    }
    return this.getProjectInfo();
  }

  async getProjectInfo() {
    function isValidName(v) {
      return /^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(v);
    }

    let projectInfo = {};
    let isProjectNameValid = false;
    if (isValidName(this.projectName)) {
      isProjectNameValid = true;
      projectInfo.projectName = this.projectName;
      log.verbose('here-------------------this.projectName', this.projectName)
    }else{
      log.verbose('here-------------------')
    }
    let type = ''
    if(process.env.CLI_DEFAULT_TYPE && String(process.env.CLI_DEFAULT_TYPE).trim().length > 0 && VALID_TYPE.some(e=>(String(e) == String(process.env.CLI_DEFAULT_TYPE)))){
      type = process.env.CLI_DEFAULT_TYPE
    } else {
      // 1. 选择创建项目或组件
      const { type: typeRes } = await inquirer.prompt({
        type: 'list',
        name: 'type',
        message: 'please select initial type',
        default: TYPE_PROJECT,
        choices: [{
          name: 'project',
          value: TYPE_PROJECT,
        }, {
          name: 'component',
          value: TYPE_COMPONENT,
        }],
      });
      type = typeRes;
    }
    log.verbose('type', type);
    log.verbose('template', this.template);
    this.template = this.template.filter(template =>
      template.tag.includes(type));
    const title = type === TYPE_PROJECT ? 'preject' : 'component';
    const projectNamePrompt = {
      type: 'input',
      name: 'projectName',
      message: `please input ${title} name`,
      default: '',
      validate: function(v) {
        const done = this.async();
        setTimeout(function() {
          // 1.首字符必须为英文字符
          // 2.尾字符必须为英文或数字，不能为字符
          // 3.字符仅允许"-_"
          if (!isValidName(v)) {
            done(`please input legal ${title} name`);
            return;
          }
          done(null, true);
        }, 0);
      },
      filter: function(v) {
        return v;
      },
    };
    const projectPrompt = [];
    // 默认的快捷初始化配置
    const quickDefaultProjectInfo = {};
    if (!isProjectNameValid) {
      // 如果存在默认的仓库名称， 那么就跳过询问
      if(process.env.CLI_DEFAULT_NAME && String(process.env.CLI_DEFAULT_NAME).trim().length > 0){
        quickDefaultProjectInfo.projectName = process.env.CLI_DEFAULT_NAME;
      } else {
        projectPrompt.push(projectNamePrompt);   
      }
    }
    // 如果存在快速名称， 那么默认版本就选用1.0.0
    if(process.env.CLI_DEFAULT_NAME && String(process.env.CLI_DEFAULT_NAME).trim().length > 0){
      quickDefaultProjectInfo.projectVersion = '1.0.0'
    } else {
      projectPrompt.push({
        type: 'input',
        name: 'projectVersion',
        message: `please input ${title} version`,
        default: '1.0.0',
        validate: function(v) {
          const done = this.async();
          setTimeout(function() {
            if (!(!!semver.valid(v))) {
              done('please input legal version');
              return;
            }
            done(null, true);
          }, 0);
        },
        filter: function(v) {
          if (!!semver.valid(v)) {
            return semver.valid(v);
          } else {
            return v;
          }
        },
      });
    }

    // 存在选择的默认模板 
    if(process.env.CLI_DEFAULT_TEMPLATENAME && String(process.env.CLI_DEFAULT_TEMPLATENAME).trim().length > 0  && this.createTemplateChoice().some(e=>(String(e.value) == String(process.env.CLI_DEFAULT_TEMPLATENAME)))){
      quickDefaultProjectInfo.projectTemplate = process.env.CLI_DEFAULT_TEMPLATENAME;
    } else {
      projectPrompt.push(
        {
          type: 'list',
          name: 'projectTemplate',
          message: `please select ${title} template`,
          choices: this.createTemplateChoice(),
      });
    }
    // 默认的快捷配置目前场景只有component 中的@glen-tool/component-model， 所以这里不做拓展
    if (type === TYPE_PROJECT) {
      // 2. 获取项目的基本信息  
      const project = await inquirer.prompt(projectPrompt);
      projectInfo = {
        ...projectInfo,
        type,
        ...project,
        ...quickDefaultProjectInfo
      };
    } else if (type === TYPE_COMPONENT) {
      // 2. 此处确定拿到需要的模板信息，获取模板组件的基本信息
      const component = await inquirer.prompt(projectPrompt);
      const { projectTemplate: selectedNpmName} = component;
      let selectedTemplteInfo = {};
      let componentExtensionOptions = {};
      try{
        selectedTemplteInfo = this.template.filter(el=> String(el?.npmName) === String(selectedNpmName || quickDefaultProjectInfo.projectTemplate))[0];
      } catch(err){
        log.verbose('获取异常',err);
      }
      let componentPrompts = [];
      if(Object.keys(selectedTemplteInfo).length){
        // 对于组件模块,支持默认模板配置的默认参数： 包含且不限： dependencies等配置
        const { defaultConfigs, inquiryKeys } = selectedTemplteInfo;
        if(Object.keys(defaultConfigs).length){
          componentExtensionOptions = {...componentExtensionOptions, ...defaultConfigs}
        }
        log.verbose('打印selectedTemplteInfo', defaultConfigs, inquiryKeys)
        //inquiryKeys 是额外可以自定义的字段
        if(inquiryKeys.length){
          inquiryKeys.forEach(el=>{
            componentPrompts.push({
              type: 'input',
              name: el,
              message: `please set ${el} in repo`,
              default: '',
              validate: function(v) {
                const done = this.async();
                setTimeout(function() {
                  if (!v) {
                    done(`please set ${el} in repo`);
                    return;
                  }
                  done(null, true);
                }, 0);
              }
            })
          })
        }
      }
      let inquiryKeysAnswers = {};
      if(componentPrompts.length){
        inquiryKeysAnswers = await inquirer.prompt(componentPrompts);
      }
      projectInfo = {
        ...projectInfo,
        type,
        ...componentExtensionOptions,
        ...component,
        ...inquiryKeysAnswers,
        ...quickDefaultProjectInfo
      };
    }
    // 生成classname
    if (projectInfo.projectName) {
      projectInfo.name = projectInfo.projectName;
      projectInfo.className = require('kebab-case')(projectInfo.projectName).replace(/^-/, '');
    }
    if (projectInfo.projectVersion) {
      projectInfo.version = projectInfo.projectVersion;
    }
    if (projectInfo.componentDescription) {
      projectInfo.description = projectInfo.componentDescription;
    }
    return projectInfo;
  }

  isDirEmpty(localPath) {
    let fileList = fs.readdirSync(localPath);
    // 文件过滤的逻辑
    fileList = fileList.filter(file => (
      !file.startsWith('.') && ['node_modules'].indexOf(file) < 0
    ));
    return !fileList || fileList.length <= 0;
  }

  createTemplateChoice() {
    return this.template.map(item => ({
      value: item.npmName,
      name: item.name,
    }));
  }
}

function init(argv) {
  return new InitCommand(argv);
}

module.exports = init;
module.exports.InitCommand = InitCommand;
