/*
 * functions.js
 */

// Setting the user id and group id
function setUser(uid, gid) {

    // If gid is not specified, it's uid
    gid = typeof gid !== 'undefined' ? gid : uid;
    
    process.setgid(gid);
    process.setuid(uid);
}

// Custom error codes are sent here
function sendError(code, message) {
    
    // Create our own error object
    var error = {
        validateMe  : true,
        status      : code,
        message     : message
    };

    // That's it, next step, throw it!
    throw error;
}

function processError(error, request, response, next) {
    
    // Check if error thrown is our error object
    if (error.validateMe === undefined) {
        
        // It isn't, so let's create our own
        // We want to log this error though
        console.error((new Date()).toString() + " [E] " + error);
        sendError('SERVERR', 'Internal Server Error');
    } else {
        
        // Let's recreate our object,
        // This way, we can strip unnecessary attributes
        var error = {
            status  : error.status,
            message : error.message
        };

        // Show the error to the client
        response.json(error);
    }
}


// Lets export our functions
exports.setUser         = setUser;
exports.sendError       = sendError;
exports.processError    = processError;
