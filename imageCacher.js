var fs = require("fs"),
    imgMagick = require("imagemagick");

function validatePath(basepath, path, callback){
  var array = path.split('/'),
      lowestDirectory = array.shift(),
      str = (basepath ? basepath + '/' : '') + lowestDirectory;
  
  fs.exists(str, function(exists){
    if(exists){
      if(array.length) validatePath(str, array.join('/'), callback);
      else callback();
    }
    else fs.mkdir(str, function(error){
      if(error) console.log(error);
      else {
        if(array.length) validatePath(str, array.join('/'), callback);
        else callback();
      }
    })
  });
}

function removeNonEmptyFolder(path, callback){
  var level = level || 0,
      callback = callback || function(){};
  fs.exists(path, function(exists){
    if(!exists) callback();
    else {
      fs.readdir(path, function(error, files){
        if(files.length){
          var i = 0,
              t = 0,
              done = false,
              increment = function(error){
                if(error) console.log(error);
                t++;
                if((t == +i + 1) && done) {
                  fs.rmdir(path, callback);
                }
              };
          
          for(i in files){
            (function(file){
              var localPath = path + '/' + file;
              fs.stat(localPath, function(error, stats){
                if(stats.isDirectory()) removeNonEmptyFolder(localPath, increment);
                else fs.unlink(localPath, increment);
              });
            })(files[i]);
          }
          done = true;
        }
        else fs.rmdir(path, callback);
      });
    }
  });
}

function ImageCache(maxSize){
  this.maxSize = maxSize * (1024 * 1024);
  this.currentSize = 0;
  this.entries = {};
  
  //clear old cache
  fs.exists('imagecache', function(exists){
    if(!exists){
      fs.mkdir('imagecache');
    }
    else removeNonEmptyFolder('imagecache', function(){
      fs.mkdir('imagecache');
    });
  });
}
(function(){
  this.check = function(){
    if(this.currentSize > this.maxSize){
      var sizes = [];
      for(var e in this.entries){
        var entry = this.entries[e];
        for(var s in entry.sizes){
          var size = entry.sizes[s];
          sizes.push({e: e, s: s, size: size.size, time: size.time});
        }
      }
      sizes.sort(function(a,b){ return b.time - a.time });
      
      while(this.currentSize > this.maxSize && sizes.length > 1){
        var instance = sizes.pop(),
            splitName = instance.e.split('.'),
            extension = splitName.pop(),
            filename = splitName.join('.') + '-' + instance.s + '.' + extension;
        fs.unlink('imagecache/' + filename);
        delete this.entries[instance.e].sizes[instance.s];
        if(!this.entries[instance.e].countChildren()) delete this.entries[instance.e];
        this.currentSize -= instance.size;
        console.log('imagecache/' + filename + ' removed from cache.');
      }
    }
  };
  this.clear = function(path){
    console.log('clearing ' + path);
    for(var i in this.entries){
      if(i.indexOf(path) !== -1){
        var entry = this.entries[i];
        for(var s in entry.sizes){
          var size = entry.sizes[s],
              splitName = i.split('.'),
              extension = splitName.pop(),
              filename = splitName.join('.') + '-' + s + '.' + extension;
          fs.unlink('imagecache/' + filename);
          this.currentSize -= size.size;
        }
        delete this.entries[i];
        fs.stat('imagecache/' + path, function(error, stats){
          if(error) console.log('error: ' + error + ', path: ' + path);
          if(stats.isDirectory()){
            fs.readdir('imagecache/' + path, function(error, files){
              if(!files.length) fs.rmdir('imagecache/' + path, function(){
                
                //check if parent folder is empty too
                var split = path.split('/')
                if(split.length > 1){
                  split.pop();
                  var join = split.join('/');
                  fs.readdir('imagecache/' + join, function(error, files){
                    if(!files.length) fs.rmdir('imagecache/' + join);
                  });
                }
              });
            });
          }
        });
      }
    }
  };
  this.get = function(src, callback){
    var cache = this,
        fileArray = src.split('-'),
        dimensions = fileArray.pop().split('.'),
        extension = dimensions.pop(),
        filename = fileArray.join('-') + '.' + extension,
        dimensionsConcatted = dimensions[0];
    
    dimensions = dimensionsConcatted.split('x');
    dimensions = {width: dimensions[0], height: dimensions[1]};
    fileArray = fileArray.join('-').split('/');
    fileArray.pop();
    
    console.log(filename, dimensions, dimensionsConcatted);
    console.log(this.entries);
    
    if(this.entries[filename]){
      var entry = this.entries[filename];
      
      if(entry.sizes[dimensionsConcatted]){
        entry.sizes[dimensionsConcatted].time = new Date().getTime();
        fs.readFile('imagecache/' + src, function(error, img){
          if(error) callback(error);
          else callback(null, img);
        });
      }
      else{
        if(entry.width < dimensions.width && entry.height < dimensions.height){
          fs.readFile('content/' + filename, function(error, img){
            callback(error, img);
          });
        }
        else imgMagick.resize({
          srcPath: 'content/' + filename,
          dstPath: 'imagecache/' + src,
          width: dimensions.width,
          height: dimensions.height,
          progressive: true,
          quality: 0.8
        }, function(err, stdout, sderr){
          entry.sizes[dimensionsConcatted] = {time: new Date().getTime()};
          
          fs.readFile('imagecache/' + src, function(error, img){
            callback(error, img);
            
            fs.stat('imagecache/' + src, function(error, stats){
              if(!error){
                entry.sizes[dimensionsConcatted].size = stats.size;
                cache.currentSize += stats.size;
                cache.check();
              }
              else console.log(error);
            });
          });
        });
      }
    }
    else{
      imgMagick.identify(['-format', '%wx%h', 'content/' + filename], function(error, output){
        if(error) console.log('imagemagick error: ', error, ' for ' + src);
        else{
          var output = output.split('x'),
              width = +output[0],
              height = +output[1],
              entry = {
                sizes: {},
                width: width,
                height: height
              }
          ;
          cache.entries[filename] = entry;
          
          if(width < dimensions.width && height < dimensions.height){
            fs.readFile('content/' + filename, function(error, img){
              callback(error, img);
            });
          }
          else validatePath('imagecache', fileArray.join('/'), function(error){
            if(error) console.log(error);
            else imgMagick.resize({
              srcPath: 'content/' + filename,
              dstPath: 'imagecache/' + src,
              width: dimensions.width,
              height: dimensions.height,
              progressive: true,
              quality: 0.8
            }, function(err, stdout, sderr){
              entry.sizes[dimensionsConcatted] = {time: new Date().getTime()};
              
              fs.readFile('imagecache/' + src, function(error, img){
                callback(error, img);
                
                fs.stat('imagecache/' + src, function(error, stats){
                  if(!error){
                    entry.sizes[dimensionsConcatted].size = stats.size;
                    cache.currentSize += stats.size;
                    cache.check();
                  }
                  else console.log(error);
                });
              });
            });
          });
        }
      });
    }
  };
}).call(ImageCache.prototype);

exports.ImageCache = ImageCache;