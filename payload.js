/*
 * payload.js
 */

// We need this for our database
var database = require(__dirname + '/database.js');
var functions = require(__dirname + '/functions.js');
var cron = require('cron').CronJob;

// We need this object as template
var genObj = {
    status  : 'OK',
    message : 'Operation completed successfully'
};

// Views cache
// Writing to the database on every view is
// (I think) unhealthy
var views = [];
var down = [];

// Handles the main processing
function process(app) {

    // Get all authors
    app.get('/authors', function(request, response) {
        
        // Straightforward as before
        database.getAuthors(function(result) {
            delete result.success;
            response.json(result);
        });
    });

    // Get all tags
    app.get('/tags', function(request, response) {
        
        // Pretty straightforwards here
        database.getTags(function(result) {
            delete result.success;
            response.json(result);
        });
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

    // Update a book
    app.patch('/books/:id', function(request, response) {
        checkSecure(request);

        var id = request.params.id;
        var data = request.body;

        // Check the token, decline if none
        if (request.query.access_token !== undefined) {
            var token = request.query.access_token;

            // Let's update
            database.updateBook(token, id, data, function(result) {
                if (result.success) {
                    delete result.success;
                    response.json(result);
                } else {
                    softError(result.status, result.message, response);
                }
            });
        } else {
            
            // No token
            functions.sendError('NOTKN', 'No token parameter supplied');
        }
    });

    // Get books, sort, search, and many more. :(
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
            tag         :   '',
            author      :   '',
            offset      :   0
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

        // Check if there's a tag search
        if (query.tag !== undefined) {
            
            // Set the tag
            options.tag = query.tag;
        }

        // Check for author search
        if (query.author !== undefined) {
            
            // Set author option
            options.author = query.author;
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

    // Gets a specific link, and invokes the download count
    app.get('/books/:id/download_link', function(request, response) {
        
        var id = request.params.id;

        // Get download link
        database.getDownLink(id, function(result) {
            if (result.success) {
                delete result.success;

                // Adding the views handler here
                // We want that before a successful return of the books
                var found = false;
                var nd = 0;
                for (var i in down) {
                    if (down[i]._id === result.data.book_id.toString()) {
                        found = true;
                        down[i].down++;
                        nd = down[i].down;
                        break;
                    }
                }

                if (!found) {
                    var d = {
                        _id : result.data.book_id.toString(),
                        down : 1
                    };
                    down.push(d);
                }

                response.json(result);
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
                
                // Adding the views handler here
                // We want that before a successful return of the books
                var found = false;
                var nv = 0;
                var nd = 0;

                for (var i in views) {
                    if (views[i]._id === result.data.book_id.toString()) {
                        found = true;
                        views[i].views++;
                        nv = views[i].views;
                        break;
                    }
                }

                for (var i in down) {
                    if (down[i]._id === result.data.book_id.toString()) {
                        nd = down[i].down;
                        break;
                    }
                }

                if (!found) {
                    var v = {
                        _id : result.data.book_id.toString(),
                        views : 1
                    };
                    nv = 1;
                    views.push(v);
                }

                if (result.data.view_count !== undefined) {
                    result.data.view_count = nv;
                }

                if (result.data.download_count !== undefined) {
                    result.data.download_count = nd;
                }
                
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

    // Authenticating users
    app.post('/users/token', function(request, response) {
        checkSecure(request);

        // Verify the fb_token and the user id
        if (request.body.fb_token !== undefined &&
            request.body.fb_id !== undefined) {
            var fbtoken = request.body.fb_token;
            var fbid = request.body.fb_id;

            // Query and validate the token
            database.authUser(fbtoken, fbid, function(result) {
                if (result.success) {
                    delete result.success;
                    response.json(result);
                } else {
                    softError(result.status, result.message, response);
                }
            });
        } else {
            
            // No FB token / FB id
            functions.sendError('FBTKNIDERR', 'No Facebook access token or id specified');
        }
    });

    // Handler for getting all reviews
    app.get('/books/:id/reviews', function(request, response) {
        
        var book_id = request.params.id;

        // Pull reviews from database
        database.getReviews(book_id, function(result) {
            if (result.success) {
                delete result.success;
                response.json(result);
            } else {
                softError(result.status, result.message, response);
            }
        });
    });

    // Deleting a review
    app.delete('/books/:id/reviews/:uid', function(request, response) {
        checkSecure(request);

        // Validate the token again
        if (request.query.access_token !== undefined) {
            var token = request.query.access_token;
            var book_id = request.params.id;

            // Let's do the posting
            database.removeReview(token, book_id, function(result) {
                if (result.success) {
                    delete result.success;
                    response.json(result);
                } else {
                    softError(result.status, result.message, response);
                }
            });
        } else {

            // Invalid access token
            functions.sendError('NOTKN', 'No access token specified');
        }
    });
        
    // Posting a review
    app.post('/books/:id/reviews', function(request, response) {
        checkSecure(request);

        // Validate the token first
        if (request.query.access_token !== undefined) {
            var token = request.query.access_token;
            var book_id = request.params.id;

            // Validate fields
            if (request.body.rating !== undefined &&
                request.body.comment !== undefined) {

                request.body['book_id'] = book_id;

                // Let's do the posting
                database.addReview(token, request.body, function(result) {
                    if (result.success) {
                        delete result.success;
                        response.json(result);
                    } else {
                        softError(result.status, result.message, response);
                    }
                });
            } else {
                
                // Invalid POST data
                functions.sendError('INVPOST', 'Invalid POST data');
            }
        } else {

            // Invalid access token
            functions.sendError('NOTKN', 'No access token specified');
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

// Cron job for views and downloads
new cron('10/* * * * *', function() {

    // If our cache is empty, fill in the values
    if (views.length === 0) {
        database.getViewCounts(function(v) {
            views.push(v);
        });
    } else {
        database.updateViews(views);
    }

    if (down.length === 0) {
        database.getDownCounts(function(d) {
            down.push(d);
        });
    } else {
        database.updateDown(down);
    }

}, null, true, null).start();

