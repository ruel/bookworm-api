/*
 * jsonreq.js
 */

var http = require('http');
var https = require('https');
var querystring = require('querystring');

// Generic JSON based HTTP/S request
// Might be useful in the future
function get(host, path, params, secure, callback) {
    
    // Port for http is 80, https is 443
    var port = secure ? 443 : 80;

    // Stringify the parameters
    var query = querystring.stringify(params);

    // Setup options
    var options = {
        hostname    :   host,
        path        :   path + '?' + query,
        port        :   port
    };

    // Hope this works
    var agent = secure ? https : http;

    // Do the GET
    var request = agent.get(options, function(response) {
        var restring = "";

        // Catch chunks
        response.on('data', function(data) {
            restring += data.toString();
        });

        // Callback on this block
        response.on('end', function() {
            callback(JSON.parse(restring));
        });
    });
    request.end();
}

exports.get = get;
