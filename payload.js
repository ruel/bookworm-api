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
    
    // Global
    app.all('/*', function(request, response, next) {
        response.setHeader('Access-Control-Allow-Origin', '*'); 
        next();
    });
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

    // Creating new books!
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
                book.authors !== undefined &&
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

    app.get('/books', function(request, response) {
        
        // We got handful of parameters to check
        // TODO: Embrace a module for this
        var query = request.query

        // Setup our defaults
        var options = {
            searchby    :   'title',
            all         :   true,
            keyword     :   '',
            sortby      :   'book_id',
            sortorder   :   'asc',
            fields      :   ['book_id', 'title'],
            limit       :   20,
            offset      :   0,
            fullurl     :   request.protocol + '://' + request.get('host') +
                            request.path,
            query       :   request.query
        };

        // Validate dependent parameters (searching)
        if (query.searchby !== undefined &&
            query.keyword !== undefined) {
            
            // Add them to options if they both exist
            options.searchby = query.searchby;
            options.keyword = query.keyword;

            // Special flag if this option is included
            options.all = false;
        }

        // Validate dependent parameters (sorting)
        if (query.sortby !== undefined &&
            query.sortorder !== undefined) {
        
            // Add them to options if again they both exist
            options['sortby'] = query.sortby;
            options['sortorder'] = query.sortorder;
        }

        // Check if fields exists, and not blank
        if (query.fields !== undefined &&
            query.fields.length !== 0) {

            // Split it if it's not, then trim each field
            // This is too long :(

            var fields = query.fields.split(',');

            for (var i in fields)
                fields[i] = fields[i].trim();

            // Then push it to options
            options['fields'] = fields;
        }

        // Validate offset and limit
        var limit = parseInt(query.limit);
        var offset = parseInt(query.offset);

        options.limit = !isNaN(limit) ? limit : options.limit;
        options.offset = !isNaN(offset) ? offset : options.offset;

        // TODO: Finish this first
        database.getBooks(options, function(result) {

            // Check result
            if (result.success) {
                delete result.success;
                response.json(result);
            } else {
                softError(result.status, result.message, response);
            }
        });
    });

    // Querying specific book
    app.get('/books/:id', function(request, response) {
        
        var id = request.params.id;

        // Check for the fields query parameter
        var fields = typeof request.query.fields === 'undefined' ?
                    [] : request.query.fields.split(',');

        // Trim each field
        for (var i in fields) {
            fields[i] = fields[i].trim();
        }
        
        // Get the book information
        database.getBook(id, fields, function(result) {

            // Check result
            if (result.success) {
                delete result.success;
                response.json(result);
            } else {
                softError(result.status, result.message, response);
            }
        });
    });

    // For deleting books
    app.delete('/books/:id', function(request, response) {
        checkSecure(request);
        
        // Check the token
        if (request.query.access_token !== undefined) {
            var token = request.query.access_token;
            var id = request.params.id;

            // Do the deletion
            database.deleteBook(token, id, function(result) {

                // Check result
                if (result.success) {
                    delete result.success;
                    response.json(result);
                } else {
                    softError(result.status, result.message, response);
                }
            });
        } else {

            // No token!
            functions.sendError('TKNERR', 'No access token specified');
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
