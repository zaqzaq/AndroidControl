
let ip = window.location.hostname
let port = window.location.port
port=port==""?80:port

// 通过url参数初始化
let urlParams = initWithUrlParams();

//判断移动端
const isMobile=()=>{
    return !!navigator.userAgent.match(/(phone|pad|pod|iPhone|iPod|ios|iPad|Android|Mobile|BlackBerry|IEMobile|MQQBrowser|JUC|Fennec|wOSBrowser|BrowserNG|WebOS|Symbian|Windows Phone)/i);
}

//是否竖屏
const isPortrait = () => {
    return document.documentElement.clientWidth < document.documentElement.clientHeight;
}

const scaleDevice=.6//FIXME 后端minicap图片缩放质量
let scaleDisplay=100;//FIXME 前端展示绽放大小比例
const rotateDevice=false; //FIXME 是否后端minicap图片旋转
//初始旋转角度
const initRotate = 90;
//pc端不旋转
let rotateDisplay = isMobile() ? initRotate : 0;//FIXME 前端展示旋转

const $box = $('.phone-screen-box');
const $phoneScreen = $('#phone-screen');

const setSize = (w, h) => {
    const direction = rotateDisplay % 360;
    const rate = direction ? h / w : w / h;
    const boxW = $box.width();
    const boxH = $box.height();
    const boxRate = boxW / boxH;

    let size;
    if(direction){
        size  = rate > boxRate ? {
            width: boxW/rate,
            height:boxW
        } : {
            width: boxH,
            height: boxH * rate
        }
    }else {
        size = rate > boxRate ? {
            width: boxW,
            height: boxW / rate
        } : {
            width: boxH * rate,
            height: boxH
        }
    }

    $phoneScreen.attr({
        width:w,
        height:h
    });
    $phoneScreen.css(size);
    $phoneScreen.css({
        transform:'rotate('+rotateDisplay+'deg)'
    })

    deviceInfo.physicsSize.w = size.width;
    deviceInfo.physicsSize.h = size.height;

    scaleDisplay = (size.width / w) * 100;

}

window.onload = function() {


    deviceInfo.serialNumber = urlParams.sn

    const $main=$('#main');

    if(isMobile()){
        $main.addClass('isMobile');
        // $('#rotateModal').modal('show');
    }
    if (rotateDisplay % 360) {
        $main.addClass('is-landscape');
    }
    setSize(urlParams.w, urlParams.h);

    //全屏完成回调
    window.document.body.addEventListener('fullscreenchange',function(e){
        setSize(urlParams.w, urlParams.h);
        g.drawImage(canvas.img, 0, 0, canvas.width, canvas.height);
    });

    //请求全屏
    const toFull=function () {
        try {
            if (window.document.body.requestFullscreen) {
                window.document.body.requestFullscreen().catch(function (e){
                    console.log('e',e)
                });
            } else {
                window.document.body.webkitRequestFullscreen();
            }
        } catch (e) {
            console.log('requestFullscreen err',e)
        }
    }

    //横屏自动全屏
    window.addEventListener('orientationchange', function(e){
        if(screen.orientation.angle!==0){
            if (rotateDisplay) {
                rotateDisplay = 0
            }
            toFull();
        }else{
            if(initRotate){
                rotateDisplay = initRotate
            }
        }
        setSize(urlParams.w, urlParams.h);
        g.drawImage(canvas.img, 0, 0, canvas.width, canvas.height);
    },false);

    $('#full-screen').on('click', function () {
        toFull();
        $('#rotateModal').modal('hide');
    });

    $(window).on('resize',function () {
        setSize(urlParams.w,urlParams.h);
        g.drawImage(canvas.img, 0, 0, canvas.width, canvas.height);
    })

    // 滑动条初始化
    var displayScaleSlider = $("#display-scale-slider").slider({
        max: 100,
        min: 10,
        step: 5,
        value: scaleDisplay,
        change: onDisplayScaleChange
    })

    var scaleSlider = $('#scale-slider').slider({
        max: 100,
        min: 5,
        step: 5,
        value: scaleDevice*100,
        change: onScaleChange
    })

    $('#rotateCheckBox').on('click', function() {
        deviceWindow.rotate = $('#rotateCheckBox').prop('checked')
        net.request("M_START", {type: "cap", config: {rotate: deviceWindow.rotate ? 90 : 0, scale: deviceWindow.scale}})
        // 隐藏设置窗口
        $('#myModal').modal('hide')
        // 显示等待capservice窗口
        $('#resetScaleModal').modal('show')

        onDisplayScaleChange()
    })

    $('#keyEventCheckBox').on('click', function() {
        deviceWindow.keyMap = $('#keyEventCheckBox').prop('checked')
    })

    function onDisplayScaleChange() {
        let scale = displayScaleSlider.slider("value") / 100.0;
        deviceWindow.displaySize.w = parseInt(deviceInfo.physicsSize.w * scale)
        deviceWindow.displaySize.h = parseInt(deviceInfo.physicsSize.h * scale)
        deviceWindow.resize(false)

        canvas.width = deviceWindow.displaySize.w;
        canvas.height = deviceWindow.displaySize.h;
        g.drawImage(canvas.img, 0, 0, canvas.width, canvas.height);
    }

    function onScaleChange() {
        let scale = scaleSlider.slider("value") / 100.0

        deviceWindow.scale = scale
        // vue
        title.outputScale = scale

        net.request("M_START", {type: "cap", config: {rotate: deviceWindow.rotate ? 90 : 0, scale: deviceWindow.scale}})
        // 隐藏设置窗口
        $('#myModal').modal('hide')
        // 显示等待capservice窗口
        $('#resetScaleModal').modal('show')
    }

    // 初始化窗口
    let scale = displayScaleSlider.slider("value") / 100.0;
    deviceWindow = new DeviceWindow($('#content'), deviceInfo, {
        w: deviceInfo.physicsSize.w * scale,
        h: deviceInfo.physicsSize.h * scale
    })

    deviceWindow.resize()

    // vue
    title.outputScale = scale

    // 连接服务器
    net = new NetWork(ip, port)
    net.connect({
        onopen() {
            net.request("M_WAIT", {sn: deviceInfo.serialNumber})
        },
        onclose() {
            console.log("连接中断");
            //TODO 重新连接
//            deviceWindow.win.close()
        },
        onmessage(msg) {
            let data = msg.data
            if (typeof(data) == 'string') {
                this.ontext(data)
            } else {
                this.onbinary(data)
            }
        },
        ontext(text) {
            let sp = text.indexOf('://')
            if (sp == -1) {
                console.log("无效的协议")
                this.onclose()
            }

            let head = text.substr(0, sp)
            let body = text.substring(sp + 3)

            let func = this[head]
            func.call(this, body)
        },
        onbinary(data) {
            let self = this
            let fr = new FileReader()
            fr.readAsArrayBuffer(data.slice(0, 2))
            fr.onload = function() {
                let headType = new Int16Array(fr.result)[0]
                switch (headType) {
                    case 0x0011:
                        self.SM_JPG(data.slice(6))
                    break;
                }
            }
        },
        SM_OPENED(body) {
            net.request("M_START", {type: "cap", config: {rotate: deviceWindow.rotate ? 90 : 0, scale: deviceWindow.scale}})
            net.request("M_START", {type: "event"})
        },
        SM_SERVICE_STATE(body) {
            console.log("SM_SERVICE_STATE" + body)
            let obj = JSON.parse(body)
            console.warn(obj.type + ":" + obj.stat)
            if (obj.type == 'cap' && obj.stat == 'open') {
                // 隐藏等待capservice的窗口
                $('#resetScaleModal').modal('hide')
                this.M_WAITTING()
            }
        },
        SM_JPG(jpgdata) {
            var blob = new Blob([jpgdata], {type: 'image/jpeg'});
            var URL = window.URL || window.webkitURL;
            var img = new Image();
            img.onload = function () {
                // canvas.width = parseInt(deviceWindow.displaySize.w);
                // canvas.height = parseInt(deviceWindow.displaySize.h);
                // console.log(canvas.width, canvas.height)
                g.drawImage(img, 0, 0, canvas.width, canvas.height);
                img.onLoad = null;
                img = null;
                u = null;
                blob = null;
            };
            var u = URL.createObjectURL(blob);
            img.src = u;
            canvas.img = img

            if (deviceWindow.resized) {
                deviceWindow.resize()
            }

            this.M_WAITTING()
        },
        M_WAITTING() {
            net.request("M_WAITTING", null)
        }
    })
}

/** nav-height:24px */
const nav_height = 24;
/** footer-height: 42px */
const footer_height = 42;

let deviceSize = {
    w: 1080,
    h: 1920
}

/**
 * 描述deivce信息的类
 */
class DeviceInfo {
    constructor() {
        // 设备的物理大小
        this.physicsSize = {
            w: 0,
            h: 0
        }
        this.serialNumber = ""
    }
}

/**
 * 对该窗口的操作类
 */
class DeviceWindow {
    constructor(win, deviceInfo, defaultDisplaySize={w:0, h:0}) {
        this.win = win // 操作的窗口
        this.deviceInfo = deviceInfo
        this.scale = scaleDevice
        this.rotate = rotateDevice // 屏幕是否旋转，默认=false=默认屏
        this.keyMap = false // 是否键盘映射
        this.displaySize = defaultDisplaySize
    }

    resize(setCenter = true) {

        if (this.rotate) {
            [this.displaySize.w, this.displaySize.h] = [this.displaySize.h, this.displaySize.w]
        }

        // vue
        title.displaySize = this.displaySize

        let w = this.displaySize.w
        let h = this.displaySize.h + nav_height + footer_height
        // this.win.css('width', w + "px")
        // this.win.css('height', h + "px")
    }
}

/**
 * 网络操作
 */
class NetWork {
    constructor(ip, port) {
        this.ip = ip
        this.port = port
    }

    connect(config) {
        let webSocket = new WebSocket("ws://" + ip + ":" + port)
        webSocket.onopen = function() {
            config.onopen()
        }
        webSocket.onclose = function() {
            config.onclose()
        }
        webSocket.onmessage = function(data) { 
            config.onmessage(data)
        }
        this.webSocket = webSocket
    }

    request(name, argobj) {
        let ss = name + "://" + (argobj ? JSON.stringify(argobj) : "{}");
        this.webSocket.send(ss);
    }

    send(str) {
        this.webSocket.send(str)
    }
}

/**
 * Device 的 Vue 组件
 */

let deviceInfo = new DeviceInfo()
let deviceWindow = null
let net = null

let title = new Vue({
    // el: '#title',
    data: {
        displaySize: {w: 1080, h: 1920},
        outputScale: 0.3
    },
    computed: {
        title: function() {
            return this.displaySize.w + "x" + this.displaySize.h + "  |  " + parseInt(deviceInfo.physicsSize.w*this.outputScale)+ "x" + parseInt(deviceInfo.physicsSize.h*this.outputScale);
        }
    }
})

/**
 * 返回url参数组成的js对象
 */
function initWithUrlParams() {
    let ret = {}
    let ss = window.location.search.substr(1).split('&')
    for (s of ss) {
        let sp = s.split('=')
        ret[sp[0]] = sp[1]
    }
    return ret
}

let isDown = false

var canvas = document.getElementById("phone-screen");
var g = canvas.getContext('2d');

//前端界面旋转
// canvas.style.transform = 'rotate('+(rotateDisplay%360)+'deg)'

String.prototype.startWith=function(str){
    var reg=new RegExp("^"+str);
    return reg.test(this);
};

String.prototype.endWith=function(str){
    var reg=new RegExp(str+"$");
    return reg.test(this);
};

$("#btn-menu").on('click', function(){
    sendKeyEvent(82)
})

$("#btn-home").on('click', function(){
    sendKeyEvent(3)
})

$("#btn-back").on('click', function(){
    sendKeyEvent(4)
})

$(document).keypress(function(event) {
    if (deviceWindow && deviceWindow.keyMap) {
        let code = event.keyCode
        let keyEvent = convertAndroidKeyCode(code)
        sendKeyEvent(keyEvent)
    }
})

$('#btn-scale').on('click', function() {
    let slider = $('#scale-slider')
    let scaleBtn = $('#btn-scale')
    let w = scaleBtn.outerWidth()

    slider.offset({
        left: w / 2 - slider.outerWidth() / 2
    })

    slider.toggle()

})

// 获取鼠标在html中的绝对位置
function mouseCoords(event){
    let e = event;
    //兼容touch事件
    if (event.touches && event.touches.length) {
        e = event.touches[0]
    }
    if(e.pageX || e.pageY){
        return {x:e.pageX, y:e.pageY};
    }
    return{
        x:e.clientX + document.body.scrollLeft - document.body.clientLeft,
        y:e.clientY + document.body.scrollTop - document.body.clientTop
    };
}
// 获取鼠标在控件的相对位置
function getXAndY(control, event){
    //鼠标点击的绝对位置
    Ev= event || window.event;
    var mousePos = mouseCoords(event);
    var x = mousePos.x;
    var y = mousePos.y;
    //alert("鼠标点击的绝对位置坐标："+x+","+y);

    //获取div在body中的绝对位置
    var x1 = control.offsetLeft;
    var y1 = control.offsetTop;

    //计算旋转后的坐标
    var halfX = control.clientWidth / 2;
    var halfY = control.clientHeight / 2;
    var centerX = control.offsetLeft + halfX;
    var centerY = control.offsetTop + halfY;
    var angle = rotateDisplay * Math.PI / 180;
    var xx = (x1 - centerX) * Math.cos(angle) - (y1 - centerY) * Math.sin(angle) + centerX;
    var yy = (x1 - centerX) * Math.sin(angle) + (y1 - centerY) * Math.cos(angle) + centerY;
    var left = rotateDisplay ? xx - control.clientHeight : xx;
    var top = yy;

    //鼠标点击位置相对于div的坐标
    var x2 = x - left;
    var y2 = y - top;

    if (rotateDisplay) {
        //旋转后 转转x,y坐标
        var tempX2 = x2;
        x2 = y2;
        y2 = control.clientHeight - tempX2;
    }
    return {x:x2,y:y2};
}

function sendTouchEvent(minitouchStr) {
    net.send("M_TOUCH://" + minitouchStr);
}

function sendKeyEvent(keyevent) {
    net.send("M_KEYEVENT://" + keyevent)
}

function sendDown(argx, argy, isRo) {
    var scalex = deviceInfo.physicsSize.w / canvas.width;
    var scaley = deviceInfo.physicsSize.h / canvas.height;
    var x = argx, y = argy;
    if (isRo) {
        x = (canvas.height - argy) * (canvas.width / canvas.height);
        y = argx * (canvas.height / canvas.width);
    }
    x = Math.round(x / scalex);
    y = Math.round(y / scaley);
    var command = "d 0 " + x + " " + y + " 50\n";
    command += "c\n";
    sendTouchEvent(command);
}

function sendMove(argx, argy, isRo) {
    var scalex = deviceInfo.physicsSize.w / canvas.width;
    var scaley = deviceInfo.physicsSize.h / canvas.height;
    var x = argx, y = argy;
    if (isRo) {
        x = (canvas.height - argy) * (canvas.width / canvas.height);
        y = argx * (canvas.height / canvas.width);
    }
    x = Math.round(x / scalex);
    y = Math.round(y / scaley);

    var command = "m 0 " + x + " " + y + " 50\n";
    command += "c\n";
    sendTouchEvent(command);
}

function sendUp() {
    var command = "u 0\n";
    command += "c\n";
    sendTouchEvent(command);
}

canvas.onmousedown =canvas.ontouchstart= function (event) {
    isDown = true;
    var pos = getXAndY(canvas, event);
    sendDown(pos.x, pos.y, deviceWindow.rotate);
};

canvas.onmousemove =canvas.ontouchmove= function (event) {
    if (!isDown) {
        return;
    }
    var pos = getXAndY(canvas, event);

    sendMove(pos.x, pos.y, deviceWindow.rotate);
    event.preventDefault();
};

canvas.onmouseover = function (event) {
    console.log("onmouseover");
};

canvas.onmouseout = canvas.ontouchcancel=function (event) {
    if (!isDown) {
        return;
    }
    isDown = false;
    sendUp();
};

canvas.onmouseup = canvas.ontouchend=function (event) {
    if (!isDown) {
        return;
    }
    isDown = false;
    sendUp();
};

if(isMobile()){
    canvas.ontouchstart = canvas.onmousedown;
    canvas.onmousedown=null;

    canvas.ontouchmove = canvas.onmousemove;
    canvas.onmousemove=null;

    canvas.ontouchcancel = canvas.onmouseout;
    canvas.onmouseout=null;

    canvas.ontouchend = canvas.onmouseup;
    canvas.onmouseup=null;
}
