var foldermap = require("foldermap"),
    fmap = foldermap.map,
    fmapSync = foldermap.mapSync,
    fs = require("fs");


function Site(name, path){
  this.diskdata = fmapSync({path: path, recursive: true});
  this.sections = {};
  
  this.menu = {};
  
  if(this.diskdata && countChildren(this.diskdata)) this.addData(this.diskdata);
  
  this.header = {menu: createMenuFromStructure(this) };
}
(function(){
  this.addData = function(diskdata){
    for(var name in diskdata){
      var file = diskdata[name];
      if(file._type == 'directory') this.sections[name] = new Section(name, file);
      else{
        if(file._ext) == jpg
      }
    }
  }
}).call(Site.prototype);

function Section(name, data){
  console.log(name, data);
  this.title = name;
  this.items = [];
  
  
  if(data && countChildren(data)) this.addData(data);
}
(function(){
  this.addData = function(data){
    for(var itemname in data){
      var item = data[itemname];
      if(item._type == 'directory') this.items.push( new Item(itemname, item) );
      else{
        if(imageTypes[item._ext]){
          
        }
      }
      
    }
  }
}).call(Section.prototype);

function Item(name, data){
  this.contents = {
    images: []
  };
  if(data && countChildren(data)) this.addData(data);
}
(function(){
  this.addData = function(data){
    for(var thing in data){
      var part = data[thing];
      switch(part._ext){
        case 'txt': {
          this.contents[part._base] = part._content;
        }; break;
        case 'jpg': {
          console.log(part._base);
        }; break;
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



function countChildren(obj){
  var t = 0;
  for(var i in obj) t++;
  return t;
}

exports.Site = Site;