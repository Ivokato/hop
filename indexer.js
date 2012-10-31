var foldermap = require("foldermap"),
    fmap = foldermap.map,
    fmapSync = foldermap.mapSync,
    fs = require("fs"),
		imageTypes = {
			'jpg': 'image/jpg',
			'gif': 'image/gif',
			'png': 'iamge/png'
		}


function Site(name, path){
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
					}
					if(file._base.toLowerCase() == 'background') {
						this.background = stripPath(this.path, file._path);
						fs.writeFileSync('public/css/background.less', 'body{background-image: url(/images/' + this.background + ');}')
					}
				}
      }
    }
		if(!this.background) fs.writeFileSync('public/css/background.less', '');
		if(!this.header.logo) fs.writeFileSync('public/css/logo.less', '');
  }
}).call(Site.prototype);

function Section(name, site, data){
  this.title = name;
	this.site = site;
  this.items = [];
  this.images = [];
  if(data && countChildren(data)) this.addData(data);
}
(function(){
  this.addData = function(data){
    for(var itemname in data){
      var item = data[itemname];
      if(item._type == 'directory') this.items.push( new Item(itemname, this.site, item) );
      else{
        if(item._ext in imageTypes){
          this.images.push(new Image(item, this.site.path));
        }
      }
      
    }
  }
}).call(Section.prototype);

function Item(name, site, data){
  this.site = site;
	this.contents = {
    images: []
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
					this.contents.images.push(new Image(part, this.site.path));
				}
			}
    }
  };
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