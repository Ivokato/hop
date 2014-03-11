module.exports = {
  get: [
    {
      route: '/edit',
      handler: function(req, res){
        //if(!req.session.loggedOn) req.next();
        console.log(this);
        res.render('editmain', this);
      }
    },
    {
      route: '/edit/:section',
      handler: function(req, res){
        if(!req.session.loggedOn) req.next();

        res.render('editsection', section);
      }
    },
    {
      route: '/edit/:section/:item',
      handler: function(req, res){
        if(!req.session.loggedOn) req.next();

        res.render('edititem', item);
      }
    }
  ],
  post: [
    {
      route: '/edit',
      handler: function(req, res){
        if(!req.session.loggedOn) req.next();

        //res.render('')
        res.next();
      }
    }
  ]
};