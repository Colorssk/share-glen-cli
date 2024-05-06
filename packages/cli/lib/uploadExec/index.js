const formatPath = require('../utils/format-path');
const { checkFilesRecursive, abbPath }  = require('../utils/util') 
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const tree =  require('tree-cli')
const log = require('../utils/log');
const inquirer = require('inquirer');
const { exec: spawn } = require('../utils/util');
const {  platformMaps, PLATFORM_UNPKG, PLATFORM_FILE_STORE } = require('../const')

async function uploadExec(){
    // 指定执行目录(请指定相对路径)
    let targetPath = process.env.CLI_TARGET_PATH;
    let platform = process.env.CLI_UPLOAD_PLATFORM;
    let uploadUri = process.env.CLI_UPLOAD_SERVER;
    if (String(platform).trim().length > 0 && String(platform).trim() !== 'undefined'){
        platform = String(platform).trim();
        console.log(platform)
        if (!platformMaps.hasOwnProperty(platform)){
            log.error('warning', `please get your choice in [${Object.keys(platformMaps).join('|')}]`)
            return
        }
    } else {
        platform = PLATFORM_FILE_STORE
    }
    // 必须指定连接的服务域名
    if (String(uploadUri).trim().length === 0 || String(uploadUri).trim() === 'undefined'){
        log.error('warning', `please specified your server hostname with argument --uploadUri`)
        process.exit(1);
    } 
    let execPath = path.resolve('./')
    execPath = formatPath(!targetPath ? execPath :  path.join(path.resolve('./'), targetPath))
    const { files = [], subDirs = [] } = checkFilesRecursive(execPath)
    
    if (files.length === 0){
        // 文件夹异常，抛出异常
        log.error('warning', "please check the directory you specified, its empty");
        process.exit(1);
    } else {
        // 再次确认要上传的目录： 列出来
        tree({
            base: execPath,
            noreport: true,
            l: 4,
            link: true,
        }).then(async res => {
            console.log(res.report);
            let ifContinue = false
            ifContinue = (await inquirer.prompt({
                type: 'confirm',
                name: 'ifContinue',
                default: true,
                message: 'confirm that: these files you want to upload?',
            })).ifContinue;
            if (!ifContinue) {
                return;
            }
            ifContinue = (await inquirer.prompt({
                type: 'confirm',
                name: 'ifContinue',
                default: false,
                message: 'confirm that: select platform you want upload again(default platform is [customized file services])?',
            })).ifContinue;
            if (ifContinue) {
                // 重新选择平台 
                platform = (await inquirer.prompt({
                    type: 'list',
                    name: 'platform',
                    message: 'please select the platform you want to upload assets',
                    default: PLATFORM_FILE_STORE,
                    choices:  Object.keys(platformMaps).map(el=>({
                        name: platformMaps[el].label,
                        value: el
                    })),
                })).platform  
            }
            // 设置需要上传的平台
            console.log('platform:', platform)
            let rootFile = platformMaps[platform||PLATFORM_FILE_STORE].scriptLocation
            // 根据不同的平台执行不同平台的脚本
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
            // 根据平台区分，传不同的参数
            if (uploadUri.charAt(uploadUri.length - 1) === '/') {
                uploadUri = uploadUri.slice(0, -1);
            }
            if(platform === 'unpkg') {
                // unpkg 私服
                o.unpkgUri = platformMaps[platform].mirrorUri
                o.uploadUri = uploadUri
                o.uploadPath = execPath
            } else {
                // 静态文件上传服务
                o.uploadPath = execPath
                o.uploadUri = uploadUri
            }
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
        });
        // console.log(JSON.stringify(abbPath(files, execPath)), '\r\n\r\n\r\n\r\n\r\n', JSON.stringify(abbPath(subDirs, execPath)))
    }
    
    


}

module.exports =  uploadExec