(function BasicSetup(){
  var socket = io.connect('/');
  socket.on('reload', function (data) {
    if(data.path.indexOf(location.pathname) !== -1 || data.path == '/') location.reload();
  });
  
  function LazyLoader(){
    this.init = function(){
	  var lazyloader = this;
      $('[data-role=imgPlaceholder]').each(function(){
        var $this = $(this),
            trueSrc = $this.attr('data-src');
        
        var $img = $('<img>', {
          src: lazyloader	.makeSizedSrc(trueSrc, $this.width(), $this.height()),
          'data-truesrc': trueSrc
        });
        $this.after($img);
        $this.remove();
      });
    };
	this.makeSizedSrc = function(src, width, height){
	  var splitSrc = src.split('.');
	  splitSrc[splitSrc.length-2] += '-' + width + 'x' + height;
	  return splitSrc.join('.');
	};		
	this.getRawSrc = function(src){
	  var match = /-[0-9]+x[0-9]+/.exec(src);
	  if(!match) return src;
	  else return src.replace(match[0], '');
	};
  }
  
  $.fn.overlay = function(){
    var $overlay = $('<div data-role="overlay">');
    $(this).append($overlay)
    $overlay.css({
      background: 'rgba(0,0,0,.5)',
      width: '100%',
      height: '100%',
      position: 'fixed',
      top: 0,
      left: 0,
      'z-index': '1000'
    });
    $overlay.on('click', function(e){
      console.log(e.target, this);
      if(e.target !== this) return;
      $overlay.trigger('remove');
      $overlay.remove();
    });
    return $overlay;
  }
  
  window.lazyloader = new LazyLoader;
  window.socket = socket;
})()

$(document).ready(function(){
  window.lazyloader.init();
});