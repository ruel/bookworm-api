/*
 * server.js
 */

// Required packages
var express = require('express');
var http = require('http');
var https = require('https');
var fs = require('fs');

// Required files
var payload = require(__dirname + '/payload.js');
var functions = require(__dirname + '/functions');

// Global variables
var app = express();

app.configure(function() {

    // Global headers
    app.use(function(request, response, next) {
        
        // CORS
        response.header('Access-Control-Allow-Origin', '*'); 
        response.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS, DELETE');
        response.header('Access-Control-Allow-Headers', 'Accept, Origin, Content-Type, Content-Length'); 
          
        next();
    });

    // We need this for the POST body
    app.use(express.bodyParser());

    app.use(app.router);
});

// We need SSL certs!
var keys = {
    key     :   fs.readFileSync(__dirname + '/keys/server-key.pem'),
    cert    :   fs.readFileSync(__dirname + '/keys/server-cert.pem')
};

// Servers can use the same callback
// I've read that 'app' is actually a callback
// http://expressjs.com/api.html#app.listen
http.createServer(app).listen(1337);
https.createServer(keys, app).listen(443);

// Pass app to the payload
payload.process(app);

// Let's lower down our privilege
functions.setUser('www-data');
