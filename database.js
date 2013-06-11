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

// Token expiration in milliseconds
// TODO: Is 30 minutes okay?
var expms = minToMs(30);

// Get specific book
function getBook(id, fields, callback) {
    resetResult();

    // Look for our book
    db.books.find({ _id : id }, function(error, data) {
        if (error) throw error;

        // Check if there's a record
        if (data.length > 0) {

            
            
            // It's in our first index

        } else {
            
            // ID doesn't exist
            callback(formatResult('INVID', 'Book not found'));
        }
    }).limit(1);
}

// Creation of books
function insertBook(token, data, callback) {
    resetResult();

    // We need to check first if the token is valid
    // Though we can do this later, we can save resources
    // by doing this now
    validateAdminToken(token, function(valid) {

        if (valid) {

            // We need to re-initialize the object with the optional fields
            var book = data;
            book['reviews'] = [];
            book['year'] = typeof data.year === 'undefined' ? '' : util.inspect(data.year);
            book['tags'] = typeof data.year === 'undefined' ? [] : data.tags;
            book['cover_image_url'] = typeof data.year === 'undefined' ? '' : data.cover_image_url;

            // Author should not be empty
            book['authors'] = data.authors.length === 0 ? ['Anonymous'] : data.authors;

            // We also want to check for empty author names
            for (var i in data.authors) {
                
                // Check for empty string or whitespaces
                if (book.authors[i] === '' || book.authors[i].match(/^\s+$/)) {
                    book.authors[i] = 'Anonymous';
                }
            }

            // Remove duplicates
            book.authors = book.authors.filter(function(e, p) {
               return book.authors.indexOf(e) == p;
            });

            // If there are more than 1 authors,
            // We don't need anonymous
            if (book.authors.length > 1) {
                book.authors.splice(book.authors.indexOf('Anonymous'), 1);
            }

            // Set the defaults
            book['download_count'] = 0;
            book['view_count'] = 0;
            book['date_created'] = Date.now();
            book['date_modified'] = Date.now();

            // Make sure to create the authors first
            // Or not. It's synchronized
            insertAuthors(book.authors);

            // Let's save
            db.books.save(book, function(error, data) {
                if (error) throw error;
                
                // Update the token expiration
                updateTokenExp(token);

                // We should include the book id on the result
                result['data'] = {
                    book_id : data._id
                };

                callback(result);
            });
        } else {
            
            // Token not valid
            callback(formatResult('INVTOKEN', 'Token not valid'));
        }
    });
}

// We should have authors first though
// TODO: Sync okay?
function insertAuthors(authors) {
    resetResult();

    for (var i in authors) {
        name = authors[i];

        // Our _id will be the name
        db.authors.save({ _id : name }, function (error) {
            if (error) throw error;
        });
    }
}

// Checks for admin authentication, and returns a token
function adminAuth(username, password, callback) {
    resetResult();

    // Let's hash the password
    var hash = doMd5(password);

    db.admins.find({ _id : username, password : hash }, function(error, data) {
        if (error) throw error;

        // Check if found
        if (data.length > 0) {
            
            // Let's generate a token
            var token = generateToken(username);

            // Set the expiration 
            var expiry = Date.now() + expms;

            db.admins.update({ _id : username },{ 
                $set : { 
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
            validateAdminToken(token, function(valid) {
                if (error) throw error;
                
                // Valid, nice callback parameter
                if (valid) {
                    
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

// Prolong the token expiration everytime it's used
// This way, continuous operations (autmations and such)
// of the admin will not be interrupted.
// TODO: Can we live with this being synchronous?
function updateTokenExp(token) {

    // Update the admins table, look for the token
    db.admins.update({ token : token }, { 
        $set : { token_exp : Date.now() + expms }
    }, function (error) {
        if (error) throw error;
    });
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

// md5 for password security (slight)
function doMd5(password) {
    return crypto.createHash('md5').update(password).digest("hex");
}

// Checks for access token of administrators
function validateAdminToken(token, callback) {

    // Check if there's a token, and it's expiration is greater than the current date
    db.admins.find({ token : token, token_exp : { $gt : Date.now() } }, function(error, data) {
        if (error) throw error;

        // Length will return 1 if there's a token
        // Or the token is not yet expired
        if (data.length > 0) {
            callback(true);
        } else {
            callback(false);
        }
    }).limit(1);
}

// Creation of admin (upsert)
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

// It's such a drag checking google for mins to ms conversions
function minToMs(min) {
    return (min * 60000);
}

// Export functions
exports.insertBook = insertBook;
exports.insertAdmin = insertAdmin;
exports.adminAuth = adminAuth;
