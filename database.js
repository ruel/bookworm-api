/*
 * database.js
 */

// Required package for mongo
var mongojs = require('mongojs');
var crypto = require('crypto');
var util = require('util');

// For the error sending
var functions = require('./functions.js');

// Our collections, db variables and such
var collections = ['users', 'admins', 'books', 'reviews', 'authors'];
var dbname = 'bookworm';

// Let's connect, shall we
var db = mongojs.connect(dbname, collections);

// This is for the result object
var result;

// Creation of books
function insertBook(data, callback) {

}

// Checks for admin authentication, and returns a token
function adminAuth(username, hash, callback) {
    resetResult();
    var found = false;

    db.admins.find({ _id : username, password : hash }, function(error, data) {
        if (error) throw error;

        // Check if found
        if (data.length > 0) {
            
            // Let's generate a token
            var token = generateToken(username);

            // Set the expiration to an hour
            var expiry = Date.now() + 3600000;

            db.admins.update({ _id : username }, 
                { $set : { 
                    token : token,
                    token_exp : expiry 
                    }
                }, function(error) {
                if (error) throw error;
                
                // Let's return the token
                result['data'] = {
                    access_token : token
                };
                callback(result);
            });

        } else {

            // Login failed
            callback(formatResult('LOGINERR', 'Administrator login failed'));
        }
    });
}

// We would like to create an administrator first
function insertAdmin(token, username, password, callback) {
    resetResult();

    // Hash the password
    password = doMd5(password);

    // Let's have a count of our collection first
    // If it's empty, then we do not need a token
    db.admins.count(function(error, count) {
        if (error) throw error;

        // No admin at all, so we need to create one
        // even without a token
        if (count === 0) {

            // Let's create the admin
            // This happens only once
            doCreateAdmin(username, password, function(success) { result.success = success; callback(result) });
        } else {
            
            // Let's check the token first
            db.admins.find({ token : token, token_exp : { $gt : Date.now() } }, function(error, data) {
                if (error) throw error;
                
                // If length of this is 0, then no result was found
                if (data.length > 0) {
                    
                    // So this means the token is valid
                    doCreateAdmin(username, password, function(success) { result.success = success; callback(result) });
                } else {
                    
                    // Token is invalid :(
                    callback(formatResult('TOKNERR', 'Invalid token specified'));
                }
            });
        }
    });
}

// Generates a new token based on the current time
function generateToken(username) {
    return doMd5(util.format('%s::%d', username, Date.now()));
}

// Reset the result object
function resetResult() {
    result = {
        success : true,
        status  : 'OK',
        message : 'Operation completed successfully'
    };
}

// Save lines, 3 at a time.
function formatResult(code, message) {
    var custResult = {
        success : false,
        status  : code,
        message : message
    };

    return custResult;
}

    return custResult;
}

// md5 for password security (slight)
function doMd5(password) {
    return crypto.createHash('md5').update(password).digest("hex");
}

function doCreateAdmin(username, password, callback) {

    // We need to check if the user already exists
    // Then insert if it exists
    db.admins.update({ _id : username }, {
        _id         : username,
        password    : password,
        created     : Date.now(),
        token       : '',
        token_exp   : Date.now()
    }, { upsert : true }, function(error) {
        if (error) throw error;

        callback(true);
    });
    
}

