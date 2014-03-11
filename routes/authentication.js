module.exports = {
  get: [{
    route: '/login',
    handler: function(req, res){
      if(site.authInfo){
        res.render('login', {info: {title: 'login to your dashboard'}});
      }
      else req.next();
    }
  }],
  post: [{
    route: '/login',
    handler: function(req, res){
      //prevent bruteforcing (todo: have it do this per user)
      if(new Date().getTime() - lastLoginAttempt > 1000){
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
    }
  }]
};