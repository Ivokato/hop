/**
 * Module dependencies.
 */

require('./enrich.js');

var fs = require('fs'),
    express = require('express'),
		routes = require('./routes'),
		user = require('./routes/user'),
		http = require('http'),
		path = require('path'),
    indexer = require('./indexer.js'),
    config = require('./config.json'),
		sio = require('socket.io'),
		gzippo = require('gzippo')
;

if(fs.existsSync('public/css/style.css')) fs.unlinkSync('public/css/style.css');


var site = new indexer.Site(config.sitename, config.contentpath);

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || config.port || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  //app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('your secret here'));
  app.use(express.session());
  app.use(app.router);
  app.use(require('less-middleware')({ src: __dirname + '/public' }));
  //app.use(express.static(path.join(__dirname, 'public')));
	app.use(gzippo.staticGzip(path.join(__dirname, 'public'), {
		contentTypeMatch: /text|javascript|json|svg|ttf|otf/
	}));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', function(req, res){ res.redirect('/' + config.homesection); });
//app.get('/users', user.list);

app.get(/images\/(.+)/, function(req, res){
	var imgPath = req.params[0],
		  extension = imgPath.split('.').reverse()[0];
	fs.readFile('content/' + imgPath, function(error, img){
    res.writeHead(200, {'Content-Type': 'image/' + extension });
    res.end(img, 'binary');
	});
});

app.get(/javascripts\/(.+)/, function(req, res){
	var jsPath = req.params[0];
	fs.readFile('content/' + jsPath, function(error, js){
    res.writeHead(200, {'Content-Type': 'text/javascript'});
    res.end(js, 'text');
	});
});


app.get(/stylesheets\/(.+)/, function(req, res){
	var cssPath = req.params[0],
		  extension = cssPath.split('.').reverse()[0];
	fs.readFile('content/' + cssPath, function(error, css){
    res.writeHead(200, {'Content-Type': 'text/css'});
    res.end(css, 'text');
	});
});

app.get('/:section/:item', function(req, res){
	if(req.params.section && req.params.item){
		req.next();
	}
	else req.next();
});


app.get('/:section', function(req, res){
	if(req.params.section.split('.').length == 1){
		var section = site.sections.findOne({foldername: req.params.section});
				stylesheets = site.stylesheets.deepclone().merge(section.stylesheets),
				javascripts = site.javascripts.deepclone().merge(section.javascripts);
		for(var index in section.items){
			var item = section.items[index];
			stylesheets = stylesheets.merge(item.stylesheets);
			javascripts = javascripts.merge(item.javascripts);
		}
		console.log(section);
		res.render('defaultPage', { info: section, header: site.header, stylesheets: stylesheets, javascripts: javascripts } );
	}
	else req.next();
});

app.post('/:section/:item/respond', function(req, res){
  console.log('req.post: ', req.body);
  res.redirect("/" + req.params.section);
});

app.post('/formSubmit/:formName', function(req, res){
  res.redirect('/' + config.homesection)
  console.log(req.body);
  fs.exists('content/FormResponses', function(exists){
    
    var saveResponse = function (){
      
      fs.exists('content/FormResponses/' + req.params.formName, function(exists){
        
        var saveResponse = function(){
          var date = new Date(),
              str = '',
              isFirst = true,
              firstKey = '';
          for(var index in req.body){
            str += index + ': ' + req.body[index] + '\r\n';
            if(isFirst) firstKey = req.body[index];
          }
          fs.writeFile(
            'content/FormResponses/' + req.params.formName + '/' + date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + '-' + date.getHours() + 'h' + date.getMinutes() + 'm' + date.getSeconds() + 's.txt',
            str,
            console.log
          );
        };
        
        if(!exists) fs.mkdir('content/FormResponses/' + req.params.formName, saveResponse);
        else saveResponse();
      });
      
    };
    
    if(!exists) fs.mkdir('content/FormResponses', saveResponse)
    else saveResponse();
  })
});

var server = http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

//var io = sio.listen(server);
//
//
//io.sockets.on('connection', function(socket){
//	console.log('connection open');
//	socket.emit('news', {hello: 'world'});
//	socket.on('otherEvent', function(data){
//		console.log(data);
//	});
//	socket.on('disconnect', function(){
//		console.log('connection closed' );
//	});
//});
