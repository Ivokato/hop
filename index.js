/**
 * Module dependencies.
 */

console.log('--------------- loading your hop ---------------');

require('./enrich.js');

var fs = require('fs'),
    async = require('async'),
    express = require('express'),
    http = require('http'),
    path = require('path'),
    folderLoader = require('./folderLoader.js'),
    socketeer = require('./socketeer.js').socketeer,
    gzippo = require('gzippo'),
    scheduler = require('node-schedule');
    //sendMail = new (require('./mailgunner.js').Mailgun)(options.mailgunSettings).sendMail;

var applyRoutes = require('./hoprouter.js').applyRoutes;

var formTokens = {},
    tokenCleanJob = scheduler.scheduleJob('53 * * * *', function(){
      var now = new Date().getTime();
      for(var i in formTokens){
        if(now - formTokens[i].getTime() > 60 * 60 * 1000) delete formTokens[i];
      }
    });

//what?
//if(fs.existsSync('public/css/style.css')) fs.unlinkSync('public/css/style.css');

module.exports = {
  init: function(options, callback){
    var site = new folderLoader.Site(options);
    var app = express();

    app.configure(function(){
      app.set('port', process.env.PORT || options.port || 3000);
      app.set('views', __dirname + '/views');
      app.set('view engine', 'jade');
      //app.use(express.favicon());
      app.use(express.logger('dev'));
      app.use(express.bodyParser());
      app.use(express.methodOverride());
      app.use(express.cookieParser(options.secret || 'your secret here'));
      app.use(express.session());
      app.use(function setLocals(req, res, next){
        res.locals.loggedOn = req.session.loggedOn;
        res.locals.isAjax = req.headers['x-requested-with'] && req.headers['x-requested-with'] === 'XMLHttpRequest';
        next();
      });
      app.use(app.router);
      app.use(require('less-middleware')(__dirname + '/public' ));

      //app.use(express.static(path.join(__dirname, 'public')));
      app.use(gzippo.staticGzip(path.join(__dirname, 'public'), {
        contentTypeMatch: /text|javascript|json|svg|ttf|otf|css/
      }));

      if( options.publicPath && fs.existsSync( path.join( process.cwd(), options.publicPath ) ) ){
        app.use( express.static(path.join(process.cwd(), options.publicPath ) ) );
      }
    });

    app.configure('development', function(){
      app.use(express.errorHandler());
    });

    app.locals.generateToken = function(formName) {
      var str = formName + Math.random();
      formTokens[str] = new Date();
      return str;
    };

    if(options.beforeRouting) options.beforeRouting(app, site, callback);

    app.get('/', function(req, res){ res.redirect('/' + options.homesection); });

    applyRoutes(app, site, [
      require('./routes/authentication.js'),
      require('./routes/resources.js'),
      require('./routes/pages.js'),
      require('./routes/edit.js'),
      require('./routes/contactForm.js'),
      require('./routes/response.js')
    ]);

    if(options.afterRouting) options.afterRouting(app, site, callback);

    var server = http.createServer(app).listen(app.get('port'), function(){
      console.log("Express server listening on port " + app.get('port'));
    });

    socketeer(server, site, app);

    callback(site, app, server, socketeer);
  }
};
