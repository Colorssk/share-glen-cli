const Command = require('../../models/command');
const inquirer = require('inquirer');
const axios = require('axios');
const https =  require('https');
const formatPath = require('../../utils/format-path');
const {  platformMaps, PLATFORM_FILE_STORE } = require('../../const')
const ignoreSSL = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    })
});
class InitCommand extends Command {
    init() {
      console.log('init---unpkgUpload upload:', this._cmd)
    }
  
    async exec() {
        // 询问确认是否上传了unpkg: 需要确认点是上传的unpkg服务地址
        const isContinue = (await inquirer.prompt({
            type: 'confirm',
            name: 'isContinue',
            default: true,
            message: `confirm that: you have published your assets to(private unpkg/cdn): ${this._cmd.unpkgUri}`,
        })).isContinue;
        // 更新数据库信息
        const headers = {
            'Content-Type': 'application/json'
        };
        if (isContinue) {
            // 获取当前项目内的moduleName, version,并且请开发确认
            let hel_metaFilePath = formatPath(path.join(this._cmd.uploadPath,'hel-meta.json'))
            console.log(hel_metaFilePath)
            const hel_json = require(hel_metaFilePath);
            if (hel_json && Object.keys(hel_json).length > 0){
                const { app: { name: moduleName, build_version: version } } = hel_json
                const isConfirm = (await inquirer.prompt({
                    type: 'confirm',
                    name: 'isConfirm',
                    default: true,
                    message: `confirm that: you want to publish module: [${moduleName}], verison: [${version}]`,
                })).isConfirm;
                if (isConfirm) {
                    ignoreSSL.post(`${this._cmd.uploadUri}/updateModule`, {
                        moduleName,
                        isUseValid: 2,
                        version
                    }, { headers })
                    .then(response => {
                        console.log(response.data?.Message);
                    })
                    .catch(error => {
                        log.error('Error:', error);
                    });
                }
            }
        }
    }
}
  
function init(argv) {
    return new InitCommand(argv);
}
  
module.exports = init;
module.exports.InitCommand = InitCommand;