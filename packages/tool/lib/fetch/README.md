ws使用：
```
let wsTest = new Ws(
      {
        sockjsUrl: 'ws://xxx.xxx.xxx.xxx:8091/pc/websocket',
        subscribeUrls: ['/socket/topic/getResponse', '/socket/user/0001/listener'],
        conditionalConnect: ()=>!!isLogin,
        failConnectReason: '连接websocket错误： 未登录'
      }
    )
wsTest.registry('/socket/topic/getResponse',res=>{
    console.log('listen1:', res)
})
let header = {}, message = '';
wsTest.send('/socket/topic/getResponse',header,message);
```