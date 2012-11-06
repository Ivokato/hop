
/**
 * Module dependencies.
 */

var fs = require('fs'),
    express = require('express'),
		routes = require('./routes'),
		user = require('./routes/user'),
		http = require('http'),
		path = require('path'),
    indexer = require('./indexer.js'),
    config = require('./config.json'),
		sio = require('socket.io')
;

if(fs.existsSync('public/css/style.css')) fs.unlinkSync('public/css/style.css');


var site = new indexer.Site(config.sitename, config.contentpath)

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || config.port || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('your secret here'));
  app.use(express.session());
  app.use(app.router);
  app.use(require('less-middleware')({ src: __dirname + '/public' }));
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});



app.get('/', function(req, res){ res.redirect('/' + config.homesection); });
//app.get('/users', user.list);

app.get('/:section', function(req, res){
  if(req.params.section.split('.').length == 1){
		if(site.sections && site.sections[req.params.section]){
			res.render('defaultPage', { info: site.sections[req.params.section], header: site.header } );
		}
		else res.next();
	}
	else res.next();
});

app.get(/images\/(.+)/, function(req, res){
	var imgPath = req.params[0],
		  extension = imgPath.split('.').reverse()[0];
	fs.readFile('content/' + imgPath, function(error, img){
    res.writeHead(200, {'Content-Type': 'image/' + extension });
    res.end(img, 'binary');
	});
});

//app.get('/:section/:item', function(req, res){
//  console.log(req.params);
//});
//
//app.get('/:section/:item/:file', function(req, res){
//  
//});

var server = http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

var io = sio.listen(server);


io.sockets.on('connection', function(socket){
	console.log('connection open');
	socket.emit('news', {hello: 'world'});
	socket.on('otherEvent', function(data){
		console.log(data);
	});
	socket.on('disconnect', function(){
		console.log('connection closed' );
	});
});