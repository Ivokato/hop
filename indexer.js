var foldermap = require("foldermap"),
    watch = require("watchr").watch,
    fmap = foldermap.map,
    fmapSync = foldermap.mapSync,
    fs = require("fs"),
		imageTypes = {
			'jpg': 'image/jpg',
			'gif': 'image/gif',
			'png': 'iamge/png'
		};

function redefine(site, eventName, filePath){
	  var pathArray = stripPath(site.path, filePath).split('/');
		if(eventName == 'unlink'){
			if(pathArray.length == 1) site.remove(pathArray[0]);
			else site.sections[pathArray.shift()].remove(pathArray);
		}
		else fmap({path: filePath, recursive: true}, function(error, file){
			if(error) console.log(error);
			else{
				var filename = file._base,
						fileContainer = {};
				if(file._type !== 'directory') filename += '.' + file._ext;
				fileContainer[filename] = file;
				site.update(pathArray, fileContainer);
			}
		});
	}

function Site(name, path){
	var site = this;
	watch({path: path, listener: function(eventName, filePath, currentStat, previousStat){
		redefine(site, eventName, filePath);
	}});
	
  this.diskdata = fmapSync({path: path, recursive: true});
  this.sections = {};
  this.path = path;
  this.menu = {};
	this.header = {};
  
  if(this.diskdata && countChildren(this.diskdata)) this.addData(this.diskdata);
  
  this.header.menu = createMenuFromStructure(this);
}
(function(){
  this.addData = function(diskdata){
    for(var name in diskdata){
      var file = diskdata[name];
      if(file._type == 'directory') this.sections[name] = new Section(name, this, file);
      else{
        if(file._ext in imageTypes){
					if(file._base.toLowerCase() == 'logo') {
						this.header.logo = stripPath(this.path, file._path);
						fs.writeFileSync('public/css/logo.less', '#logo{background-image: url(/images/' + this.header.logo + ');}');
						if(fs.existsSync('public/css/style.css')) fs.unlinkSync('public/css/style.css');
					}
					if(file._base.toLowerCase() == 'background') {
						this.background = stripPath(this.path, file._path);
						fs.writeFileSync('public/css/background.less', 'body{background-image: url(/images/' + this.background + ');}')
						if(fs.existsSync('public/css/style.css')) fs.unlinkSync('public/css/style.css');
					}
				}
      }
    }
		if(!this.background) fs.writeFileSync('public/css/background.less', '');
		if(!this.header.logo) fs.writeFileSync('public/css/logo.less', '');
  };
	this.remove = function(name){
		if(name.split('.').length == 1 && this.sections[name]) delete this.sections[name];
		else{
			console.log('file changed but not implemented: ', name);
		}
	};
	this.update = function(pathArray, file){
		console.log('site update: ', pathArray);
		if(pathArray.length > 1){
			var section = this.sections[pathArray.shift()];
       if(section){
         section.update(pathArray, file);
       }
		}
		else{
			this.addData(file);
			this.header.menu = createMenuFromStructure(this);
		}
	}
}).call(Site.prototype);

function Section(name, site, data){
  this.title = name;
	Object.defineProperty(this, 'site', {value: site});
  this.items = {};
  this.images = [];
  if(data && countChildren(data)) this.addData(data);
}
(function(){
  this.addData = function(data){
    for(var itemname in data){
      var item = data[itemname];
      if(item._type == 'directory') this.items[itemname] = new Item(itemname, this.site, item);
      else{
        if(item._ext in imageTypes){
          this.images.push(new Image(item, this.site.path));
        }
      }
      
    }
  };
	this.remove = function(pathArray){
		if(pathArray.length == 1) console.log('section item removed but not implemented: ', pathArray[0]);
		else{
			if(this.items[pathArray[0]]) this.items[pathArray.shift()].remove(pathArray);
		}
	}
	this.update = function(pathArray, file){
		console.log('section update: ', pathArray);
		if(pathArray.length > 1){
			console.log('this.items: ', this.items);
			console.log('the limiter');
			var item = this.items[pathArray.shift()];
			console.log('item: ', item, ', file: ', file);
			if(item){
				item.update(pathArray, file);
			}
		}
		else this.addData(file);
	}
}).call(Section.prototype);

function Item(name, site, data){
  Object.defineProperty(this, 'site', {value: site});
	this.contents = {
    images: {}
  };
  if(data && countChildren(data)) this.addData(data);
}
(function(){
  this.addData = function(data){
    for(var thing in data){
      var part = data[thing];
      if(part._ext == 'txt') this.contents[part._base] = part._content;
      else{
				if(part._ext in imageTypes){
					this.contents.images[part._base] = new Image(part, this.site.path);
				}
			}
    }
  };
	this.remove = function(name){
		if(typeof name == 'object' && name.length == 1) name = name[0];
		var split = name.split('.'),
		    filename = split[0],
				extension = split[1];
		if(extension == 'txt') delete this.contents[filename];
		else if(extension in imageTypes) delete this.contents.images[filename];
		else console.log('unknown type encountered: ', name);
	};
	this.update = function(pathArray, file){
		if(pathArray.length == 1){
			this.addData(file);
		}
	}
}).call(Item.prototype);

function createMenuFromStructure(structure){
  var menu = [];
  for(var index in structure.sections){
    menu.push(index);
  }
  return menu
}

function Image(fileRef, basepath){
	this.alt = fileRef._base;
	this.src = '/images/' + stripPath(basepath, fileRef._path);
}

function stripPath(base, full){
	return full.split(base)[1];
}

function countChildren(obj){
  var t = 0;
  for(var i in obj) t++;
  return t;
}

exports.Site = Site;