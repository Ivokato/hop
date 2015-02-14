var _ = require('underscore');
/**
/* expects express app, a hop site, and routesets with the following format: [{
/*   get: [
/*     {
/*       route: '/',
/*       handler: function renderIndex(req, res, next){ this == hopSite }
/*     }
/*   ]
/* }]
/*/

function applyRoutes(app, site, routeSets){
	_.each(routeSets, function(set){
    _.each(set, function(routes, verb){
      _.each(routes, function(route){
        app[verb](route.route, route.handler.bind(site));
      });
    });
  });
}

exports.applyRoutes = applyRoutes;
