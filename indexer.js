var fmap = require("foldermap").map;

function createStructure(site, callback){ fmap({path: 'content/', recursive: true}, function(error, files){
  if(error){
    site.error = error;
    callback(error, site);
  }
  else{
    site.sections = {};
    for(var sectionname in files){
      
      if(files[sectionname]._type == 'directory'){
        var sectionOnDisk = files[sectionname];
        
        site.sections[sectionOnDisk._base] = {title: sectionname, items: []};
        var section = site.sections[sectionOnDisk._base];
        
        for(var itemname in sectionOnDisk){
          var item = sectionOnDisk[itemname];
          if(item._type == 'directory'){
            var theItem = {contents: {}};
            section.items.push(theItem);
            
            for(var subItemName in item){
              
              var subItem = item[subItemName];
              
              switch(subItem._ext){
                case 'txt': {
                  section[item._base] = item._content;
                }; break;
              }
              
              theItem.contents[subItem._base] = subItem._content;
            }
            
          }
          
        }
        
      }
      
    }
    
    site.header = {menu: createMenuFromStructure(site) };
    
    callback(null, site);
  }
});}



function createMenuFromStructure(structure){
  var menu = [];
  for(var index in structure.sections){
    menu.push(index);
  }
  console.log('menu: ', menu);
  return menu
}



function countChildren(obj){
  var t = 0;
  for(var i in obj) t++;
  return t;
}

exports.createStructure = createStructure;