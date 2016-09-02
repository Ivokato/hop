var allTransitions = {
      crossfade: function($oldContent, injectNew, removeOld){
        $oldContent.transition({opacity: 0}, 200, 'ease', function(){
          removeOld();
          injectNew({opacity: 0}, function injectCallback($newContent, done){
            $newContent.transition({opacity: 1}, 300, 'ease', function(){
              done();
            });
          });
        });
      },
      flip: function($oldContent, injectNew, removeOld){
        $oldContent.transition({
          rotateY: 90,
          opacity: 0
        }, 600, 'in', function onOldTransitionEnd(){
          removeOld();
          injectNew({
            rotateY: -90,
            opacity: 0
          },
          function injectCallback($newContent, done){
            $newContent.transition({
              rotateY: 0,
              opacity: 1
            }, 600, 'out', done);
          });
        });
      },
      rotaSwap: function($oldContent, injectNew, removeOld){
        $oldContent
        .css({'transform-origin': '50% 0%'})
        .transition({
          rotate: 180,
          opacity: 0
        }, 1500, 'in', function onOldTransitionEnd(){
          removeOld();
          injectNew({
            rotate: -180,
            opacity: 0,
            'transform-origin': '50% 0%'
          },
          function injectCallback($newContent, done){
            $newContent.transition({
              rotate: 0,
              opacity: 1
            }, 1500, 'out', done);
          });
        });
      },
      shiftNext: function($oldContent, injectNew, removeOld){
        injectNew({
          'transform-origin': '100% 0%',
          scale: 0,
          opacity: 1
        }, function injectCallback($newContent, done){

          $oldContent
          .css({
            'transform-origin': '0% 0%',
            position: 'absolute',
            top: $oldContent.offset().top + 'px',
            left: $oldContent.offset().left + 'px',
            width: $oldContent.width() + 'px'
          })
          .transition({
            scale: 0
          }, 2000, 'linear', removeOld);

          $newContent.transition({
            scale: 1
          }, 2000, 'linear', function(){
            $newContent.css({
              'transform-origin': 'initial'
            });
            done();
          });

        });
      }
