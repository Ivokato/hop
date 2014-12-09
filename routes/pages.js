module.exports = {
  get: [
    {
      route: '/:section',
      handler: function sectionRoute(req, res){
        console.log('loading :section');
        if(req.params.section.split('.').length == 1){
          var section = this.sections.findOne({foldername: req.params.section});
              stylesheets = this.stylesheets.deepclone().merge(section.stylesheets),
              javascripts = this.javascripts.deepclone().merge(section.javascripts);
          for(var index in section.items){
            var item = section.items[index];
            if(!item.introduction){
              stylesheets = stylesheets.merge(item.stylesheets);
              javascripts = javascripts.merge(item.javascripts);
            }
          }
          //if(req.session.loggedOn) javascripts.push({src: '/socket.io/socket.io.js'}, {src: '/js/administrate.js'});
          
          res.render('section', {
            info: section,
            header: this.header,
            stylesheets: stylesheets,
            javascripts: javascripts,
            parentSection: req.params.section
          });
        }
        else req.next();
      }
    },
    {
      route: '/:section/:item',
      handler: function itemRoute(req, res){
        //check if a file in the public folder is pointed at or not, or a hidden item in a section (normal procedure)
        if(req.params.item.split('.').length == 1 || req.params.item[0] == '.'){
          var section = this.sections.findOne({foldername: req.params.section}),
              item = section.items.findOne({foldername: req.params.item}),
              stylesheets = this.stylesheets.deepclone().merge(section.stylesheets).merge(item.stylesheets),
              javascripts = this.javascripts.deepclone().merge(section.javascripts).merge(item.javascripts);
          
          if(item.hidden && !req.session.loggedOn) res.redirect('/' + req.params.section);
          
          res.render('item', {
            info: {item: item},
            header: this.header,
            stylesheets: stylesheets,
            javascripts: javascripts,
            parentSection: false
          });
        }
        else req.next();
      }
    }
  ]
};
