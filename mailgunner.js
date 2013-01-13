var exec = require('child_process').exec;

function sendMail(options, callback){
  
}

exports.Mailgun = function(settings){
  var defaultAddress = settings.defaultAddress,
      domain = settings.domain,
      key = settings.key;
  
  this.sendMail = function(options, callback){
    if(!options) return false;
    if(!options.from) options.from = defaultAddress;
    if(!options.to) options.to = defaultAddress;
    var str = "curl -s -k --user api:" + key + " https://api.mailgun.net/v2/" + domain + "/messages -F from='" + options.from + "' -F to='" + options.to + "' -F subject='" + options.subject + "' -F text='" + options.text + "'";
    exec(str, callback);
    return true;
  }
}

//--user api:key-092ucndkyk7bg45f-o5h17nkbxuhozl9 https://api.mailgun.net/v2/w0ps.mailgun.org/messages -F fro