/**
/* expects express app, a hop site, and routesets with the following format: [{
/*   get: [
/*     {
/*       route: '/',
/*       handler: function renderIndex(req, res){ this == hopSite }
/*     }
/*   ]
/* }]
/*/

function applyRoutes(app, site, routeSets){
	var set,
      verb,
      routesWithVerb,
      route,
      routeName,
      routeFun,
      i, j;

	for(i in routeSets){
    set = routeSets[i];
    
    for(verb in set){
      routesWithVerb = set[verb];
      if(routesWithVerb) for(j in routesWithVerb){
        route = routesWithVerb[j];
        routeName = route.route;
        routeFun = route.handler;
        
        app[verb](routeName, routeFun.bind(site));
      }
    }
	}
}

exports.applyRoutes = applyRoutes;