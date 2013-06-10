/*
 * server.js
 */

// Required packages
var express = require('express');
var http = require('http');
var https = require('https');
var fs = require('fs');

// Required files
var payload = require('./payload.js');
var functions = require('./functions');

// Global variables
var app = express();

// We need this for the POST body
app.use(express.bodyParser());

// We need SSL certs!
var keys = {
    key     :   fs.readFileSync('keys/server-key.pem'),
    cert    :   fs.readFileSync('keys/server-cert.pem')
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
