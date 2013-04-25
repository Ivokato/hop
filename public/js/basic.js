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
          src: lazyloader.makeSizedSrc(trueSrc, $this.width(), $this.height()),
          'data-truesrc': trueSrc
        });
				
				$img.on('click.lightbox', function(){
					$(this).lightbox();
				});
				
        $this.after($img);
        $this.remove();
      });
    };
		this.makeSizedSrc = function(src, width, height){
			if( !this.isLocalSrc(src) ) return src;
			console.log(src);
      var splitSrc = src.split('.');
			splitSrc[splitSrc.length-2] += '-' + width + 'x' + height;
			return splitSrc.join('.');
		};		
		this.getRawSrc = function(src){
			var match = /-[0-9]+x[0-9]+/.exec(src);
			if(!match || !this.isLocalSrc(src) ) return src;
			else return src.replace(match[0], '');
		};
    this.isLocalSrc = function(src){
      return src[0] == '/' || src.indexOf(location.host) !== -1;
    };
  }
  
  $.fn.overlay = function(){
    var $overlay = $('<div data-role="overlay">');
    $overlay.css({
			opacity: 0,
      background: 'rgba(0,0,0,.8)',
      width: '100%',
      height: '100%',
      position: 'fixed',
      top: 0,
      left: 0,
      'z-index': '1000'
    });
		
		$(this).append($overlay);
		
    $overlay.on('click', function(e){
      if(e.target !== this) return;
			$overlay.animate({opacity: 0}, 200, function(){
				$overlay.trigger('remove');
				$overlay.remove();
			});
    });
		$overlay.animate({opacity: 1}, 500);
    return $overlay;
  }
	
	$.fn.lightbox = function(options, callback){
		
    var $origImg = $(this);
    
    var $overlay = $('body').overlay(),
        width = Math.floor($overlay.width()/100) * 100,
        height = Math.floor($overlay.height()/100) * 100,
				rawSrc = lazyloader.getRawSrc($origImg.attr('src')),
        src = lazyloader.makeSizedSrc(rawSrc, width, height),
        $img = $('<img>',{
					src: src,
					'data-noIntent': true
				});
    
		$img.css({opacity: 0});
		
    $overlay.append($img.attr('data-noIntent', true));
    $img.on('load', function(){
			var screen = {width: $img.parent().width(), height: $img.parent().height()},
					img = {width: $img.width(), height: $img.height()};
			
			$img.css({
				position: 'absolute',
				top: (screen.height - img.height) / 2 + 'px',
				left: (screen.width - img.width) / 2 + 'px'
			});
			
			var ready = function(){
				$img.animate({opacity: 1}, 500);
			}
			
			if( !(options && !options.bare) ){
				if(window.imageIntents && window.imageIntents.length){
					var $imageIntents = $('<div>', {'class': 'intents', position: 'absolute'}),
							$intent;
					
					for(var i in imageIntents){
						$intent = $('<img>', {src: imageIntents[i].icon, alt: imageIntents[i].name});
						
						(function(intent){
						  $intent.on('click', function(){
								intent.fun(rawSrc, []);
							});
						})(imageIntents[i]);
						
						$imageIntents.append($intent);
					}
					
					$img.after($imageIntents);
				}
			}
			
			if(callback && typeof callback == 'function') callback($img, ready);
			else ready();
    });
  };
  
  window.lazyloader = new LazyLoader;
  window.socket = socket;
	window.imageIntents = [];
})()

$(document).ready(function(){
  window.lazyloader.init();
});

if(window.localStorage){
  window.getStoredObject = function(identifier, parser){
  var str = localStorage[identifier];
    if(str) return (parser || JSON.parse)(str);
    else return undefined;
  };
  window.setStoredObject = function(identifier, object, stringifier){
    localStorage[identifier] = (stringifier || JSON.stringify)( object );
  };
}