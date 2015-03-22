var fs = require('fs');

var imgMimes = {
      jpg: 'image/jpeg',
      gif: 'image/gif',
      png: 'image/png'
    },
    imgExts = [ 'jpg', 'png' /*, 'gif'*/ ];

module.exports = {
  get: [
    {
      route: /\/(.+)\.(jpg|png)$/,
      handler: function getImage(req, res, next){
        var imgPath = req.params[0],
            extension = req.params[1],
            fullImgName = imgPath + '.' + extension;

        this.imageCache.get(fullImgName, req.query, function(error, img){
          if(error) {
            console.log(error, fullImgName);
            if(error.message === 'imageCache: image not found'){
              return next();
            }
            return next(error);
          }
          
          res.writeHead( 200, {'Content-Type': imgMimes[extension]} );
          res.end(img, 'binary');
        });
      }
    },
    {
      route: /\/(.+)\.(js|css|less)/,
      handler: function getResource(req, res, next){
        this.get(req.params.join('.').split('/'), function(err, resource){
          if(!resource){
            if(err){
              console.log(err);
            }
            return next();
          }

          res.set('Content-Type', resource.mime);
          res.send(resource.payload);
        });
      }
    },
    {
      route: /javascripts\/(.+)/,
      handler: function(req, res){
        var jsPath = req.params[0];
        fs.readFile('content/' + jsPath, function(error, js){
          res.writeHead(200, {'Content-Type': 'text/javascript'});
          res.end(js, 'text');
        });
      }
    },
    {
      route: /files\/(.+)/,
      handler: function(req, res){
        var filePath = req.params[0];
        res.sendfile('content/' + filePath);
      }
    },
    {
      route: /stylesheets\/(.+)/,
      handler: function(req, res){
        var cssPath = req.params[0],
            extension = cssPath.split('.').reverse()[0];
        fs.readFile('content/' + cssPath, function(error, css){
          res.writeHead(200, {'Content-Type': 'text/css'});
          res.end(css, 'text');
        });
      }
    }
  ]
};
