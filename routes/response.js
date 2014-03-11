module.exports = {
  post: [
    {
      route: '/:section/:item/respond',
      handler: function(req, res){
        console.log('req.post: ', req.body);
        res.redirect("/" + req.params.section);
      }
    }
  ]
};