var watch = require("watchr").watch,
    fs = require("fs"),
    imgMagick = require("imagemagick"),
		less = require("less"),
		lessparser = less.Parser({ optimization: 1 }),
		config = require("./config.json"),
    ImageCache = require('./imageCacher.js').ImageCache,
    fileUtils = require('./fileUtils.js'),
		getFolderContents = fileUtils.getFolderContents,
		getFile = fileUtils.getFile,
    validatePath = fileUtils.validatePath,
		imageTypes = {
			'jpg': 'image/jpg',
			'gif': 'image/gif',
			'png': 'iamge/png'
		},
    basicTextNames = {
      title: true,
      subtitle: true,
      introduction: true,
      body: true,
      footer: true
    },
    reservedFolderNames = {
      FormResponses: true
    }
;

function redefine(site, eventName, filePath){
	  var pathArray = stripPath(site.path + '/', filePath).split('/');
    
		if(eventName == 'unlink' || eventName == 'delete'){
			if(pathArray.length == 1) site.remove(pathArray[0]);
			else site.sections.findOne({foldername: pathArray.shift()}).remove(pathArray);
		}
		else {
			fs.stat(filePath, function(err, stats){
        if(stats.isDirectory()) getFolderContents(filePath, function(err, contents){
					console.log('folder updated', contents);
				});
				else{
					getFile(filePath, function(err, file){
						if(err) console.log(err);
						else{
							var fileContainer = {};
							fileContainer[file.name] = file;
							console.log(filePath, pathArray, fileContainer[file.name]);
							site.update(pathArray, fileContainer);
						}
					});
				}
			});
			if(0) fmap({path: filePath, recursive: true}, function(error, file){
			  if(error) console.log('error: ', error);
			  else{
				  var filename = file.base,
						  fileContainer = {};
				  if(file.isDirectory) filename += '.' + file.extension;
				  fileContainer[filename] = enrichDiskData(file);
				  site.update(pathArray, fileContainer);
			  }
		  });
		}
	}

function Site(name, path){
	var site = this;
	watch({path: path, listener: function(eventName, filePath, currentStat, previousStat){
    console.log(eventName, filePath);
    redefine(site, eventName, filePath);
	}});
	console.log(path);
  getFolderContents(path, function(err, map){
		if(!err) site.diskdata = map;
		if(countChildren(site.diskdata)) {
			site.addData(site.diskdata);
			site.header.menu = createMenuFromStructure(site);
		}
	});
  this.sections = [];
  this.path = path;
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
  
  this.liveViewers = [];
  
  this.defaultImageSize = {width: 500, height: 500};
  this.imageCache = new ImageCache(config.imageCacheLimit);
  
  this.header.menu = createMenuFromStructure(this);
}
(function(){
  this.addData = function(diskdata){
		var site = this,
        noChildren = true;
    for(var name in diskdata){
      var file = diskdata[name];
      if(name.indexOf('conflicted copy') !== -1){
        console.log('file ignored: ' + file.base);
        continue;
      }
      if(file.isDirectory){
				console.log('directory: ', file);
        if(!(file.base in reservedFolderNames)) this.sections.push(new Section(file.base, this, file));
      }
      else{
        if(file.extension in imageTypes){
					if(file.base.toLowerCase() == 'logo') {
						this.header.logo = '/images/' + stripPath(this.path, file.path);
            console.log('logo: ', this.header.logo);
					}
					if(file.base.toLowerCase() == 'background') {
						this.background = stripPath(this.path, file.path);
            if(fs.existsSync('content/style.css')) fs.unlinkSync('content/style.css');
						fs.writeFile('content/background.less', 'html{min-height:100%;}body{min-height:100%;background: url(/images/' + stripPath(this.path, file.path) + ') no-repeat' + (config.backgroundColor ? ' ' + config.backgroundColor : '') + ';background-size:cover;}')
					}
				}
				else if(file.extension == 'less' || file.extension == 'css'){
          console.log('stylesheet found: ' + file.base + ', type: ' + file.extension);
					this.stylesheets.removeOne({name: file.base});
					this.stylesheets.push({src: '/stylesheets/' + file.base + '.css', name: file.base, date: file.modified });
					if(file.extension == 'less'){
						console.log(file, 'tang!!!!!');
						lessparser.parse(file.contents, function(error, tree){
							if(error) return console.log(error);
							if(fs.existsSync('content/' + file.base + '.css')) fs.unlinkSync('content/' + file.base + '.css');
							fs.writeFileSync('content/' + file.base + '.css', tree.toCSS());
						});
					}
				}
				else if(file.extension == 'js'){
					this.javascripts.removeOne({name: file.base});
					this.javascripts.push({src: '/javascripts/' + file.base + '.js', name: file.base, date: file.modified});
				}
				else if(file.extension == 'txt'){
					var content = file.contents.split("\r\n").join('<br>');
          if(file.base in basicTextNames) {
						if(file.base == 'title' || file.base == 'subtitle') site.header[file.base] = content;
						else site[file.base] = content;
					}
          else{
						site.extraContent.push({name: file.base, content: content});
          }
				}
        else if(file.extension == 'ico'){
          console.log('ico file encountered: ' + file.base);
        }
        else if(file.extension == 'json'){
					try{
						var object = JSON.parse(file.contents);
					}
					catch(e){
						console.log(file.base, e);
					}
					switch(file.base){
						case 'authentication':  site.authInfo = object; break;
						case 'imageSizes': site.defaultImageSize = object; break;
						case 'order': replaceProps(site.orderPattern, object); break;
					}
        }
      }
			noChildren = false;
    }
    validatePath('public', 'css', function(){
      if(!site.background) fs.writeFileSync('public/css/background.less', '');
		  if(!site.header.logo) fs.writeFileSync('public/css/logo.less', '');    
    });
		if(noChildren) setTimeout(function(){
			var path = config.contentpath + config.homesection;
			console.log('creating ' + path);
			fs.mkdirSync(path)
		}, 500)
		this.sort();
  };
	this.sort = function(){
		multiSort(this);
	}
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
            if(fs.existsSync('content/' + filename + '.css')) fs.unlinkSync('content/' + filename + '.css');
          }
        }
        else if(extension == 'js') this.javascripts.removeOne({name: filename});
      }
      else{
        if(fs.existsSync('content/' + filename + '.less')) fs.unlinkSync('content/' + filename + '.less');
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
      else console.log('unknown section: ', pathArray);
		}
		else{
			this.addData(file);
			this.header.menu = createMenuFromStructure(this);
      
      this.afterUpdate('/');
		}
	}
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
	
  if(data && countChildren(data)) this.addData(data.children);
}
(function(){
  this.addData = function(data){
		var section = this;
    for(var itemname in data){
      var item = data[itemname];
			
      if(item.base.indexOf('conflicted copy') !== -1){
        console.log('file ignored: ' + item.base);
        continue;
      }
      if(item.isDirectory){
        this.items.push(new Item(item.base, this, item));
      }
      else{
        if(item.extension in imageTypes){
          if(item.base.toLowerCase() == 'background') {
            
						fs.writeFileSync(
              this.site.path + '/' + this.foldername + '/background.less',
              'html{min-height:100%;}body{min-height:100%;background: url(/images/' + stripPath(this.site.path, item.path) + ') no-repeat' + (config.backgroundColor ? ' ' + config.backgroundColor : '') + ';background-size:cover;}'
            )
					}
          else{
            if(this.images.removeOne({name: item.base})) this.site.imageCache.clear( this.foldername + '/' + itemname);
            this.images.push(new Image(item, this.site.path, this.site.defaultImageSize));
          }
        }
				else if(item.extension == 'less' || item.extension == 'css'){
          this.stylesheets.removeOne({name: item.base});
					this.stylesheets.push({name: item.base, src: '/stylesheets/' + this.name + '/' + item.base + '.css', date: item.modified });
					if(item.extension == 'less'){
						lessparser.parse(item.contents, function(error, tree){
							if(error) return console.log(error);
							var fullpath = 'content/' + section.foldername + '/' + item.base + '.css';
							if(fs.existsSync(fullpath)) fs.unlinkSync(fullpath);
							fs.writeFileSync(fullpath, tree.toCSS());
						});
					}
				}
				else if(item.extension == 'js'){
          this.javascripts.removeOne({name: item.base});
					this.javascripts.push({name: item.base, src: '/javascripts/' + this.name + '/' + item.base + '.js', date: item.modified });
				}
				else if(item.extension == 'txt'){
					var content = item.contents.split('\r\n').join('<br>');
					if(item.base in basicTextNames) section[item.base] = content;
					else{
						section.extraContent.removeOne({name: item.base});
						section.extraContent.push({name: item.base, content: content});
					}
        }
        else if(item.extension == 'json'){
					try{ var json = JSON.parse(item.contents); }
					catch(e){
						console.log(e, item.base);
						return;
					}
					if(item.base == 'form') section.form = new Form(json);
					if(item.base == 'order') replaceProps(section.orderPattern, json);
        }
				else{
					this.attachments.removeOne({name: itemname});
					this.attachments.push({name: itemname, size: item.size, extension: item.extension, src: '/files/' + this.name + '/' + itemname, date: item.modified });
				}
      }
    }
		this.sort();
  };
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
            if(fs.existsSync(this.site.path + '/' + this.foldername + '/background.less')){
              fs.unlinkSync(this.site.path + + '/' + this.foldername + 'background.less');
            }
          }
          else {
            if(this.images.removeOne({name: filename})) this.site.imageCache.clear( this.foldername + '/' + name);
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
        this.site.imageCache.clear(this.foldername + '/' + name);
      }
			this.site.afterUpdate('/' + this.foldername);
		}
		else{
			this.items.findOne({foldername: pathArray.shift()}).remove(pathArray);
		}
	}
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
  Object.defineProperty(this, 'section', {value: section});
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
  if(data && countChildren(data)) this.addData(data.children);
}
(function(){
  this.addData = function(data){
		var item = this;
    for(var thing in data){
      var part = data[thing];
      if(part.base.indexOf('conflicted copy') !== -1){
        console.log('file ignored: ' + part.base);
        continue;
      }
      if(part.isDirectory){
        if(part.base.toLowerCase() == 'responses'){
          this.allowResponses = true;
          this.responses = [];
        }
      }
      else{
        if(part.extension == 'txt'){
          addTextFile.call(this, part);
        }
        else if(part.extension in imageTypes){
          if(this.images.removeOne({name: part.base})) {
						this.section.site.imageCache.clear( this.section.foldername + '/' + this.foldername + '/' + part.base);
					}
          this.images.push(new Image(part, this.section.site.path, this.defaultImageSize || this.section.defaultImageSize || this.section.site.defaultImageSize));
        }
        else if(part.extension == 'less' || part.extension == 'css'){
          this.stylesheets.push({name: part.base, src: '/stylesheets/' + this.section.foldername + '/' + this.foldername + '/' + part.base + '.css', date: part.modified });
          if(part.extension == 'less'){
						lessparser.parse(part.contents, function(error, tree){
							if(error) return console.log(error);
							var fullpath = 'content/' + item.section.foldername + '/' + item.foldername + '/' + part.base + '.css';
							if(fs.existsSync(fullpath)) fs.unlinkSync(fullpath);
							fs.writeFileSync(fullpath, tree.toCSS());
						});
          }
        }
        else if(part.extension == 'js'){
          this.javascripts.removeOne({name: part.base});
          this.javascripts.push({name: part.base, src: '/javascripts/' + this.section.foldername + '/' + this.foldername + '/' + part.base + '.js', date: part.modified });
        }
        else if(part.extension == 'json'){
					try{ var json = JSON.parse(part.contents); }
					catch(e){
						console.log(e, part.base);
						return;
					}
					if(part.base == 'order') replaceProps(item.orderPattern, json);
        }
				else{
					this.attachments.removeOne({name: thing});
					this.attachments.push({name: thing, extension: part.extension, size: part.size, src: '/files/' + this.section.foldername + '/' + this.foldername + '/' + thing, date: part.modified });
				}
      }
    }
    multiSort(this);
  };
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
        var fullpath = 'content/' + this.section.foldername + '/' + this.foldername + '/' + filename + '.css';
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
	}
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

function Image(fileRef, basepath, size){
  var path = fileRef.path.split('/');
  path.splice(path.length - 1, 1, fileRef.base);
  this.name = fileRef.base;
	this.alt = fileRef.base;
	this.base = '/images/' + stripPath(basepath, path.join('/'));
  this.ext = fileRef.extension;
	this.modified = fileRef.modified;
  this.width = size.width;
  this.height = size.height;
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
        existingItems[dates[index].name].order = +index + n;
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
