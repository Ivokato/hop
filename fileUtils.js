var fs = require("fs");

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

exports.validatePath = validatePath;
exports.removeNonEmptyFolder = removeNonEmptyFolder;