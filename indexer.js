var foldermap = require("foldermap"),
    watch = require("watchr").watch,
    fmap = foldermap.map,
    fmapSync = foldermap.mapSync,
    fs = require("fs"),
    imgMagick = require("imagemagick"),
		less = require("less"),
		lessparser = less.Parser({ optimization: 1 }),
		config = require("./config.json"),
    ImageCache = require('./imageCacher.js').ImageCache,
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
	  var pathArray = stripPath(site.path, filePath).split('/');
    
		if(eventName == 'unlink' || eventName == 'delete'){
			if(pathArray.length == 1) site.remove(pathArray[0]);
			else site.sections.findOne({foldername: pathArray.shift()}).remove(pathArray);
		}
		else fmap({path: filePath, recursive: true}, function(error, file){
			if(error) console.log('error: ', error);
			else{
				var filename = file._base,
						fileContainer = {};
				if(file._type !== 'directory') filename += '.' + file._ext;
				fileContainer[filename] = enrichDiskData(file);
				site.update(pathArray, fileContainer);
			}
		});
	}

function enrichDiskData(diskdata){
	for(var index in diskdata){
		var file = diskdata[index];
		Object.defineProperty(file, 'date', {value: fs.statSync(file._path).mtime});
    if(file._type == 'directory') enrichDiskData(file);
	}
	return diskdata;
}

function Site(name, path){
	var site = this;
	watch({path: path, listener: function(eventName, filePath, currentStat, previousStat){
    console.log(eventName, filePath);
    redefine(site, eventName, filePath);
	}});
	
  this.diskdata = enrichDiskData(fmapSync({path: path, recursive: true}));
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
  
  if(this.diskdata && countChildren(this.diskdata)) this.addData(this.diskdata);
  
  this.header.menu = createMenuFromStructure(this);
}
(function(){
  this.addData = function(diskdata){
		var noChildren = true;
    for(var name in diskdata){
      var file = diskdata[name];
      if(file._base.indexOf('conflicted copy') !== -1){
        console.log('file ignored: ' + file._base);
        continue;
      }
      if(file._type == 'directory'){
        if(!(file._base in reservedFolderNames)) this.sections.push(new Section(name, this, file));
      }
      else{
        if(file._ext in imageTypes){
					if(file._base.toLowerCase() == 'logo') {
						this.header.logo = '/images/' + stripPath(this.path, file._path);
            console.log('logo: ', this.header.logo);
					}
					if(file._base.toLowerCase() == 'background') {
						this.background = stripPath(this.path, file._path);
            if(fs.existsSync('content/style.css')) fs.unlinkSync('content/style.css');
						fs.writeFile('content/background.less', 'html{min-height:100%;}body{min-height:100%;background: url(/images/' + stripPath(this.path, file._path) + ') no-repeat' + (config.backgroundColor ? ' ' + config.backgroundColor : '') + ';background-size:cover;}')
					}
				}
				else if(file._ext == 'less' || file._ext == 'css'){
          console.log('stylesheet found: ' + file._base + ', type: ' + file._ext);
					this.stylesheets.removeOne({name: file._base});
					this.stylesheets.push({src: '/stylesheets/' + file._base + '.css', name: file._base, date: file.date });
					if(file._ext == 'less'){
						lessparser.parse(file._content, function(error, tree){
							if(error) return console.log(error);
							if(fs.existsSync('content/' + file._base + '.css')) fs.unlinkSync('content/' + file._base + '.css');
							fs.writeFileSync('content/' + file._base + '.css', tree.toCSS());
						});
					}
				}
				else if(file._ext == 'js'){
					this.javascripts.removeOne({name: file._base});
					this.javascripts.push({src: '/javascripts/' + file._base + '.js', name: file._base, date: file.date});
				}
				else if(file._ext == 'txt'){
          if(file._base in basicTextNames) {
						var content = file._content.split("\r\n").join('<br>');
						if(file._base == 'title' || file._base == 'subtitle') this.header[file._base] = content;
						else this[file._base] = content;
					}
					else if(file._base == 'order'){
						if(file._content.split('date').length > 1){
              
						}
					}
          else{
            this.extraContent.push({name: file._base, content: file._content});
          }
				}
        else if(file._ext == 'ico'){
          console.log('ico file encountered: ' + file._base);
        }
        else if(file._ext == 'json'){
          try{
            var object = JSON.parse(file._content);
          }
          catch(e){
            console.log(file._base, e);
          }
					switch(file._base){
            case 'authentication':  this.authInfo = object; break;
            case 'imageSizes': this.defaultImageSize = object; break;
            case 'order': replaceProps(this.orderPattern, object); break;
          }
        }
      }
			noChildren = false;
    }
		if(!this.background) fs.writeFileSync('public/css/background.less', '');
		if(!this.header.logo) fs.writeFileSync('public/css/logo.less', '');
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
	this.date = data.date;
	
  if(data && countChildren(data)) this.addData(data);
}
(function(){
  this.addData = function(data){
		var section = this;
    for(var itemname in data){
      var item = data[itemname];
      if(item._base.indexOf('conflicted copy') !== -1){
        console.log('file ignored: ' + item._base);
        continue;
      }
      if(item._type == 'directory'){
        this.items.push(new Item(itemname, this, item));
      }
      else{
        if(item._ext in imageTypes){
          if(item._base.toLowerCase() == 'background') {
            
						fs.writeFileSync(
              this.site.path + this.foldername + '/background.less',
              'html{min-height:100%;}body{min-height:100%;background: url(/images/' + stripPath(this.site.path, item._path) + ') no-repeat' + (config.backgroundColor ? ' ' + config.backgroundColor : '') + ';background-size:cover;}'
            )
					}
          else{
            if(this.images.removeOne({name: item._base})) this.site.imageCache.clear( this.foldername + '/' + item._name);
            this.images.push(new Image(item, this.site.path, this.site.defaultImageSize));
          }
        }
				else if(item._ext == 'less' || item._ext == 'css'){
          this.stylesheets.removeOne({name: item._base});
					this.stylesheets.push({name: item._base, src: '/stylesheets/' + this.name + '/' + item._base + '.css', date: item.date });
					if(item._ext == 'less'){
						lessparser.parse(item._content, function(error, tree){
							if(error) return console.log(error);
							var fullpath = 'content/' + section.foldername + '/' + item._base + '.css';
							if(fs.existsSync(fullpath)) fs.unlinkSync(fullpath);
							fs.writeFileSync(fullpath, tree.toCSS());
						});
					}
				}
				else if(item._ext == 'js'){
          this.javascripts.removeOne({name: item._base});
					this.javascripts.push({name: item._base, src: '/javascripts/' + this.name + '/' + item._base + '.js', date: item.date });
				}
				else if(item._ext == 'txt'){
					var content = item._content.split('\r\n').join('<br>');
          if(item._base in basicTextNames) this[item._base] = content;
          else{
            this.extraContent.removeOne({name: item._base});
            this.extraContent.push({name: item._base, content: content});
          }
        }
        else if(item._ext == 'json'){
          try{ var json = JSON.parse(item._content); }
          catch(e){
            console.log(e, item._base);
            return;
          }
          if(item._base == 'form') this.form = new Form(json);
          if(item._base == 'order') replaceProps(this.orderPattern, json);
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
            if(fs.existsSync(this.site.path + this.foldername + '/background.less')){
              fs.unlinkSync(this.site.path + this.foldername + 'background.less');
            }
          }
          else {
            if(this.images.removeOne({name: filename})) this.site.imageCache.clear( this.foldername + '/' + filename);
          }
        }
        else if(extension == 'css' || extension == 'less') this.stylesheets.removeOne({name: filename});
        else if(extension == 'js'){
          this.javascripts.removeOne({name: filename});
        }
      }
      else{ //is a directory
        this.items.removeOne({foldername: name});
        this.site.imageCache.clear(this.foldername + '/' + name);
      }
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
  this.extraContent = [];
	this.date = data.date;
  if(data && countChildren(data)) this.addData(data);
}
(function(){
  this.addData = function(data){
		var item = this;
    for(var thing in data){
      var part = data[thing];
      if(part._base.indexOf('conflicted copy') !== -1){
        console.log('file ignored: ' + part._base);
        continue;
      }
      if(part._type == 'directory'){
        if(part._base.toLowerCase() == 'responses'){
          this.allowResponses = true;
          this.responses = [];
        }
      }
      else{
        if(part._ext == 'txt'){
          addTextFile.call(this, part);
        }
        else if(part._ext in imageTypes){
          //if(this.contents.images.indexOf()) TODO image cache clearing when existing. and prevent doubles
          if(this.images.removeOne({name: part._base})) this.section.site.imageCache.clear( this.section.foldername + '/' + this.foldername + '/' + part._base);
          this.images.push(new Image(part, this.section.site.path, this.defaultImageSize || this.section.defaultImageSize || this.section.site.defaultImageSize));
        }
        else if(part._ext == 'less' || part._ext == 'css'){
          this.stylesheets.push({name: part._base, src: '/stylesheets/' + this.section.foldername + '/' + this.foldername + '/' + part._base + '.css', date: part.date });
          if(part._ext == 'less'){
            lessparser.parse(part._content, function(error, tree){
              if(error) return console.log(error);
              var fullpath = 'content/' + item.section.foldername + '/' + item.foldername + '/' + part._base + '.css';
              if(fs.existsSync(fullpath)) fs.unlinkSync(fullpath);
              fs.writeFileSync(fullpath, tree.toCSS());
            });
          }
        }
        else if(part._ext == 'js'){
          this.javascripts.removeOne({name: part._base});
          this.javascripts.push({name: part._base, src: '/javascripts/' + this.section.foldername + '/' + this.foldername + '/' + part._base + '.js', date: part.date });
        }
        else if(part._ext == 'json'){
          try{ var json = JSON.parse(part._content); }
          catch(e){
            console.log(e, part._base);
            return;
          }
          if(part._base == 'order') replaceProps(this.orderPattern, json);
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
  var path = fileRef._path.split('/');
  path.splice(path.length - 1, 1, fileRef._base);
  this.name = fileRef._base;
	this.alt = fileRef._base;
	this.base = '/images/' + stripPath(basepath, path.join('/'));
  this.ext = fileRef._ext;
	this.date = fileRef.date;
  this.width = size.width;
  this.height = size.height;
}

function addTextFile(file){
	var content = file._content.split('\r\n').join('<br>');
  if(file._base in basicTextNames) this[file._base] = content;
  else{
    this.extraContent.removeOne({name: file._base});
    this.extraContent.push({name: file._base, content: content});
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
          dates.push({name: index, date: existingItems[index].date});
        }
      }
      dates.sort(function(a, b){ return b.date - a.date; });
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