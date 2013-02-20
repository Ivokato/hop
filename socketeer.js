var sio = require("socket.io"),
    fs = require("fs");

function socketeer(server, site, app){
  var io = sio.listen(server);
  
  io.set('log level', 1);
  io.sockets.on('connection', function(socket){
    console.log('connection opened');
    var viewer = {socket: socket};
    site.liveViewers.push(viewer);
    
    socket.on('disconnect', function(){
      site.liveViewers.splice(site.liveViewers.indexOf(viewer), 1);
    });
  });
  
  fs.exists('socketscripts', function(exists){
    if(exists){
      fs.readdir('socketscripts', function(error, files){
        for(var i in files){
          if(files[i].indexOf('.js') !== -1){
            try{
              require('./socketscripts/' + files[i]).start(io, app);
            }
            catch(e){
              console.log('error: ' + e);
            }
          }
        }
      });
    }
  });
}

exports.socketeer = socketeer;