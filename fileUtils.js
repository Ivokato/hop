var fs = require("fs"),
    utfTypes = ['css','less','js','json','xml','txt'];

function getFile(path, item, itemName, callback){
	
}

function getFolderContents(folder, callback, parent, resolve){
	if(!parent) parent = {};

	fs.readdir(folder, function(err, folderContents){
		var items = {},
		    itemName, i,
		    total = 0, completed = 0,
				path = folder + '/';

	  if(err) callback(err);
    else{
      for(i in folderContents){
				total++;
				(function(i, itemName){
					var item = {};
          items[itemName] = item;
          
					parent.children = items;

	  			fs.stat(path + itemName, function(err, stats){
		  			if(err) callback(err);
			  		else{
              item.modified = stats.mtime;
							item.size = stats.size;
							//item.name = itemName;
							item.hidden = itemName[0] == '.';
							item.name = item.hidden ? itemName.substr(1) : itemName;
							
				  		if(stats.isDirectory()){
                item.isDirectory = true;
                item.base = itemName;
								
								getFolderContents(path + itemName, callback, item, function(){
									completed++;
									if(completed == total) (resolve || callback)(null, items);
								});
                
					  	}
						  else{
								fs.realpath(path + itemName, function(err, filePath){
									if(err) callback(err);
									else{
										item.path = filePath;
										
										
										
										var split = itemName.split('.');
										
										item.extension = item.hidden ?
											split.length > 2 ? split.pop() : '' :
											split.length > 1 ? split.pop() : '';
										
										item.base = split.join('.');
										
										if(utfTypes.indexOf(item.extension) !== -1){
											fs.readFile(path + itemName, 'utf8', function(err, contents){
												if(err) callback(err);
												else{
													item.contents = contents;
													completed++;
													if(completed == total) (resolve || callback)(null, items);
												}
											});
										}
										else{
											completed++;
											if(completed == total) (resolve || callback)(null, items);
										}
									}
								});
						  }
					  }
				  });
				})(i, folderContents[i]);
			}
			if(total == 0) (resolve || callback)(null, items);
		}
	});
}

function getFile(path, callback){
	fs.stat(path, function(err, stats){
		if(err) callback(err);
		else{
			var file = {},
					itemName = path.split('/').pop();
			
			file.modified = stats.mtime;
			file.size = stats.size;
			file.hidden = itemName[0] == '.';
			file.name = file.hidden ? itemName.substr(1) : itemName;
			
			fs.realpath(path, function(err, filePath){
				if(err) callback(err);
				else{
					file.path = filePath;
					
					var split = itemName.split('.');
					
					file.extension = file.hidden ?
						split.length > 2 ? split.pop() : '' :
						split.length > 1 ? split.pop() : '';
					
					file.base = split.join('.');
					
					if(utfTypes.indexOf(file.extension) !== -1){
						fs.readFile(path, 'utf8', function(err, contents){
							if(err) callback(err);
							else{
								file.contents = contents;
								callback(null, file);
							}
						});
					}
					else{
						callback(null, file);
					}
				}
			});
		}
	});
}

function validatePath(basepath, path, callback){
  var array = path.split('/'),
      lowestDirectory = array.shift(),
      str = (basepath ? basepath + '/' : '') + lowestDirectory;
  
  fs.exists(str, function(exists){
    if(exists){
      if(array.length) validatePath(str, array.join('/'), callback);
      else callback();
    }
    else fs.mkdir(str, function(error){
      if(error) console.log(error);
      else {
        if(array.length) validatePath(str, array.join('/'), callback);
        else callback();
      }
    })
  });
}

function removeNonEmptyFolder(path, callback){
  var level = level || 0,
      callback = callback || function(){};
  fs.exists(path, function(exists){
    if(!exists) callback();
    else {
      fs.readdir(path, function(error, files){
        if(files.length){
          var i = 0,
              t = 0,
              done = false,
              increment = function(error){
                if(error) console.log(error);
                t++;
                if((t == +i + 1) && done) {
                  fs.rmdir(path, callback);
                }
              };
          
          for(i in files){
            (function(file){
              var localPath = path + '/' + file;
              fs.stat(localPath, function(error, stats){
                if(stats.isDirectory()) removeNonEmptyFolder(localPath, increment);
                else fs.unlink(localPath, increment);
              });
            })(files[i]);
          }
          done = true;
        }
        else fs.rmdir(path, callback);
      });
    }
  });
}

exports.getFile = getFile;
exports.validatePath = validatePath;
exports.removeNonEmptyFolder = removeNonEmptyFolder;
exports.getFolderContents = getFolderContents;
