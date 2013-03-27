/**
 * Module dependencies.
 */

console.log('------------------------------------------------------');

require('./enrich.js');

var fs = require('fs'),
    express = require('express'),
    routes = require('./routes'),
    user = require('./routes/user'),
    http = require('http'),
    path = require('path'),
    indexer = require('./indexer.js'),
    config = require('./config.json'),
    socketeer = require('./socketeer.js').socketeer,
    gzippo = require('gzippo'),
    scheduler = require('node-schedule'),
    sendMail = new (require('./mailgunner.js').Mailgun)(config.mailgunSettings).sendMail
;

var formTokens = {},
    tokenCleanJob = scheduler.scheduleJob('53 * * * *', function(){
      var now = new Date().getTime();
      for(var i in formTokens){
        if(now - formTokens[i].getTime() > 60 * 60 * 1000) delete formTokens[i];
      }
    }); 

if(fs.existsSync('public/css/style.css')) fs.unlinkSync('public/css/style.css');


var site = new indexer.Site(config.sitename, config.contentpath),
    app = express();

app.configure(function(){
  app.set('port', process.env.PORT || config.port || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  //app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser(config.secret || 'your secret here'));
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

app.locals.generateToken = function(formName) {
  var str = formName + Math.random();
  formTokens[str] = new Date;
  return str;
};

app.get('/', function(req, res){ res.redirect('/' + config.homesection); });

app.get(/images\/(.+)/, function(req, res){
  console.log('image requested');
	var imgPath = req.params[0],
		  extension = imgPath.split('.').reverse()[0];
  
	//check if sized image is requested, then serve from resizerCache
	if(/-[0-9]+x[0-9]/.test(req.params[0])){
		site.imageCache.get(req.params[0], function(error, img){
			if(error) {
				console.log(error);
			}
			else res.writeHead(200, {'Content-Type': 'image/' + extension});
			res.end(img, 'binary');
		});
	}
	//serve normal image;
	else fs.readFile('content/' + imgPath, function(error, img){
    if(error){
      console.log(error);
      req.next();
    }
    else{
      res.writeHead(200, {'Content-Type': 'image/' + extension });
      res.end(img, 'binary');
    }
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

app.get('/login', function(req, res){
  if(site.authInfo){
    res.render('login', {info: {title: 'login to your dashboard'}});
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
    if(req.session.loggedOn) javascripts.push({src: '/socket.io/socket.io.js'}, {src: '/js/administrate.js'});
    
		res.render('section', { info: section, header: site.header, stylesheets: stylesheets, javascripts: javascripts, parentSection: req.params.section } );
	}
	else req.next();
});

app.get('/:section/:item', function(req, res){
	if(req.params.section.split('.').length == 1 && req.params.item.split('.').length == 1){
		var section = site.sections.findOne({foldername: req.params.section}),
        item = section.items.findOne({foldername: req.params.item}),
				stylesheets = site.stylesheets.deepclone().merge(section.stylesheets).merge(item.stylesheets),
				javascripts = site.javascripts.deepclone().merge(section.javascripts).merge(item.javascripts);
    if(req.session.loggedOn) javascripts.push({src: '/socket.io/socket.io.js'}, {src: '/js/administrate.js'});
    
		res.render('item', { info: {item: item} , header: site.header, stylesheets: stylesheets, javascripts: javascripts, parentSection: false } );
	}
	else req.next();
});

var lastLoginAttempt;
app.post('/login', function(req, res){
  //prevent bruteforcing
  if(!(new Date().getTime() - lastLoginAttempt < 1000)){
    if(req.body.name == site.authInfo.name && req.body.password == site.authInfo.password){
      req.session.loggedOn = true;
      console.log('ref', req.referrer);
      res.redirect('/');
    }
    else{
      lastLoginAttempt = new Date().getTime();
      res.redirect('/login');
    }
  }
  else setTimeout(function(){ res.redirect('/login'); }, 1000);
});

//not used yet
app.post('/:section/:item/respond', function(req, res){
  console.log('req.post: ', req.body);
  res.redirect("/" + req.params.section);
});

app.post('/formSubmit/:formName', function(req, res){
  res.redirect('/' + config.homesection)
  if(formTokens[req.body.token]){
    delete formTokens[req.body.token];
    delete req.body.token;
    
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
          str
        );
        
        //send copy to submitter    
        sendMail({
          from: req.body.Email,
          subject: 'A' + ('aeouiyh'.indexOf(req.params.formName[0]) == -1  ? '' : 'n' ) + ' ' + req.params.formName + ' submission!',
          text: str
        }, console.log);
        
        //send copy to receiver    
        sendMail({
          to: req.body.Email,
          subject: 'Your ' + req.params.formName + ' submission',
          text: str
        }, console.log);
      };
	  
      if(!exists) fs.mkdir('content/FormResponses/' + req.params.formName, saveResponse);
      else saveResponse();
    });
	
      };
      
      if(!exists) fs.mkdir('content/FormResponses', saveResponse)
      else saveResponse();
    });
  }
});

var server = http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

socketeer(server, site, app);