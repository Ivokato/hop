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
      route: /images\/(.+)/,
      handler: function(req, res){
        console.log('image requested');
        var imgPath = req.params[0],
            extension = imgPath.split('.').pop();
        
        this.imageCache.get(req.params[0], req.query, function(error, img){
          if(error) {
            console.log(error);
            res.send(503, error);
          }
          else{
            res.writeHead( 200, {'Content-Type': imgMimes[extension]} );
            res.end(img, 'binary');
          }
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