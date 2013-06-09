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
            database.insertAdmin(token, admin.username, admin.password, function(success) {
                if (success) {
                    response.json(genObj);  
                } else {
                    functions.sendError('ADMERR', 'Cannot create administrator');
                }
            });
        } else {

            // Not valid :(
            functions.sendError('INVPOST', 'Invalid POST data');
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

// For those that needs HTTPS
function checkSecure(request) {
    if (!request.secure) functions.sendError('HTTPSREQ', 'HTTPS is required for this method');
}

// Export needed functions
exports.process = process;
