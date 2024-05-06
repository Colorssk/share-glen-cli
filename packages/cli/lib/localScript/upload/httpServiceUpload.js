const Command = require('../../models/command');
const formatPath = require('../../utils/format-path');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const zlib = require('zlib');
const tar = require('tar');
const inquirer = require('inquirer');
const log = require('../../utils/log');
const https =  require('https');
const ignoreSSL = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    })
});
class InitCommand extends Command {
    init() {
        console.log('info: you have confirm the server hostname:', this._cmd.uploadUri)
        console.log('info: is going to tar the specified folder:', this._cmd.uploadPath)
    }
    exec() {
        // 将指定的文件夹打包成tar文件
        const sourceFolder = this._cmd.uploadPath;
        const targetPath = formatPath(path.resolve(sourceFolder, '..'))
        const tarFile = formatPath(path.join(targetPath, './assets.tar'));
        const conpressedTarFile = formatPath(`${tarFile}.gz`)
        tar.c({ file: tarFile, cwd: sourceFolder, portable: true },['.'])
        .then(async () => {
            console.log('Folder successfully packed as tar file');
            // 对tar文件进行压缩
            const gzip = zlib.createGzip();
            const input = fs.createReadStream(tarFile);
            const output = fs.createWriteStream(conpressedTarFile);
            input.pipe(gzip).pipe(output);
            // 接口上传压缩文件夹
            let uploadService = `${this._cmd.uploadUri}/uploadFiles`
            // 创建一个 FormData 对象
            const formData = new FormData();
            console.log('will upload file path:',conpressedTarFile)
            formData.append('assets', fs.createReadStream(conpressedTarFile)); // 添加文件资源
            let isUseValid = (await inquirer.prompt({
                type: 'confirm',
                name: 'isUseValid',
                default: true,
                message: 'confirm that: if its new module, you want let it use stable version?(default is true)',
            })).isUseValid;
            formData.append('isUseValid', isUseValid ? 2: 1); // 只有在初始化的时候才能设置，模块是否使用稳定版本
            const headers = {
                'Content-Type': `multipart/form-data; boundary=${formData._boundary}`
            };
            ignoreSSL.post(uploadService, formData, { headers })
            .then(response => {
                console.log(response.data);
            })
            .catch(error => {
                log.error('Error:', error);
            });

        })
        .catch((err) => {
            log.error('Error:', err);
            process.exit(1);
        });
    }
}
  
function init(argv) {
    return new InitCommand(argv);
}
  
module.exports = init;
module.exports.InitCommand = InitCommand;