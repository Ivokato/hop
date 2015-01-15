var path = require('path'),
	async = require('async'),
	_ = require('underscore'),
	fs = require("fs"),
	utfTypes = ['css','less','js','json','xml','txt'];

// function getFile(path, item, itemName, callback){
	
// }

function getFolderContents(folder, callback, parent, resolve){
	if(!parent) parent = {};

	console.log('indexing ' + folder);
	
	fs.readdir(folder, function(err, folderContents){
		var items = {},
			itemName, i,
			total = 0, completed = 0,
			localPath = folder + path.sep;

		if(err) callback(err);
		else{
			_.each(folderContents, function(itemName, i){
				total++;

				var item = {};
				items[itemName] = item;
				
				parent.children = items;

				fs.stat(localPath + itemName, function(err, stats){
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
							
							getFolderContents(localPath + itemName, callback, item, function(){
								completed++;
								if(completed == total) (resolve || callback)(null, items);
							});
							
						}
						else{
							fs.realpath(localPath + itemName, function(err, filePath){
								if(err) callback(err);
								else{
									item.path = filePath;
									
									var split = itemName.split('.');
									
									item.extension = item.hidden ?
										split.length > 2 ? split.pop() : '':
										split.length > 1 ? split.pop() : '';
									
									item.base = split.join('.');
									
									if(utfTypes.indexOf(item.extension) !== -1){
										fs.readFile(localPath + itemName, 'utf8', function(err, contents){
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
			});
			if(total === 0) (resolve || callback)(null, items);
		}
	});
}

function getFile(path, callback){
	fs.stat(path, function(err, stats){
		console.log('reading ' + path);
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

function validatePath(localPath, callback) {
	callback = callback || function(){};

	fs.exists(localPath, function(exists){
		var localPathArray,
			deepness,
			levelsDone = 0,
			newPathArray = [],
			base;

		if(exists) callback();
		else {
			localPathArray = localPath.split(path.sep);
			deepness = localPathArray.length;

			//take the last part of the path and check for existence
			do {
				newPathArray.unshift( localPathArray.pop() );
				levelsDone++;
			} while( levelsDone !== deepness && !fs.existsSync( localPathArray.join( path.sep ) ) );
			
			base = localPathArray.join( path.sep ) + path.sep;

			while(newPathArray.length && newPathArray[0]) {
				base += newPathArray.shift() + path.sep;
				fs.mkdirSync(base);
			}

			callback();
		}

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
							if((t == + i + 1) && done) {
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
