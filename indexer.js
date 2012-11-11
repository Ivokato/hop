var foldermap = require("foldermap"),
    watch = require("watchr").watch,
    fmap = foldermap.map,
    fmapSync = foldermap.mapSync,
    fs = require("fs"),
		less = require("less"),
		lessparser = less.Parser({ optimization: 1 }),
		imageTypes = {
			'jpg': 'image/jpg',
			'gif': 'image/gif',
			'png': 'iamge/png'
		};

function redefine(site, eventName, filePath){
	  var pathArray = stripPath(site.path, filePath).split('/');
		if(eventName == 'unlink'){
			if(pathArray.length == 1) site.remove(pathArray[0]);
			else site.sections.findOne({foldername: pathArray.shift()}).remove(pathArray);
		}
		else fmap({path: filePath, recursive: true}, function(error, file){
			if(error) console.log(error);
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
  console.log(diskdata);
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
	this.order = {sections: 'date', stylesheets: 'date', javascripts: 'date'};
  this.menu = {};
	this.header = {};
	this.stylesheets = [];
  this.javascripts = [];
	
  if(this.diskdata && countChildren(this.diskdata)) this.addData(this.diskdata);
  
  this.header.menu = createMenuFromStructure(this);
}
(function(){
  this.addData = function(diskdata){
    for(var name in diskdata){
      var file = diskdata[name];
      if(file._type == 'directory') this.sections.push(new Section(name, this, file));
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
				else if(file._ext == 'less' || file._ext == 'css'){
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
					if(file._base == 'order'){
						if(file._content.split('date').length > 1){
							
						}
					}
				}
      }
    }
		if(!this.background) fs.writeFileSync('public/css/background.less', '');
		if(!this.header.logo) fs.writeFileSync('public/css/logo.less', '');
		this.sort();
  };
	this.sort = function(){
		for(var type in this.order){
			if(this.order[type].split('date').length > 1){
				var dates = [];
				for(var index in this[type]){
					dates.push({name: index, date: this[type][index].date});
				}
				dates.sort(function(a, b){ return b.date > a.date ? -1 : 1 });
				if(this.order[type].split('reverse').length > 1){
					dates.reverse();
				}
				for(var index in dates){
					this[type][dates[index].name].order = index;
				}
				this[type].sort(function(a,b){ return a.order > b.order ? -1 : 1 });
			}
		}
	}
	this.remove = function(name){
		if(name.split('.').length == 1) {
      console.log('......folder.remove.......\n', name);
			this.sections.removeOne({foldername: name});
		}
		else{
			var split = name.split('.'),
					filename = split[0],
					extension = split[1];
			if(extension == 'txt') delete this.contents[filename];
			else if(extension in imageTypes) delete this.contents.images[filename];
			else if(extension == 'css' || extension == 'less') this.stylesheets.removeOne({name: filename});
			else if(extension == 'js') this.javascripts.removeOne({name: filename});
		}
	};
	this.update = function(pathArray, file){
		if(pathArray.length > 1){
			var section = this.sections.findOne({foldername: pathArray.shift()});
			//var section = this.sections[pathArray.shift()];
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
	this.name = name;
	this.foldername = name;
  this.title = name;
	Object.defineProperty(this, 'site', {value: site});
	this.order = {items: 'date', images: 'date', stylesheets: 'date', javascripts: 'date'};
  this.items = [];
  this.images = [];
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
      if(item._type == 'directory') this.items.push(new Item(itemname, this, item));
      else{
        if(item._ext in imageTypes){
          this.images.push(new Image(item, this.site.path));
        }
				else if(item._ext == 'less' || item._ext == 'css'){
					this.stylesheets.push({src: '/stylesheets/' + this.name + '/' + item._base + '.css', date: item.date });
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
					this.javascripts.push({name: item._base, src: '/javascripts/' + this.name + '/' + item._base + '.js', date: item.date });
				}
				else if(item._ext == 'txt'){
					if(item._base == 'body') this.body = item._content;
					if(item._base == 'introduction') this.introduction = item._content;
					if(item._base == 'title') this.title = item._content;
					if(item._base == 'footer') this.footer = item._content;
				}
      }
    }
		this.sort();
  };
	this.sort = function(){
		for(var type in this.order){
			if(this.order[type].split('date').length > 1){
				var dates = [];
				for(var index in this[type]){
					dates.push({name: index, date: this[type][index].date});
				}
				dates.sort(function(a, b){ return b.date > a.date ? -1 : 1 });
				if(this.order[type].split('reverse').length > 1){
					dates.reverse();
				}
				for(var index in dates){
					this[type][dates[index].name].order = index;
				}
				this[type].sort(function(a,b){ return a.order > b.order ? -1 : 1 });
			}
		}
	}
	this.remove = function(pathArray){
		if(pathArray.length == 1){
			var name = pathArray[0],
					split = name.split('.'),
					filename = split[0],
					extension = split[1];
      if(extension){
        if(extension == 'txt') {
          delete this[filename];
          if(filename == 'title') this.title = this.foldername;
        }
        else if(extension in imageTypes) delete this.images.removeOne({name: filename});
        else if(extension == 'css' || extension == 'less') this.stylesheets.removeOne({name: filename});
        else if(extension == 'js'){
          this.javascripts.removeOne({name: filename});
        }
      }
      else{ //is a directory
        console.log('-----------------------');
        console.log('foldername: ', name);
        console.log(this.items);
        console.log('-----------------------');
        this.items.removeOne({foldername: name});
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
		else this.addData(file);
	}
}).call(Section.prototype);

function Item(name, section, data){
  Object.defineProperty(this, 'section', {value: section});
	this.contents = {
		title: name,
    images: []
  };
	this.foldername = name;
	this.stylesheets = [];
	this.javascripts = [];
	this.date = data.date;
  if(data && countChildren(data)) this.addData(data);
}
(function(){
  this.addData = function(data){
		var item = this;
    for(var thing in data){
      var part = data[thing];
      if(part._ext == 'txt') this.contents[part._base] = part._content;
      else{
				if(part._ext in imageTypes){
					this.contents.images.push(new Image(part, this.section.site.path));
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
					this.javascripts.push({name: part._base, src: '/javascripts/' + this.section.foldername + '/' + this.foldername + '/' + part._base + '.js', date: part.date });
				}
			}
    }
  };
	this.remove = function(name){
		if(typeof name == 'object' && name.length == 1) name = name[0];
		var split = name.split('.'),
		    filename = split[0],
				extension = split[1];
    if(extension){ //is a file
      if(extension == 'txt') {
        delete this.contents[filename];
        if(filename == 'title') this.title = this.foldername;
      }
      else if(extension in imageTypes) {
        this.contents.images.removeOne({name: filename});
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

function Image(fileRef, basepath){
  this.name = fileRef._base;
	this.alt = fileRef._base;
	this.src = '/images/' + stripPath(basepath, fileRef._path);
	this.date = fileRef.date;
}

function stripPath(base, full){
	return full.split(base)[1];
}

exports.Site = Site;