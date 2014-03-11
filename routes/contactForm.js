module.exports = {
  post: [
    {
      route: '/formSubmit/:formName',
      handler: function(req, res){
        res.redirect('/' + config.homesection);
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
            
            if(!exists) fs.mkdir('content/FormResponses', saveResponse);
            else saveResponse();
          });
        }
      }
    }
  ]
};