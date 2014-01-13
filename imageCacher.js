var fs = require("fs"),
    imgMagick = require("imagemagick"),
    fileUtils = require("./fileUtils.js"),
    validatePath = fileUtils.validatePath,
    removeNonEmptyFolder = fileUtils.removeNonEmptyFolder;

function ImageCache(maxSize, options){
	if(!options) options = {};
  this.maxSize = options.maxSize || maxSize * (1024 * 1024);
  this.currentSize = 0;
  this.entries = {};
  this.storageDir = options.storageDir || 'imagecache';
	this.basePath = options.basePath || 'content/';
  
  this.factory(); //enable internal types to run with proper scope
	var cache = this;

	//clear old cache storage
  fs.exists(this.storageDir, function(exists){
    if(!exists){
      fs.mkdir(cache.storageDir);
    }
    else removeNonEmptyFolder(cache.storageDir, function(){
      fs.mkdir(cache.storageDir);
    });
  });
}
(function(){
  this.factory = function(){
    
    var cache = this;
    
    this.Entry = function(part, promise){
      this.name;
      this.extension;
      this.systemPath;
      this.localPath;
      
      this.width;
      this.height;
      this.resolution; //?
      this.cachedViews = {};
      
      cache.entries[localPath] = this;
      this.load(promise);
    };
    //prototype methods for Entry
    (function(){
      this.load = function(promise){
        
        var entry = this;
        imgMagick.identify(cache.basePath + entry.localPath, function(error, features){
          if (features) {
            entry.width = features.width;
            entry.height = features.height;
            //entry.format = features.format;
            //entry.depth = features.depth;
            
            imgMagick.readMetaData(error, function(error, data){
              if (data) {
                entry.metaData = data;
              }
              if (promise) {
                if (typeof promise == 'function') {
                  promise(error, entry);
                } else promise.complete(error, entry);
              }
            });
          }
          else if (promise) {
            if (typeof promise == 'function') {
              promise(error, entry);
            } else promise.complete(error, entry);
          }
        });
      }
      this.get = function(query, callback){
        if (!query) {
          fs.readFile(cache.basePath + this.localPath, function(error, img){
            callback(error, img);
          });
        } else {
          
        }
      };
      this.addView = function(query, promise){
    /* query params:  srcPath: undefined,
                      srcData: null,
                      srcFormat: null,
                      dstPath: undefined,
                      quality: 0.8,
                      format: 'jpg',
                      progressive: false,
                      width: 0,
                      height: 0,
                      strip: true,
                      filter: 'Lagrange',
                      sharpening: 0.2,
                      customArgs: []*/
      };
    }).call(this.Entry.prototype);
  };
  this.get = function(src, query, callback){
    if(typeof query == 'function'){
			callback = query;
			query = {};
		}
		
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
        console.log('size match..');
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
          var splitName = i.split('.'),
              extension = splitName.pop(),
              filename = splitName.join('.') + '-' + s + '.' + extension;
          fs.unlink('imagecache/' + filename);
          this.currentSize -= entry.sizes[s];
        }
        delete this.entries[i];
        var split = path.split('/');
        split.pop();
        path = split.join('/');
        fs.stat('imagecache/' + path, function(error, stats){
          if(error) console.log('error: ' + error + ', path: imagecache/' + path);
          else{
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
          }
        });
      }
    }
  };
}).call(ImageCache.prototype);

exports.ImageCache = ImageCache;
