var foldermap = require("foldermap"),
    watch = require("watchr").watch,
    fmap = foldermap.map,
    fmapSync = foldermap.mapSync,
    fs = require("fs"),
		less = require("less"),
		lessparser = less.Parser({ optimization: 1 }),
		config = require("./config.json"),
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
    //if(filePath.indexOf('conflicted copy') !== -1){
      console.log(eventName, filePath);
      redefine(site, eventName, filePath);
    //}
    //else console.log('aborting ' + eventName + ' for ' + filePath, filePath.indexOf('conflicted copy'));
	}});
	
  this.diskdata = enrichDiskData(fmapSync({path: path, recursive: true}));
  this.sections = [];
  this.path = path;
	this.order = {sections: 'date', stylesheets: 'date', javascripts: 'date'};
  this.menu = {};
	this.header = {};
	this.stylesheets = [];
  this.javascripts = [];
  this.extraContent = [];

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
						this.header.logo = stripPath(this.path, file._path);
            if(fs.existsSync('content/logo.css')) fs.unlinkSync('content/logo.css');
						fs.writeFileSync('content/logo.less', '#logo{background-image: url(/images/' + this.header.logo + ');}');
					}
					if(file._base.toLowerCase() == 'background') {
						this.background = stripPath(this.path, file._path);
            if(fs.existsSync('content/style.css')) fs.unlinkSync('content/style.css');
						fs.writeFileSync('content/background.less', 'body{background-image: url(/images/' + this.background + ');}')
					}
				}
				else if(file._ext == 'less' || file._ext == 'css'){
          console.log(file._base);
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
			this.sections.removeOne({foldername: name});
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
      if(item._type == 'directory') this.items.push(new Item(itemname, this, item));
      else{
        if(item._ext in imageTypes){
          this.images.push(new Image(item, this.site.path));
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
          var json = JSON.parse(item._content);
          if(item._base == 'form') this.form = new Form(json);
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
          if(this[filename]) delete this[filename];
          else this.extraContent.removeOne({name: filename});
          if(filename == 'title') this.title = this.foldername;
        }
        else if(extension in imageTypes) delete this.images.removeOne({name: filename});
        else if(extension == 'css' || extension == 'less') this.stylesheets.removeOne({name: filename});
        else if(extension == 'js'){
          this.javascripts.removeOne({name: filename});
        }
      }
      else{ //is a directory
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
    images: [],
    extraContent: [],
    allowResponses: false
  };
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
          this.contents.allowResponses = true;
          this.contents.responses = [];
        }
      }
      else{
        if(part._ext == 'txt'){
          addTextFile.call(this.contents, part);
        }
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
    }
  };
	this.remove = function(name){
		if(typeof name == 'object' && name.length == 1) name = name[0];
		var split = name.split('.'),
		    filename = split[0],
				extension = split[1];
    if(extension){ //is a file
      if(extension == 'txt') {
        removeTextFile.call(this.contents, filename);
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

function Form(json){
  this.name = json.name;
  this.title = json.title || this.name;
  this.fields = json.fields;
  this.submitText = json.submitText;
  this.completeText = json.completeText;
}

exports.Site = Site;
