/*
 * database.js
 */

// Required package for mongo
var mongojs = require('mongojs');
var crypto = require('crypto');

// For the error sending
var functions = require('./functions.js');

// Our collections, db variables and such
var collections = ['users', 'admins', 'books', 'reviews', 'authors'];
var dbname = 'bookworm';

// Let's connect, shall we
var db = mongojs.connect(dbname, collections);

// We would like to create an administrator first
function insertAdmin(token, username, password, callback) {
    
    // Hash the password
    password = doMd5(password);

    // Let's have a count of our collection first
    // If it's empty, then we do not need a token
    db.admins.count(function(error, count) {
        if (error) throw error;
        var valid_token = false;

        if (count === 0) {
            valid_token = true;

            // Let's create the admin
            // This happens only once
            doCreateAdmin(username, password, function(success) { callback(success) });
        } else {
            
            // Let's check the token first
            db.admins.find({ token : token }, function(error, data) {
                if (error) throw error;

                // So this means the token is valid
                valid_token = true;
                doCreateAdmin(username, password, function(success) { callback(success) });
            });
        }

        if (!valid_token) {
            callback(false);
        }
    });
}

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

// Export functions down below
exports.insertAdmin = insertAdmin;
