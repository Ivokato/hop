var path = require('path'),
    fs = require("fs"),
    imgMagick = require("imagemagick"),
    fileUtils = require("./fileUtils.js"),
    MemoryStore = require('./memoryStore.js'),
    validatePath = fileUtils.validatePath,
    removeNonEmptyFolder = fileUtils.removeNonEmptyFolder;

function ImageCache(options){
	if(!options) options = {};
  this.maxSize = options.maxSize * (1024 * 1024);
  this.diskSize = 0;
  this.entries = {};
  this.storageDir = options.storageDir || path.resolve(__dirname, 'imagecache');
	this.basePath = options.basePath;
  this.memoryStore = new MemoryStore(options);

  this.doMemoryStore = true;
  
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

  this.get = function(src, query, callback){
    if(typeof query == 'function') {
			callback = query;
			query = undefined;
		}
		
		if(this.entries[src]) this.entries[src].get(query, callback);
    else callback(new Error('imageCache: image not found'));
  };

  this.check = function(){
    var viewItem,
        viewItems,
        entry, e,
        view, v;

    if(this.diskSize > this.maxSize){
      viewItems = [];

      for(e in this.entries){
        entry = this.entries[e];

        for(v in entry.views){
          view = entry.views[v];

          viewItems.push({entry: entry, view: view, size: view.size, time: view.time});
        }
      }

      viewItems.sort(function(a,b){ return b.time - a.time; });
      
      while(this.diskSize > this.maxSize && views.length > 1){
        viewItem = views.pop();
        viewItem.entry.remove(viewItem.view);
      }
    }
  };

  this.clear = function(localPath){
    var entryName;
    console.log('clearing ' + localPath);

    for(entryName in this.entries) {
      if(entryName.indexOf( localPath ) !== -1 ){
        this.removeEntry(entryName);
      }
    }
  };

  this.addEntry = function addEntry(localPath, callback){
    return new this.Entry(localPath, callback);
  }

  this.removeEntry = function removeEntry(entryName){
    this.entries[entryName].remove();
    delete this.entries[entryName];
  };

  this.factory = function(){
    
    var cache = this;
    
    this.Entry = function Entry(filePath, callback){
      var pathResult = new RegExp('(.+' + path.sep + '+)').exec(filePath);
      
      this.path = filePath;
      this.directory = pathResult ? pathResult[0] : '';

      if(this.directory) validatePath(cache.storageDir + path.sep + this.directory);

      this.views = {};
      
      cache.entries[filePath] = this;
      this.load(callback);
    };
    //prototype methods for Entry
    (function(){
      this.load = function loadEntry(callback){
        
        var entry = this;

        imgMagick.identify(cache.basePath + path.sep + entry.path, function(error, features){
          if (features) {
            entry.width = features.width;
            entry.height = features.height;
            entry.aspect = entry.width / entry.height;
          }
          if(callback) callback(error, entry);
        });
      };

      this.get = function getEntry(query, callback){
        var string, version, CSVQuery, fullname, cached;

        if (!query.countChildren()) {

          fs.readFile(cache.basePath + path.sep + this.path, function(error, img){
            callback(error, img);
          });

        } else {

          this.sanitizeBounds(query);
          query = query.pickProperties(['width', 'height']);
          CSVQuery = query.toCSV();
          fullname = this.path + CSVQuery;
          cached = cache.memoryStore.get(fullname);

          if(cached){
            callback(null, cached);
            return;
          }

          view = this.views[CSVQuery];

          if(view){
            view.get(callback);
          }
          else {
            this.addView(query, function(error, img){
              callback(error, img);
              cache.memoryStore.put(fullname, img);
            });
          }

        }
      }; // end Entry.get

      this.remove = function(){
        for(var name in this.views) {
          this.removeView(name);
        }
      };

      this.sanitizeBounds = function sanitizeBounds(query) {
        
        //only supplied with or height
        if(!query.width && query.height || query.width && !query.height) {

          if(query.width) {
            query.width = Math.min(+query.width, this.width);
            query.height = Math.round(query.width / this.aspect);
          }
          else {
            query.height = Math.min(+query.height, this.height);
            query.width = Math.round(query.height * this.aspect);
          }
        }
        else if(query.width && query.height) { //width & height
          query.width = Math.min(this.width, +query.width);
          query.height = Math.min(this.height, +query.height);

          if(!query.crop){
            var qAspect = query.width / query.height;
            
            if(qAspect > this.aspect){
              query.width = Math.round(query.height * this.aspect);
            } else if(qAspect < this.aspect) {
              query.height = Math.round(query.width / this.aspect);
            }
          }
        }
        else { //no width or height
          query.width = this.width;
          query.height = this.height;
        }
      };

      this.addView = function addEntryView(query, callback){
        this.views[query.toCSV()] = new View(this.path, query, callback);
      };

      this.removeView = function removeEntryView(viewName) {
        this.views[viewName].remove();
        delete this.views[viewName];
        
        if(!this.views.countChildren()) cache.removeEntry(this.path);
      };

    }).call(this.Entry.prototype);

    function View(localPath, query, callback) {
      var view = this,
          srcPath = cache.basePath + path.sep + localPath,
          dstPathArray = (cache.storageDir + path.sep + localPath).split('.'),
          extension = dstPathArray.pop(),
          options;
      
      this.path = dstPathArray.join('.') + query.toCSV() + '.' + extension;

      options = {
        srcPath: srcPath,
        dstPath: view.path,
        width: query.width,
        height: query.height,
        progressive: true,
        quality: 0.8
      };

      imgMagick.resize(options, function(err, stdout, sderr){

          view.time = new Date().getTime();
          
          if(callback) view.get(callback);
            
          fs.stat(view.path, function(error, stats){
            if(!error){
              view.size = stats.size;
              cache.diskSize += stats.size;
              cache.check();
            }
            else console.log(error);
          });
        });
    }
    (function(){ // View prototype
      
      this.get = function(callback){
        fs.readFile(this.path, function(error, img){
          callback(error, img);
        });
      };

      this.remove = function(){
        cache.diskSize -= this.size;

        fs.unlink(this.path);
      };

    }).call(View.prototype);
  }; // end cache.Factory

}).call(ImageCache.prototype);

exports.ImageCache = ImageCache;
