var watch = require("watchr").watch,
    path = require('path'),
    fs = require("fs"),
    _ = require('underscore'),
    async = require('async'),
    imgMagick = require("imagemagick"),
		less = require("less"),
		lessparser = less.Parser({ optimization: 1 }),
    ImageCache = require('./imageCacher.js').ImageCache,
    fileUtils = require('./fileUtils.js'),
		getFolderContents = fileUtils.getFolderContents,
		getFile = fileUtils.getFile,
    validatePath = fileUtils.validatePath,
		imageTypes = {
			'jpg': 'image/jpg',
			'gif': 'image/gif',
			'png': 'image/png'
		},
    resourceTypes = {
      jpg: {
        mime: 'image/jpg',
        name: 'image',
        format: 'binary'
      },
      gif: {
        mime: 'image/gif',
        name: 'image',
        format: 'binary'
      },
      png: {
        mime: 'image/png',
        name: 'image',
        format: 'binary'
      },
      js:  {
        mime: 'text/javascript',
        name: 'javascript',
        format: 'text'
      },
      css: {
        mime: 'text/css',
        name: 'stylesheet',
        format: 'text'
      }
    },
    basicTextNames = {
      title: true,
      subtitle: true,
      introduction: true,
      body: true,
      footer: true
    },
    reservedFolderNames = {
      FormResponses: true,
			'.git': true
    }
;

function redefine(site, eventName, filePath){
  console.log('redefining: ', eventName, 'filePath: ', filePath);
	  var pathArray = stripPath(site.path + path.sep, filePath).split( path.sep );
		if(eventName == 'unlink' || eventName == 'delete'){
			if(pathArray.length == 1) site.remove(pathArray[0]);
			else site.sections.findOne({foldername: pathArray.shift()}).remove(pathArray);
		}
		else {
			fs.stat(filePath, function(err, stats){
        if(stats.isDirectory()){
          //getFolderContents(filePath, function(err, contents){
          //  console.log('folder updated', contents);
          //  getFile(filePath, function(err, file){
          //    if (err) console.log(err)
          //    else {
          //      var fileContainer = {};
          //      fileContainer[file.name] = file;
          //      site.update(pathArray, fileContainer);
          //    }
          //  });
          //});
          var fileContainer = {},
              folderName = pathArray[pathArray.length - 1];
          fileContainer[folderName] = {isDirectory: true, base: folderName};
          //console.log(stats);
          //console.log(pathArray);
          //throw('end');
          site.update(pathArray, fileContainer);
        }
				else{
					getFile(filePath, function(err, file){
						if(err) console.log(err);
						else{
							var fileContainer = {};
							fileContainer[file.name] = file;
							if(file.name[file.name.length-1] == '~') return;
							if(file.extension == 'swp') return;
							site.update(pathArray, fileContainer);
						}
					});
				}
			});
		}
	}

function Site(options){
  var sitename = options.name,
      sitePath = path.join( process.cwd(), options.contentPath );

	var site = this;
	watch({path: sitePath, listener: function(eventName, filePath, currentStat, previousStat){
    redefine(site, eventName, filePath);
	}});

  getFolderContents(sitePath, function(err, map){
		if(!err) site.diskdata = map;
		if(countChildren(site.diskdata)) {
			site.addData(site.diskdata);
			site.header.menu = createMenuFromStructure(site);
		}
	});
  this.sections = [];
  this.path = sitePath;
  this.rootpath = this.path;
	this.orderPattern = {
    sections: {unassigned: 'date', assigned: []},
    stylesheets: {unassigned: 'date', assigned: []},
    javascripts: {unassigned: 'date', assigned: []},
    extraContent: {unassigned: 'date', assigned: []}
  };
  this.menu = {};
	this.header = {};
	this.stylesheets = [];
  this.javascripts = [];
  this.extraContent = [];
  this.filesByName = {};
  
  this.liveViewers = [];
  
  this.defaultImageSize = {width: 500, height: 500};
  this.imageCache = new ImageCache({ imageCacheLimit: options.imageCacheLimit, basePath: this.path });
  
  this.header.menu = createMenuFromStructure(this);
}
(function(){
  this.getPath = function getPath(){
    if(this.parent){
      return this.parent.getPath() + this.foldername + '/';
    }

    return '/';
  },
  this.getDiskPath = function getDiskPath(){
    var parent = this;
    while(parent.parent){
      parent = parent.parent;
    }

    return parent.path + this.getPath();
  },
  this.addData = function(diskdata){
		var site = this,
        noChildren = true;
    _.each(diskdata, function processFile(file, name){
      
      if(name.indexOf('conflicted copy') !== -1){
        console.log('file ignored: ' + file.base);
        return;
      }

      noChildren = false;

      if(file.isDirectory){
        return this.addDirectory(file);
      }

      var addFunctionName = file.extension + 'Add',
          addFunction = this[addFunctionName];

      if(addFunction && typeof addFunction === 'function'){
        this[addFunctionName](file);
        this.sort();
        return;
      }
      console.log('don\'t yet know what to do with: ', name);
    }.bind(this));

    if(this instanceof Site){
      validatePath( path.resolve(__dirname, 'public', 'css'), function(){
        if(!site.background){
          fs.writeFileSync( path.resolve( __dirname, 'public', 'css', 'background.less'), '');
        }
  		  if(!site.header.logo){
          fs.writeFileSync( path.resolve( __dirname, 'public', 'css', 'logo.less'), '');
        }
      });

  		if(noChildren) {
        setTimeout(function(){
    			var path = options.contentpath + options.homesection;
    			fs.mkdirSync(path)
    		}, 500);
      }
    }

		this.sort();
  };
  this.addDirectory = function addDirectory(file){
    if(!(file.base in reservedFolderNames)){
      this[this.childrenList].push(new this.childrenType(file.base, this, file));
    }
  }
  this.addLogo = function addLogo(file){
    var logoPath = stripPath(this.path, file.path).substring(1);
    this.imageCache.addEntry( logoPath );
    this.header.logo = logoPath;

  };
  this.backgroundAdd = function addBackground(file){
    var bgndPath = stripPath(this.rootpath, file.path).substring(1);

    this.imageCache.addEntry(bgndPath);

    this.background = bgndPath;
    
    if(fs.existsSync( this.path + '/style.css')){
      fs.unlinkSync( this.path + '/style.css');
    }

    fs.writeFile(
      this.path + '/background.css',
      'html{min-height:100%;}body{min-height:100%;background: url(/' + bgndPath + ') no-repeat' + (this.backgroundColor ? ' ' + this.backgroundColor : '') + ';background-size:cover;}'
    );
  };
  this.jpgAdd = function jpgAdd(file){
    if(file.base.toLowerCase() == 'logo') {
      this.addLogo(file);
    }

    if(file.base.toLowerCase() == 'background') {
      this.backgroundAdd(file);
    }
  };
  this.pngAdd = this.jpgAdd;
  this.cssAdd = function cssAdd(file){
    var site = this;

    this.stylesheets.removeOne({name: file.base});
    this.stylesheets.push({src: this.getPath() + file.base + '.css', name: file.base, date: file.modified, contents: file.contents });
  };
  this.lessAdd = function lessAdd(file){
    lessparser.parse(file.contents, function(error, tree){
      if(error) return console.log(error);
      file.contents = tree.toCSS();
      this.cssAdd(file);
    }.bind(this));
  };
  this.jsAdd = function jsAdd(file){
    this.javascripts.removeOne({name: file.base});
    this.javascripts.push({src: this.getPath() + file.base + '.js', contents: file.contents, name: file.base, date: file.modified});
  };
  this.txtAdd = function txtAdd(file){
    var content = file.contents.split("\r\n").join('<br>');
      if(file.base in basicTextNames) {
        if(this instanceof Site && file.base == 'title' || file.base == 'subtitle') this.header[file.base] = content;
        else this[file.base] = content;
      }
      else{
        this.extraContent.push({name: file.base, content: content});
      }
  };
  this.jsonAdd = function jsonAdd(file){
    try{
      var json = JSON.parse(file.contents);
    }
    catch(e){
      console.log(e, file.base);
    }
    switch(file.base){
      case 'authentication':  this.authInfo = json; break;
      case 'imageSizes': this.defaultImageSize = json; break;
      case 'order': this.orderAdd(json); break;
    }
  };
  this.orderAdd = function orderAdd(json){
    replaceProps(this.orderPattern, json);
  };
  this.get = function(pathArray, cb){
    var pathRoot = pathArray.shift(),
        children = this[this.childrenList],
        child = children ? children.findOne({name: pathRoot}) : null;

    if(child){
      return child.get(pathArray, cb);
    }
    
    var pathRootArray = pathRoot.split('.'),
        extension = pathRootArray.pop(),
        base = pathRootArray.join('.'),
        type = resourceTypes[extension]; 
        var set = type && this[type.name + 's'],
        item;

    if(set){
      if(extension === 'css'){
        console.log(set);
      }
      item = set.findOne({name: base });
      if(item){
        return cb(null, {
          payload: item.contents,
          format: type.format,
          mime: type.mime
        });
      } else {
        console.log('item not found: ', pathRoot);
      }
    }

    cb();
  };
  this.childrenList = 'sections';
  this.childrenType = Section,
	this.sort = function(){
		multiSort(this);
	};
	this.remove = function(name){
		if(name.split('.').length == 1) {
			this.sections.removeOne({foldername: name});
      this.imageCache.clear(name);
		}
		else{
			var split = name.split('.'),
					filename = split[0],
					extension = split[1];
      if(filename !== 'background' && filename !== 'logo'){
        if(extension == 'txt'){
          if(filename in basicTextNames) delete this.contents[filename];
          else if(filename == 'order'){
            
          }
          else{
            this.extraContent.removeOne({name: filename});
          }
        }
        else if(extension in imageTypes) delete this.contents.images[filename];
        else if(extension == 'css' || extension == 'less') {
          this.stylesheets.removeOne({name: filename});
          if(extension == 'less'){
            if(fs.existsSync( this.path + '/' + filename + '.css')) fs.unlinkSync('content/' + filename + '.css');
          }
        }
        else if(extension == 'js') this.javascripts.removeOne({name: filename});
      }
      else{
        if(fs.existsSync( this.path + '/' + filename + '.less')) fs.unlinkSync( this.path+ '/' + filename + '.less');
      }
		}
	};
	this.update = function(pathArray, file){
		if(pathArray.length > 1){
      if(pathArray[0] in reservedFolderNames) return console.log('folder ignored, in reservedFolderNames');
			var section = this.sections.findOne({foldername: pathArray.shift()});
			//var section = this.sections[pathArray.shift()];
      if(section){
         section.update(pathArray, file);
      }
		}
		else{
			this.addData(file);
			this.header.menu = createMenuFromStructure(this);
      
      this.afterUpdate('/');
		}
	};
  this.afterUpdate = function(path){
    
    //reload liveViewers
    if(this.liveViewers.length) for(var i in this.liveViewers) this.liveViewers[i].socket.emit('reload', {path: path});
  }
}).call(Site.prototype);

function Section(name, site, data){
	this.name = name;
	this.foldername = name;
  this.title = name;
	Object.defineProperty(this, 'site', {value: site});
  Object.defineProperty(this, 'parent', {value: site});
	this.orderPattern = {
    items: {unassigned: 'date', assigned: []},
    images: {unassigned: 'date', assigned: []},
    stylesheets: {unassigned: 'date', assigned: []},
    javascripts: {unassigned: 'date', assigned: []},
    extraContent: {unassigned: 'date', assigned: []}
  };
  this.items = [];
  this.images = [];
  this.extraContent = [];
	this.stylesheets = [];
	this.javascripts = [];
	this.attachments = [];
	this.modified = data.modified;
  this.path = this.site.path + '/' + this.foldername;
  this.rootpath = this.site.path;
	this.imageCache = this.parent.imageCache;
  this.defaultImageSize = this.parent.defaultImageSize;

  if(data.children && countChildren.call(data.children)) this.addData(data.children);
}
(function(){
  this.getPath = Site.prototype.getPath;
  this.getDiskPath = Site.prototype.getDiskPath;
  // this.addData = function(data){
		// var section = this;
  //   for(var itemname in data){
  //     var item = data[itemname];
			
  //     if(item.base.indexOf('conflicted copy') !== -1){
  //       console.log('file ignored: ' + item.base);
  //       continue;
  //     }
  //     if(item.isDirectory){
  //       this.items.push(new Item(item.base, this, item));
  //     }
  //     else{
  //       if(item.extension in imageTypes){
  //         if(item.base.toLowerCase() == 'background') {
  //           var bgndPath = stripPath(this.site.path, item.path).substring(1);
  //           this.site.imageCache.addEntry(bgndPath);
            
		// 				fs.writeFile(
  //             this.site.path + path.sep + this.foldername + path.sep + 'background.less',
  //             'html{min-height:100%;}body{min-height:100%; background: url(' + bgndPath + ') no-repeat' + (this.backgroundColor ? ' ' + this.backgroundColor : '') + '; background-size:cover;}'
  //           );
		// 			}
  //         else{
  //           if(this.images.removeOne({name: item.base})) this.site.imageCache.clear( this.foldername + path.sep + itemname);
  //           this.images.push(new Image(item, this.site.path, this.site.defaultImageSize, this.site.imageCache));
  //         }
  //       }
		// 		else if(item.extension == 'less' || item.extension == 'css'){
  //         this.stylesheets.removeOne({name: item.base});
		// 			this.stylesheets.push({name: item.base, src: '/' + this.name + '/' + item.base + '.css', date: item.modified });
		// 			if(item.extension == 'less'){
		// 				lessparser.parse(item.contents, function(error, tree){
		// 					if(error) return console.log(error);
		// 					var fullpath = section.site.path + '/' + section.foldername + path.sep + item.base + '.css';
		// 					if(fs.existsSync(fullpath)) fs.unlinkSync(fullpath);
		// 					fs.writeFileSync(fullpath, tree.toCSS());
		// 				});
		// 			}
		// 		}
		// 		else if(item.extension == 'js'){
  //         this.javascripts.removeOne({name: item.base});
		// 			this.javascripts.push({name: item.base, contents: item.contents, src: '/' + this.name + '/' + item.base + '.js', date: item.modified });
		// 		}
		// 		else if(item.extension == 'txt'){
		// 			var content = item.contents.split('\r\n').join('<br>');
		// 			if(item.base in basicTextNames) section[item.base] = content;
		// 			else{
		// 				section.extraContent.removeOne({name: item.base});
		// 				section.extraContent.push({name: item.base, content: content});
		// 			}
  //       }
  //       else if(item.extension == 'json'){
		// 			try{ var json = JSON.parse(item.contents); }
		// 			catch(e){
		// 				console.log(e, item.base);
		// 				return;
		// 			}
		// 			if(item.base == 'form') section.form = new Form(json);
		// 			if(item.base == 'order') replaceProps(section.orderPattern, json);
  //       }
		// 		else{
		// 			this.attachments.removeOne({name: itemname});
		// 			this.attachments.push({name: itemname, size: item.size, extension: item.extension, src: '/' + this.name + '/' + itemname, date: item.modified });
		// 		}
  //     }
  //   }
		// this.sort();
  // };
  this.addData = Site.prototype.addData;
  this.addDirectory = Site.prototype.addDirectory;
  this.jsAdd = Site.prototype.jsAdd;
  this.cssAdd = Site.prototype.cssAdd;
  this.lessAdd = Site.prototype.lessAdd;
  this.txtAdd = Site.prototype.txtAdd;
  this.jpgAdd = function jpgAdd(item){
    if(item.base.toLowerCase() == 'background') {
      this.backgroundAdd(item);
    } else {
      if(this.images.removeOne({name: item.base})) this.imageCache.clear( this.getPath() + path.sep + item.name);
      this.images.push(new Image(item, this.rootpath, this.defaultImageSize, this.imageCache));
    }
  };
  this.pngAdd = this.jpgAdd;
  this.jsonAdd = function jsonAdd(item){
    try{ var json = JSON.parse(item.contents); }
    catch(e){
      console.log(e, item.base);
      return;
    }
    if(item.base == 'form') this.form = new Form(json);
    if(item.base == 'order') this.orderAdd(json);
  };
  this.orderAdd = Site.prototype.orderAdd;
  this.backgroundAdd = Site.prototype.backgroundAdd;
  this.get = Site.prototype.get;
  this.childrenList = 'items';
  this.childrenType = Item;
	this.sort = function(){
		multiSort(this);
	};
	this.remove = function(pathArray){
		if(pathArray.length == 1){
			var name = pathArray[0],
					split = name.split('.'),
					filename = split[0],
					extension = split[1];
      if(extension){
        if(extension == 'txt') {
          if(this[filename]) delete this[filename];
          else this.extraContent.removeOne({name: filename});
          if(filename == 'title') this.title = this.foldername;
        }
        else if(extension in imageTypes){
          if(filename == 'background'){
            if(fs.existsSync(this.site.path + path.sep + this.foldername + '/background.less')){
              fs.unlinkSync(this.site.path + path.sep + this.foldername + 'background.less');
            }
          }
          else {
            if(this.images.removeOne({name: filename})) this.site.imageCache.clear( this.foldername + path.sep + name);
          }
        }
        else if(extension == 'css' || extension == 'less') this.stylesheets.removeOne({name: filename});
        else if(extension == 'js'){
          this.javascripts.removeOne({name: filename});
        }
				else{
					this.attachments.removeOne({name: name});
				}
      }
      else{ //is a directory
        this.items.removeOne({foldername: name});
        this.site.imageCache.clear(this.foldername + path.sep + name);
      }
			this.site.afterUpdate('/' + this.foldername);
		}
		else{
			this.items.findOne({foldername: pathArray.shift()}).remove(pathArray);
		}
	};
	this.update = function(pathArray, file){
		console.log('section update: ', pathArray);
		if(pathArray.length > 1){
			var item = this.items.findOne({foldername: pathArray.shift()});
			if(item){
				item.update(pathArray, file);
			}
		}
		else{
      this.addData(file);
      this.site.afterUpdate('/' + this.foldername);
    }
	}
}).call(Section.prototype);

function Item(name, section, data){
  Object.defineProperty(this, 'section', { value: section });
  Object.defineProperty(this, 'parent', { value: section });
  this.rootpath = this.parent.rootpath;
	this.contents = {
		title: name,
    images: [],
    extraContent: [],
    allowResponses: false
  };
  this.orderPattern = {
    extraContent: {unassigned: 'date', assigned: []},
    images: {unassigned: 'date', assigned: []},
    stylesheets: {unassigned: 'date', assigned: []},
    javascripts: {unassigned: 'date', assigned: []}
  };
  this.defaultImageSize = this.parent.defaultImageSize;
  this.imageCache = this.parent.imageCache;
  this.title = name;
  this.images = [];
  this.extraContent = [];
  this.allowResponses = false;
  this.name = name;
	this.foldername = name;
	this.stylesheets = [];
	this.javascripts = [];
	this.attachments = [];
  this.extraContent = [];
	this.modified = data.modified;
	
	this.hidden = data.hidden;
	
  if(data && countChildren(data)) this.addData(data.children);
}
(function(){
  this.getPath = Site.prototype.getPath;
  this.getDiskPath = Site.prototype.getDiskPath;
  this.addData = Site.prototype.addData;
  this.sort = Site.prototype.sort;
  this.txtAdd = Site.prototype.txtAdd;
  this.jsAdd = Site.prototype.jsAdd;
  this.cssAdd = Site.prototype.cssAdd;
  this.lessAdd = Site.prototype.lessAdd;
  this.cssAdd = Site.prototype.cssAdd;
  this.lessAdd = Site.prototype.lessAdd;
  this.jpgAdd = Section.prototype.jpgAdd;
  this.pngAdd = this.jpgAdd;
  this.jsonAdd = function jsonAdd(item){
    try{ var json = JSON.parse(item.contents); }
    catch(e){
      console.log(e, item.base, item.contents);
      return;
    }
    if(item.base === 'order'){
      return this.orderAdd(json);
    }
    console.log('don\'t know what to do with: ' + item.base + '.json');
  };
  this.orderAdd = Site.prototype.orderAdd;
  this.backgroundAdd = Site.prototype.backgroundAdd;
  // this.addData = function(data){
		// var item = this;
  //   for(var thing in data){
  //     var part = data[thing];
  //     if(part.base.indexOf('conflicted copy') !== -1){
  //       console.log('file ignored: ' + part.base);
  //       continue;
  //     }
  //     if(part.isDirectory){
  //       if(part.base.toLowerCase() == 'responses'){
  //         this.allowResponses = true;
  //         this.responses = [];
  //       }
  //     }
  //     else{
  //       if(part.extension == 'txt'){
  //         addTextFile.call(this, part);
  //       }
  //       else if(part.extension in imageTypes){
  //         if(this.images.removeOne({name: part.base})) {
		// 				this.section.site.imageCache.clear( this.section.foldername + path.sep + this.foldername + path.sep + part.base);
		// 			}
  //         this.images.push(new Image(part, this.section.site.path, this.defaultImageSize || this.section.defaultImageSize || this.section.site.defaultImageSize, this.section.site.imageCache));
  //       }
  //       else if(part.extension == 'less' || part.extension == 'css'){
  //         this.stylesheets.removeOne({name: part.base});
  //         this.stylesheets.push({name: part.base, src: '/' + this.section.foldername + '/' + this.foldername + '/' + part.base + '.css', date: part.modified });
  //         if(part.extension == 'less'){
		// 				lessparser.parse(part.contents, function(error, tree){
		// 					if(error) return console.log(error);
		// 					var fullpath = 'content' + path.sep + item.section.foldername + path.sep + item.foldername + path.sep + part.base + '.css';
		// 					if(fs.existsSync(fullpath)) fs.unlinkSync(fullpath);
		// 					fs.writeFileSync(fullpath, tree.toCSS());
		// 				});
  //         }
  //       }
  //       else if(part.extension == 'js'){
  //         this.javascripts.removeOne({name: part.base});
  //         this.javascripts.push({name: part.base, contents: part.contents, src: '/' + this.section.foldername + '/' + this.foldername + '/' + part.base + '.js', date: part.modified });
  //       }
  //       else if(part.extension == 'json'){
		// 			try{ var json = JSON.parse(part.contents); }
		// 			catch(e){
		// 				console.log(e, part.base);
		// 				return;
		// 			}
		// 			if(part.base == 'order') replaceProps(item.orderPattern, json);
  //       }
		// 		else{
		// 			this.attachments.removeOne({name: thing});
		// 			this.attachments.push({name: thing, extension: part.extension, size: part.size, src: '/files/' + this.section.foldername + '/' + this.foldername + '/' + thing, date: part.modified });
		// 		}
  //     }
  //   }
  //   multiSort(this);
  // };
	this.remove = function(name){
		if(typeof name == 'object' && name.length == 1) name = name[0];
		var split = name.split('.'),
		    filename = split[0],
				extension = split[1];
    if(extension){ //is a file
      if(extension == 'txt') {
        removeTextFile.call(this, filename);
      }
      else if(extension in imageTypes) {
        if(this.images.removeOne({name: filename})) this.section.site.imageCache.clear( this.section.foldername + '/' + this.foldername + '/' + filename);
      }
      else if(extension == 'css' || extension == 'less'){
        this.stylesheets.removeOne({name: filename});
        var fullpath = 'content' + path.sep + this.section.foldername + path.sep + this.foldername + path.sep + filename + '.css';
        if(extension == 'less') if(fs.existsSync(fullpath)) fs.unlinkSync(fullpath);
      }
      else if(extension == 'js') this.javascripts.removeOne({name: filename});
			else{
				this.attachments.removeOne({name: name});
			}
			this.section.site.afterUpdate('/' + this.section.foldername + '/' + this.foldername);
    }
	};
	this.update = function(pathArray, file){
		if(pathArray.length == 1){
			this.addData(file);
      this.section.site.afterUpdate('/' + this.section.foldername + '/' + this.foldername);
		}
	};
  this.get = Section.prototype.get;
}).call(Item.prototype);

function createMenuFromStructure(structure){
  var menu = [];
  for(var index in structure.sections){
    menu[structure.sections[index].order] = structure.sections[index].name;
  }
  return menu
}

function replaceProps(a, b){
  for(var i in a){
    if(b[i]) a[i] = b[i];
  }
}

function Image(fileRef, basepath, size, cache){
  var image = this,
      localPath = fileRef.path.split('/');

  this.name = fileRef.base;
	this.alt = fileRef.base;
	this.base = stripPath(basepath, localPath.join('/'));
	this.modified = fileRef.modified;
  this.width = size.width;
  this.height = size.height;
  this.aspect = this.width / this.height;

  this.entry = new cache.Entry(
    stripPath(basepath, localPath.join('/')).substr(1),
    function addEntryCallback(error, img) {
      var aspect = image.entry.width / image.entry.height;
      if(error) console.log(error);

      image.width = Math.min(image.entry.width, image.width);
      image.height = Math.min(image.entry.height, image.height);

      if(aspect > image.aspect) { 
        image.height = Math.round(image.width / aspect);
      } else {
        image.width = Math.round(image.height * aspect);
      }

      image.aspect = aspect;
    }
  );
}

function addTextFile(file){
	var content = file.contents.split('\r\n').join('<br>');
	if(file.base in basicTextNames) this[file.base] = content;
	else{
		this.extraContent.removeOne({name: file.base});
		this.extraContent.push({name: file.base, content: content});
	}
  return this;
}

function removeTextFile(filename){
  if(filename in basicTextNames) delete this[filename];
  else this.extraContent.removeOne({name: filename});
  if(filename == 'title') this.title = this.foldername;
}

function stripPath(base, full){
	return full.split(base)[1];
}

function multiSort(parent){
  for(var type in parent.orderPattern){
    
    var set = parent.orderPattern[type],
        listedItems = set.assigned,
        existingItems = parent[type],
        n = 0;
    for(var item in listedItems){
      var name = listedItems[item],
          item = existingItems.findOne({name: name});
      if(item){
        item.order = n;
        n++;
      }
    }
    
    if(set.unassigned && set.unassigned.split('date').length > 1){
      var dates = [];
      for(var index in existingItems){
        if(set.assigned.indexOf(existingItems[index].name) == -1){
          dates.push({name: index, date: existingItems[index].modified});
        }
      }
      dates.sort(function(a, b){ return b.modified - a.modified; });
      if(set.unassigned.split('reverse').length > 1){
        dates.reverse();
      }
      for(var index in dates){
        existingItems[dates[index].name].order = + index + n;
      }
    }
    existingItems.sort(function(a,b){ return a.order - b.order });
  }
}

function Form(json){
  this.name = json.name;
  this.title = json.title || this.name;
  this.fields = json.fields;
  this.submitText = json.submitText;
  this.completeText = json.completeText;
}

exports.Site = Site;
