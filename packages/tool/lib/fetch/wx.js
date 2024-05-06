import stomp from 'stompjs'

class Ws {
  constructor(option) {
    this.wsInstance = null;
    this.subEvents = {};// save all subscribe events
    this.sockjsUrl = option.sockjsUrl || '';// connect ws url -- param url
    this.connectObj = option.connectObj || {};// connection's first param -- param url
    this.subscribeUrls = option.subscribeUrls || [];// subscribe urls its array -- param url
    this.conditionalConnect = option.conditionalConnect || null // conditional connect -- param url
    this.failConnectAction = option.failConnectAction || null// failConnectAction callback -- param url
  }
  // conditional connect the
  connect() {
    if (this.conditionalConnect && typeof this.conditionalConnect === 'function') {
      if (this.conditionalConnect()) {
        this.wsInstance = stomp.client(this.sockjsUrl);
        if (!this.wsInstance) {
          throw new Error('client connect fail, please check net');
        }
      } else {
        this.failConnectAction('socket连接失败');
      }

    } else {
      throw new Error('param conditionalConnect invalid, require function return boolean');
    }
    return this;
  }
  // manually close connection
  disConnect() {
    if (this.wsInstance) {
      this.wsInstance.disconnect();
      this.subEvents = [];
    }
  }
  // subscribe events
  triggle() {
    if (this.subscribeUrls && this.subscribeUrls.length) {
      this.wsInstance.connect(this.connectObj,  () => {
        this.subscribeUrls.forEach(url => {
          if(this.subEvents[url]){
            this.wsInstance.subscribe(url, res=>{
              if(typeof this.subEvents[url].callBack === 'function'){
                this.subEvents[url].callBack(JSON.stringify(res))
              }
            })
          }
         
        });
      })
    } else {
      throw new Error('subscribeUrls require array')
    }
  }
  // registry connection --export
  registry(subscribeUrl, handleFun) {
    if(this.wsInstance){
      try{
        if(!this.subEvents[subscribeUrl]){
          this.subEvents[subscribeUrl] = {}
        }
        this.subEvents[subscribeUrl] = {
          url: subscribeUrl,
          callBack: handleFun
        }
      }catch(err){
        throw new Error('error in registry function:', err)
      }
      this.triggle();
      return this;
    }
  }
  send(){
    if(this.wsInstance){
      console.log(...arguments)
      this.wsInstance.send(...arguments)
    }
    return this
  }
}

export default  Ws