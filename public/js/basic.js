//todo: inject this from content/config.json
var lightboxFilmstripSize = {x: 100, y: 75};

// transitions
var pageTransitions = {
			crossfade: function($oldContent, injectNew, removeOld){
				$oldContent.animate({opacity: 0}, 100, function(){
					removeOld();
					injectNew({opacity: 0}, function($newContent, done){
						$newContent.animate({opacity: 1}, 100, function(){
							done();
						});
					});
				});
			}
		};

function pageTransition($oldContent, injectNew, removeOld, style){
	if(style && pageTransitions[style]){
		pageTransitions[style]($oldContent, injectNew, removeOld);
		return;
	}
	//pick a random transition because none supplied
	var transitions = [],
			i, randomTransition;
	for(i in pageTransitions){
		transitions.push(pageTransitions[i]);
	}
	randomTransition = transitions[Math.floor(Math.random() * transitions.length)];
	randomTransition($oldContent, injectNew, removeOld);
}
// end transitions

(function BasicSetup(){

	var socket = io.connect('/');
	socket.on('reload', function (data) {
		if(data.path.indexOf(location.pathname) !== -1 || data.path == '/') location.reload();
	});

	var cachedContent = {},
			initialUrl = location.href, //prevent first time pop
			getCallback;

	$(window).on('popstate', function(event){
		var href = location.href;
		if(href == initialUrl){
			initialUrl = null;
			return;
		}
		if(cachedContent[href]){
			applyPageTransition(cachedContent[href], href);
		} else {
			$.get(href, function(result){
				cachedContent[href] = result;
				applyPageTransition(result, href);
			});
		}
	});

	$('body').on('hover', 'a', function(){
		var href = $(this).attr('href');
		if(cachedContent[href] || (href[0] !== '/' && href[1] === '/') && href.indexOf(location.host) === -1){
			return;
		}
		$.get(this.href, function(result){
			cachedContent[href] = result;
			if(getCallback){
				getCallback(result);
				getCallback = null;
			}
		});
	}).on('click', 'a', function(event){
		var href = $(this).attr('href');

		if((href[0] !== '/' && href[1] === '/') && href.indexOf(location.host) === -1){
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		if(cachedContent[href]){
			applyPageTransition(cachedContent[href], href);
		} else {
			getCallback = function(data){ applyPageTransition(data, href); };
		}
	});

	function applyPageTransition(newData, href){
		var $content = $('#content'),
				$oldContent = $content.children(),
				$oldScripts = $('#scripts').children('script'),
				$oldStyles = $('head link[rel="stylesheet"][data-hopcore!="true"]'),
				$newData = $(newData),
				$newContent = $newData.find('#content').children(),
				newTitle = $newData.find('title').html(),
				$newStyles = $newData.find('#styles').children(),
				newUniqueStyles = [],
				$newScripts = $newData.find('#scripts').children(),
				$transition = $.Deferred(),
				arrived = false,
				removed = false,
				newStyleHrefs = [];

		history.pushState(null, newTitle, href);

		$transition.progress(function(string){
			if(string == 'arrived') arrived = true;
			if(string == 'removed') removed = true;
			if(arrived && removed){
				$transition.resolve();
			}
		});

		$transition.done(function(){
			$(window).trigger('pagechanged');
		});

		//determine which styles to append
		$newStyles.each(function(i, currentStyle){
			var $currentStyle = $(currentStyle),
					href = $currentStyle.attr('href');

			if( !$oldStyles.filter('[href="' + href + '"]').length ){
				newUniqueStyles.push($currentStyle);
			}
			
			newStyleHrefs.push(href);
		});

		console.log(newUniqueStyles);
		
		pageTransition(
			$oldContent,
			function injectNew(css, callback){
				var $cssloader = new $.Deferred,
						loadList = [];

				for(var i in newUniqueStyles){
					$('link[rel="stylesheet"]').eq(-1).after(newUniqueStyles[i]);
					loadList.push(newUniqueStyles[i].attr('href'));
					// newUniqueStyles[i].on('load', function(){
					// 	$cssloader.notify( $(this).attr('href') );
					// });
				}
				// $cssloader.progress(function(href){
				// 	alert('href');
				// 	loadList.splice(loadList.indexOf(href), 1);
				// 	if(!loadList.length){
				// 		$cssloader.resolve();
				// 	}
				// });

				$cssloader.done(function(){
					$newContent.css(css).appendTo($content);

					lazyloader.init($newContent);

					$newContent.css(css);

					$('title').html(newTitle);
					$('nav a.active').removeClass('active');
					$('nav a[href="' + href + '"]').addClass('active');

					$newScripts.each(function(j, currentScript){
						var $currentScript = $(currentScript),
								src = $currentScript.attr('src');
						if( !$oldScripts.find('[href="' + src + '"]').length ){
							$('#scripts script').eq(-1).after($currentScript);
						}
					});

					callback($newContent, function done(){
						$transition.notify('arrived');
					});
				});

				if(!loadList.length){
					$cssloader.resolve();
				} else {
					//after the timeout, new css has hopefully applied
					//(for browsers that don't support style load event)

					(function checkSheetsLoaded(){
						var loaded = [],
								href,
								link;
						
						for(var i in loadList){
							href = loadList[i];
							link = $('link[href="' + href + '"]')[0];
							
							if(
								(link.sheet && link.sheet.cssRules && link.sheet.cssRules.length) ||
								(link.styleSheet && link.styleSheet.cssText && link.styleSheet.cssText.length) ||
								(link.innerHTML && link.innerHTML.length)
							){
								loaded.push(href);
							}
						}

						for(var j in loaded){
							loadList.splice(loadList.indexOf(loaded[j]), 1);
						}
						if(loadList.length) setTimeout(arguments.callee);
						else {
							//alert('all loaded');
							setTimeout($cssloader.resolve, 1000);
						}
					})();

					// setTimeout(function(){
					// 	alert('resolving by timeout');
					// 	$cssloader.resolve();
					// }, 100000);
				}
			},

			function removeOld(){
				$oldContent.remove();

				$oldStyles.each(function(i, currentStyle){
					var $currentStyle = $(currentStyle);
					if(newStyleHrefs.indexOf($currentStyle.attr('href')) === -1){
						$currentStyle.remove();
					}
				});

				$transition.notify('removed');
			}
		);

	}

	function LazyLoader(){
		this.init = function($element){
			var lazyloader = this;
			$element = $element || $(document.body);
		
			$element.find('[data-role=imgPlaceholder]').each(function(){
				var $this = $(this),
						trueSrc = $this.attr('data-src'),
						split = trueSrc.split('/').pop().split('.'),
						srcName,
						$figureElement,
						size = {x: $this.width(), y: $this.height()},
						width, height;
				
				split.pop();
				srcName = split.join('.');
				
				$figureElement = $element.find('figure[name="' + srcName + '"]');

				if($figureElement.length){
					width = $figureElement.width();
					height = $figureElement.height();
					
					if(width && height){
						size = {x: width, y: height};
					} else {
						$this.addClass('default');
						$figureElement.addClass('default');
					}
					$this.prependTo($figureElement);
				}
				
				$this.attr('src', lazyloader.makeSizedSrc(trueSrc, size.x, size.y))
				.on({
					'click.lightbox': function(){
						var $this = $(this),
								src = $this.attr('src');
						if (!inLightboxIgnore(src)&& !$(this).attr('data-noLightbox')) {
							$this.lightbox();
						}
					},
					load: function(){
						$this.removeAttr('style');
						$figureElement.css({width: $this[0].naturalWidth, height: $this[0].naturalHeight});
					}
				})
				.removeAttr('data-role');
			});
		};

		this.makeSizedSrc = function(src, width, height){
			if( !this.isLocalSrc(src) ) return src;
			var props = [];
			if(width) props.push('width=' + width);
			if(height) props.push('height=' + height);

			return src + '?' + props.join('&');
		};

		this.getRawSrc = function(src){
			return src.split('?')[0];
		};

		this.isLocalSrc = function(src){
			return (src[0] == '/' && src[1] !== '/') || src.indexOf(location.host) !== -1;
		};

	}
	
	function inLightboxIgnore(src) {
		if (!window['lightboxIgnore']) {
			return false;
		}
		else{
			for (var i in lightboxIgnore) {
				if (new RegExp(lightboxIgnore[i]).test(src)) {
					return true;
				}
			}
			return false;
		}
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
	};

	$.fn.lightbox = function(options, callback){
		options = options || {};

		var $origImg = $(this),
				$siblings = $origImg.parents('article, section').eq(0).find('img'),
				$overlay = $('body').overlay(),
				rawSrc = lazyloader.getRawSrc($origImg.attr('src')),
				frame = { x: $overlay.width(), y: $overlay.height() },
				arrows,
				filmstrip;
		
		function setImage(src, caption, index){
			var $img = $('<img>',{
						'data-noIntent': true
					}),
					$newFig = $('<figure>', {
						css: {
							opacity: 0
						}
					}),
					$curFig = $overlay.find('figure'),
					imgMaxWidth = frame.x,
					imgMaxHeight = frame.y;
			
			$overlay.find('div.loader').remove();

			var $spinner = $('<div class="loader">')
						.css({
							'z-index': 5,
							position: 'fixed'
						})
						.appendTo($overlay);
			
			$spinner.css({
				top: frame.y / 2 - $spinner.height() / 2 + 'px',
				left: frame.x / 2 - $spinner.width() / 2 + 'px'
			});

			$newFig.append($img);
			$overlay.append($newFig);

			if(caption){
				var $caption = $('<figcaption class="slideCaption">')
							.html(caption)
							.css({
								position: 'fixed',
								width: frame.x + 'px',
								left: 0,
								'text-align': 'center',
							})
							.appendTo($newFig),
						height = 0,
						align = 'bottom'; //<--extractable
				
				if(filmstrip && align == 'bottom') height = filmstrip.height;
				$caption.css(align, height);
			}
			
			$img.attr('src', lazyloader.makeSizedSrc(src, imgMaxWidth, imgMaxHeight));
			
			//for intents a.o.
			rawSrc = src;
			currentImageIndex = index;

			$img.on('load', function(){
				var screen = {width: $img.parent().width(), height: $img.parent().height()},
						img = {width: $img.width(), height: $img.height()};
				
				$img.css({
					position: 'absolute',
					top: (imgMaxHeight - img.height) / 2 + 'px',
					left: (imgMaxWidth - img.width) / 2 + 'px'
				});
				
				function ready(){
					$spinner.remove();

					$newFig.animate({opacity: 1}, 500);
					$curFig.animate({opacity: 0}, 500, function(){
						$curFig.remove();
					});
				}
				if(!callback) ready();
				else callback($img, ready);
			});
			
			if(arrows){
				arrows.setArrows();
			}

			if(filmstrip){
				filmstrip.scrollTo(index);
			}
		} //end setImage
			
		if( !options.bare ){
			if($siblings.length > 1){
				if(!options.noFilmstrip && $siblings.length > 1){ //start FILMSTRIP
				
					var thumbSize = options.filmstripSize || lightboxFilmstripSize || {x: 150, y: 150},
							thumbAspect = thumbSize.x / thumbSize.y,
							currentImageIndex,
							viewWidth = $overlay.width(),
							stripWidth = thumbSize.x * $siblings.length,
							$filmstripContainer = $('<div class="filmstripContainer">').css({
								width: viewWidth + 'px',
								height: thumbSize.y + 'px',
								position: 'fixed',
								bottom: 0,
								'overflow-x': 'scroll',
								'overflow-y': 'hidden'
							}),
							$filmstrip = $('<div class="filmstrip">').css({
								width: stripWidth,
								height: thumbSize.y,
								position: 'relative'
							}).appendTo($filmstripContainer);
					
					if(thumbSize.x * $siblings.length < viewWidth){
						$filmstripContainer.css({
							width: stripWidth + 'px',
							left: (viewWidth - stripWidth) / 2 + 'px'
						});
					}
					
					filmstrip = {
						scrollTo: function(index){
							var containerWidth = $filmstripContainer.width(),
									halfContainerWidth = containerWidth / 2,
									filmstripWidth = $filmstrip.width(),
									spareWidth = filmstripWidth - containerWidth;
	
							if(spareWidth <= 0) return;

							//determine distance from left or right
							if((index + 0.5) * thumbSize.x < halfContainerWidth){
								$filmstripContainer.scrollLeft(0);
							} else if( ( ($siblings.length - index) + 0.5) * thumbSize.x < halfContainerWidth){
								$filmstripContainer.scrollLeft(filmstripWidth - containerWidth);
							} else {
								$filmstripContainer.scrollLeft( (index + 0.5) * ( filmstripWidth / $siblings.length ) - halfContainerWidth );
							}

							$filmstrip.find('div.current').removeClass('current');
							$filmstrip.find('div').eq(index).addClass('current');
						},
						hide: function(){
							$filmstripContainer.animate({bottom: -thumbSize.y + 'px'}, 500);
							frame.y += thumbSize.y;
						},
						show: function(){
							$filmstripContainer.animate({bottom: 0}, 500);
							frame.y -= thumbSize.y;
						},
						height: thumbSize.y
					};
					
					//reduce frame size
					frame.y -= thumbSize.y;
					
					$siblings.each(function(i, img){ // Insert thumbnails
						var $img = $(img),
								origWidth = $img.width(),
								origHeight = $img.height(),
								rawThumbSrc = lazyloader.getRawSrc( $img.attr('src') ),
								aspect = origWidth / origHeight,
								$figcaption = $img.parent('figure').find('figcaption'),
								size,
								caption;
						
						if($figcaption.length) caption = $figcaption.html();
						
						if(aspect < thumbAspect){
							scale = thumbSize.x / origWidth;
							size = { x: thumbSize.x, y: Math.ceil(scale * origHeight) };
						} else if(aspect > thumbAspect) {
							scale = thumbSize.y / origHeight;
							size = { x: Math.ceil(scale * origWidth), y: thumbSize.y };
						} else {
							scale = thumbSize.x / origWidth;
							size = { x: thumbSize.x, y: thumbSize.y };
						}
						
						var thumbSrc = lazyloader.makeSizedSrc(rawThumbSrc, size.x, size.y),
								$thumb = $('<div>').css({
									overflow: 'hidden',
									float: 'left',
									width: thumbSize.x + 'px',
									height: thumbSize.y + 'px',
									'background-image': 'url(' + thumbSrc + ')',
									'background-size': 'cover',
									'background-position': 'center'
								}).attr({
									'data-rawSrc': rawThumbSrc,
									'data-caption': caption
								}).appendTo($filmstrip)
								.on('click', function(){
									var $this = $(this);
									setImage( $this.attr('data-rawSrc'), $this.attr('data-caption'), i);
								});
						
						if(rawThumbSrc == rawSrc) currentImageIndex = i;
					});	//end inserting thumbnails
					
					$filmstripContainer.appendTo($overlay);
					
				} // end FILMSTRIP

				if(!options.noArrows){
					arrows = {
						left: $('<div class="goLeft">').appendTo($overlay),
						right: $('<div class="goRight">').appendTo($overlay),
						setArrows: function(){
							arrows.left.css('display', 'block');
							arrows.right.css('display', 'block');
							if(currentImageIndex == 0) arrows.left.css('display', 'none');
							else if(currentImageIndex == $siblings.length - 1) arrows.right.css('display', 'none');
						}
					}

					arrows.left.css({
						position: 'fixed',
						'z-index': 5,
						left: 0,
						top: (frame.y / 2) - (arrows.left.height() / 2) + 'px'
					}).on('click', function(){
						var $thumb;
						if(currentImageIndex > 0){
							$thumb = $siblings.eq(currentImageIndex - 1);
							setImage($thumb.attr('data-src'), $thumb.parent('figure').find('figcaption').html(), currentImageIndex - 1);
						}
					});
					arrows.right.css({
						position: 'fixed',
						'z-index': 5,
						right: 0,
						top: (frame.y / 2) - (arrows.right.height() / 2) + 'px'
					}).on('click', function(){
						var $thumb;
						if(currentImageIndex < $siblings.length - 1){
							$thumb = $siblings.eq(currentImageIndex + 1);
							setImage($thumb.attr('data-src'), $thumb.parent('figure').find('figcaption').html(), currentImageIndex + 1);
						}
					});
					
					$(document.body).on('keyup.lightbox', function(e){
						var $thumb, newIndex;
						if(e.keyCode == 37 && currentImageIndex > 0){
							newIndex = currentImageIndex - 1;
						} else if(e.keyCode == 39 && currentImageIndex < $siblings.length - 1){
							newIndex = currentImageIndex + 1;
						}
						if(newIndex || newIndex == 0){
							$thumb = $siblings.eq(newIndex);
							setImage($thumb.attr('data-src'), $thumb.parent('figure').find('figcaption').html(), newIndex);
							e.preventDefault();
							return false;
						}
					});
					$overlay.on('remove', function(){
						$(document.body).off('keyup.lightbox');
					});

				} //end arrows
			} //end ($siblings.length > 0)


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
					
					$overlay.append($imageIntents);
				} //end intents
			} //end options.bare
		
		setImage(rawSrc, $origImg.parent('figure').find('figcaption').html(), currentImageIndex);
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
