'use strict';

const axios = require('axios');
const https =  require('https');

const BASE_URL = process.env.GLEN_CLI_BASE_URL ? process.env.GLEN_CLI_BASE_URL :
  'http://xxx.xxx.xxx.xx:7001'; // 替换： 成你自己的服务地址

const request = axios.create({
  baseURL: BASE_URL,
  timeout: 5000,
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});

request.interceptors.response.use(
  response => {
    return response.data;
  },
  error => {
    return Promise.reject(error);
  }
);

module.exports = request;
