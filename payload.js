/*
 * payload.js
 */

// We need this for our database
var database = require('./database.js');
var functions = require('./functions.js');

// We need this object as template
var genObj = {
    status  : 'OK',
    message : 'Operation completed successfully'
};

// Handles the main processing
function process(app) {
    
    // Handler for the admin creation
    app.post('/admins', function(request, response, next) {
        checkSecure(request);

        var admin = request.body;

        // We need to be forgiving on the access token here
        var token = (request.query.access_token === undefined) ? '' : request.query.access_token;
        
        // Let's validate the object
        if (admin.username !== undefined && admin.password !== undefined) {
            
            // Let's create the admin
            database.insertAdmin(token, admin.username, admin.password, function(result) {
                if (result.success) {
                    response.json(genObj);  
                } else {
                    softError(result.status, result.message, response);
                }
            });
        } else {

            // Not valid :(
            functions.sendError('INVPOST', 'Invalid POST data');
        }
    });

    // Handler for admin authentication
    app.post('/admins/token', function(request, response, next) {
        checkSecure(request);

        var admin = request.body;

        // Validation comes first
        if (admin.username !== undefined && admin.password !== undefined) {
            
            // Check for login
            database.adminAuth(admin.username, admin.password, function(result) {
                if (result.success) {
                    delete result.success;
                    response.json(result);
                } else {
                    softError(result.status, result.message, response);
                }
            });
        } else {
            
            // POST data not valid
            functions.sendError('INVPOST', 'Invalid POST data');
        }
    });

    app.post('/books', function(request, response, next) {
        checkSecure(request);

        var book = request.body;

        // We're strict on the token here
        if (request.query.access_token !== undefined) {
            var token = request.query.access_token;

            // We need to validate the fields, this will be long /sigh
            // TODO: Find a shorter way of validating
            if (book.title !== undefined &&
                book.description !== undefined &&
                book.author_id !== undefined &&
                book.download_url !== undefined) {
                
                // It's valid
                database.insertBook(token, book, function(result) {
                    if (result.success) {
                        delete result.success;
                        response.json(result);
                    } else {
                        softError(result.status, result.message, response);
                    }
                });
            } else {
                
                // NOTE TO SELF: uncatched 'else' could lead to a hang
                functions.sendError('INVPOST', 'Invalid POST data');
            }
        } else {
        
            // No token
            functions.sendError('NOTKN', 'No token parameter supplied');
        }
    });

    // Catch every other paths
    app.all('*', function(request, response, next) {
        functions.sendError('BADREQ', 'Bad request');
    });

    // Error level #1 (custom errors)
    app.use(functions.processError);

    // Error level #2 (server errors)
    app.use(functions.processError);
}

// Mongo is quite sensitive in throws
function softError(code, message, response) {
    var error = {
        status  : code,
        message : message
    };

    response.json(error);
}

// For those that needs HTTPS
function checkSecure(request) {
    if (!request.secure) functions.sendError('HTTPSREQ', 'HTTPS is required for this method');
}

// Export needed functions
exports.process = process;
