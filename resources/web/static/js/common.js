//禁止双击放大
var lastTouchEnd = 0;
document.documentElement.addEventListener('touchend', function (event) {
  var now = Date.now();
  if (now - lastTouchEnd <= 300) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, false);

//禁止双指放大
document.documentElement.addEventListener('touchstart', function (event) {
  if (event.touches.length > 1) {
    event.preventDefault();
  }
}, false);
// 阻止双指放大
document.addEventListener('gesturestart', function (event) {
    event.preventDefault();
})

/*禁止默认滑动切换页面事件*/
var startX,startY;
document.addEventListener("touchstart",function(e){
    startX = e.targetTouches[0].pageX;
    startY = e.targetTouches[0].pageY;
});
document.addEventListener("touchmove",function(e){
    var moveX = e.targetTouches[0].pageX;
    var moveY = e.targetTouches[0].pageY;
    if(Math.abs(moveX-startX)>Math.abs(moveY-startY)){
        e.preventDefault();
    }
},{passive:false});