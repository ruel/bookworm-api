/*
 * database.js
 */

// Required package for mongo
var mongojs = require('mongojs');
var crypto = require('crypto');
var util = require('util');
var querystring = require('querystring');

// For the error sending
var functions = require(__dirname + '/functions.js');
var jsonreq = require(__dirname + '/jsonreq.js');

// Our collections, db variables and such
var collections = ['users', 'admins', 'books'];
var dbname = 'bookworm';

// Let's connect, shall we
var db = mongojs.connect(dbname, collections);

// This is for the result object
var result;

// Token expiration in milliseconds
// TODO: Is 30 minutes okay?
var expms = minToMs(30);

// Caching variables
var books_cache = [];
var book_cache = [];
var tags_cache = [];
var authors_cache = [];
var reviews_cache = [];

// Old cache for montiroing
o_views = [];
o_down = [];

// Getting download link
function getDownLink(book_id, callback) {
    resetResult();

    // Get a book with the id
    db.books.find({ _id : db.ObjectId(book_id) }).limit(1, function(error, books) {
        if (error) throw error;
       
        if (books.length > 0) {

            result['data'] = {
                book_id : books[0]._id,
                download_url : books[0].download_url
            };

            callback(result);
        } else {
            callback(formatResult('INVID', 'Book ID not found'));
        }
    });
}

// Updating downloads
function updateDown(down) {
    
    // Loop through each
    for (var i in down) {
        var stop = false;

        // We need to minimize the writes,
        // so let's check if there's a change first
        for (var o in o_down) {
            if (down[i]._id.toString() === o_down[o]._id.toString()) {
                if (down[i].down === o_down[o].down) {
                    stop = true;
                } else {
                    o_down[o].down = down[i].down; 
                }
            }
        }

        if (stop) continue;

        // Do the write
        db.books.update({ _id : db.ObjectId(down[i]._id) }, {
            $set : {
                download_count : down[i].down
            }
        });
    }
}
// Updating views
function updateViews(views) {
    
    // Loop through each
    for (var i in views) {
        var stop = false;

        // We need to minimize the writes,
        // so let's check if there's a change first
        for (var o in o_views) {
            if (views[i]._id.toString() === o_views[o]._id.toString()) {
                if (views[i].views === o_views[o].views) {
                    stop = true;
                } else {
                    o_views[o].views = views[i].views;
                }
            }
        }

        if (stop) continue;

        // Do the write
        db.books.update({ _id : db.ObjectId(views[i]._id) }, {
            $set : {
                view_count : views[i].views
            }
        });
    }
}

// Get all downloads
function getDownCounts(callback) {
    
    // Get all books
    db.books.find(function(error, data) {
        if (error) throw error;

        for(var i in data) {
            var d = {
                _id : data[i]._id.toString(),
                down : data[i].download_count
            }

            callback(d);
            o_down.push(d);
        }
    });
}

// Get all views
function getViewCounts(callback) {
    
    // Get all books
    db.books.find(function(error, data) {
        if (error) throw error;

        for(var i in data) {
            var v = {
                _id : data[i]._id.toString(),
                views : data[i].view_count
            }
            callback(v);
            o_views.push(v);
        }
    });
}
// Get all the authors
function getAuthors(callback) {
    resetResult();

    // Check if cache is empty
    if (authors_cache.length < 1) {

        // Let's get all distinct values
        db.books.distinct('authors', function(error, authors) {
            if (error) throw error;

            result['data'] = authors.sort();
            authors_cache.push(JSON.stringify(result));
            callback(result);
        });
    } else {

        // Return the cache
        callback(JSON.parse(authors_cache[0]));
    }
    
}

// Get all the tags
function getTags(callback) {
    resetResult();

    // Check if cache is empty
    if (tags_cache.length < 1) {

        // Let's get all distinct values
        db.books.distinct('tags', function(error, tags) {
            if (error) throw error;

            result['data'] = tags.sort();
            tags_cache.push(JSON.stringify(result));
            callback(result);
        });
    } else {
        callback(JSON.parse(tags_cache[0]));
    }
}

// Delete reviews
function removeReview(token, book_id, callback) {
    resetResult();

    // Validate
    validateUserToken(token, function(valid, uid) {
        
        if (valid) {

            // Again, verify the book
            db.books.find({ 
                _id : db.ObjectId(book_id),
                reviews : {
                    $elemMatch : {
                        uid : uid
                    }
                }
            }).limit(1, function(error, data) {
                if (error) throw error;

                // Check if valid book
                if (data.length > 0) {

                    // Pull the review
                    db.books.update({ _id : db.ObjectId(book_id) }, {
                        $pull : {
                            reviews : {
                                uid : uid
                            }
                        }
                    }, function(error, count) {
                        if (error) throw error;
                        
                        // Rating average
                        var rate_ave = 0;

                        // Make it 0 if there's no review left                        
                        if (count === 0 || data[0].reviews.length > 1) {
                            var rate_sum = 0;

                            for (var i in data[0].reviews) {
                                if (data[0].reviews[i].uid !== uid)
                                    rate_sum += parseInt(data[0].reviews[i].rating);
                            }

                            rate_sum += parseInt(review.rating);
                            rate_ave = rate_sum / (data[0].reviews.length + (1 - count));
                        }

                        // Now, we can update the rating average
                        db.books.update({ 
                            _id : db.ObjectId(book_id) 
                        }, {
                            $set : {
                                rating_average : rate_ave
                            }
                        }, function(erroru) {
                            if (erroru) throw erroru;
                            
                            // Clear the cache again
                            books_cache = []

                            // Clear reviews cache
                            for (var i in reviews_cache) {
                                if (reviews_cache[i].hash === book_id) {
                                    delete reviews_cache[i];
                                }
                            }

                            // And for specific books
                            for (var i in book_cache) {
                                if (book_cache[i].hash.indexOf(book_id) === 0) {
                                    delete book_cache[i];
                                }
                            }

                            // At last
                            callback(result);
                        });
                    });
                } else {
                
                    // Nope
                    callback(formatResult('INVREV', 'Review does not exist'));
                }
            });
        } else {
        
            // Not valid
            callback(formatResult('INVTOKEN', 'User token not valid'));
        }
    });
}

// Get reviews of specific book
function getReviews(book_id, callback) {
    resetResult();

    // Hash again
    var hash = book_id;
    var found = false;

    // Check the cache
    for (var i in reviews_cache) {
        if (hash === reviews_cache[i].hash) {
            callback(JSON.parse(reviews_cache[i].result));
            found = true;
            break;
        }
    }

    // Generate cache if not found
    if (!found) {

        // Verify the book
        db.books.find({ _id : db.ObjectId(book_id) })
                .limit(1, function(error, data) {
            if (error) throw error;
            
            // Check if it's a valid book id
            if (data.length > 0) {
                
                var reviews = data[0].reviews;

                // Format the result
                result['data'] = {
                    book_id : data[0]._id,
                    review_count : data[0].reviews.length,
                    reviews : reviews
                };

                // Push the cache
                reviews_cache.push({ hash : hash, result : JSON.stringify(result) });

                // Return the results
                callback(result);
            } else {
            
                // Nope
                callback(formatResult('NOTFOUND', 'Book id not found'));
            }
        });
    }
}

// Validating user token
function validateUserToken(token, callback) {
    db.users.find({ token : token, token_exp : { $gt : Date.now() } })
            .limit(1, function(error, data) {
        if (error) throw error;

        // Check if a record exist
        if (data.length > 0) {
            callback(true, data[0].uid);
        } else {
            callback(false);
        }
    });
}

// Adding reviews
function addReview(token, review, callback) {
    resetResult();
    
    // Verify the token
    // Incoming nested async functions
    validateUserToken(token, function(valid, uid) {

        if (valid) {
            
            // Let's query for the book next
            // But then this time, we should check
            // Only those with no uid matching our uid
            db.books.find({ 
                _id : db.ObjectId(review.book_id),
                reviews : {
                    $not : {
                        $elemMatch : {
                            uid : uid
                        }
                    }
                }
            }).limit(1, function(errorb, books) {
                if (errorb) throw errorb;

                if (books.length > 0) {
                     
                    // Rating average
                    var rate_ave = 0;
                    var rate_sum = 0;

                    for (var i in books[0].reviews) {
                        rate_sum += parseInt(books[0].reviews[i].rating);
                    }

                    rate_sum += parseInt(review.rating);
                    rate_ave = rate_sum / (books[0].reviews.length + 1);

                    // Now, we can update the reviews collection
                    db.books.update({ 
                        _id : db.ObjectId(review.book_id) 
                    }, {
                        $push : {
                            reviews : {
                                uid : uid,
                                rating : review.rating,
                                comment : review.comment,
                                date_created : Date.now()
                            }
                        },
                        $set : {
                            rating_average : rate_ave
                        }
                    }, function(erroru) {
                        if (erroru) throw erroru;
                            
                        // Clear the cache again
                        books_cache = []

                        // Clear reviews cache
                        for (var i in reviews_cache) {
                            if (reviews_cache[i].hash === book_id) {
                                delete reviews_cache[i];
                            }
                        }

                        // And for specific books
                        for (var i in book_cache) {
                            if (book_cache[i].hash.indexOf(book_id) === 0) {
                                delete book_cache[i];
                            }
                        }

                        // Finally
                        callback(result);
                    });
                } else {
                    
                    // There's no such book
                    callback(formatResult('REVERR', 'Review for the specific user already posted'));
                }
            });
        } else {
            
            // Invalid user token
            callback(formatResult('INVTOKEN', 'Invalid user token'));
        }
    });
}

// Authenticate the user
// We don't have signups, so we'll just upsert here
function authUser(fb_token, uid, callback) {
    resetResult();

    // Here, we'll query the /me from Graph API
    // And return the id of the facebook user
    // Then check it with the passed id for validation
    jsonreq.get('graph.facebook.com', '/me', { 
        access_token : fb_token 
    }, true, function(data) {
        if (data.error === undefined) {
            if (data.id === uid) {
                
                // We got a match!
                // Generate a token
                var token = generateToken(uid);
                var token_exp = Date.now() + expms;

                // Upsert to the database
                db.users.update( { uid : uid }, { $set : {
                        uid         :   uid,
                        token       :   token,
                        token_exp   :   token_exp
                    }
                }, { upsert : true }, function() {
                    
                    // Append the access token
                    result['data'] = {
                        access_token        :   token,
                        access_token_exp    :   token_exp
                    };
                                        
                    // Success!
                    callback(result);
                });
            } else {
                
                // No match, return an error
                callback(formatResult('TOKMISM', 'Facebook access token mismatch'))
            }
        } else {
            
            // Probably token is invalid
            callback(formatResult('INVFBTOKEN', 'Invalid Facebook access token'));
        }
    });
}

// Updating a book
function updateBook(token, id, book, callback) {
    resetResult();

    // Validate again
    validateAdminToken(token, function(valid) {
        
        if (valid) {
        
            // Let's find first
            db.books.find({ _id : db.ObjectId(id) }).limit(1, function(error, data) {
                if (error) throw error;

                if (data.length > 0) {

                    // Remove unnecessary fields
                    delete book.book_id;
                    delete book._id;

                    // Validate the fields
                    var dfields = Object.keys(data[0]);
                    var bfields = Object.keys(book);
                    for (var i in bfields) {
                        var found = false;

                        // Check if it exist on the data fields
                        for (var x in dfields) {
                            if (bfields[i] === dfields[x]) {
                                found = true;
                                break;
                            }
                        }

                        
                        // Delete if they are not found
                        if (!found)
                            delete book[bfields[i]];
                    }
                   
                    // Update date_modified
                    book['date_modified'] = Date.now();
                    
                    // Construct the object
                    update = { $set : book };

                    // Do the update
                    db.books.update({ _id : db.ObjectId(id) }, update, function(error, data) {
                        if (error) throw error;

                        callback(result);

                        // Clear other cache
                        tags_cache = [];
                        authors_cache = [];
                        books_cache = [];

                        // Clear cache for id
                        for (var i in book_cache) {
                            if (book_cache[i].hash.indexOf(id) === 0) {
                                delete book_cache[i];
                            }
                        }
                    });
                } else {
                    
                    // ID not found
                    callback(formatResult('IDNOTFOUND', 'Specified book id was not found'));
                }
            });
        } else {
            
            // Invalid token
            callback(formatResult('TOKENERR', 'Invalid access_token'));
        }
    });
}

// Delete a book
function deleteBook(token, id, callback) {
    resetResult();

    // Check for valid token
    validateAdminToken(token, function(valid) {
        
        if (valid) {

            // Find the book
            db.books.find({ _id : db.ObjectId(id) }).limit(1, function(error, data) {
                    if (error) throw error;

                // Just to make sure it's a valid book
                if (data.length > 0) {
                    
                    // Let's delete it!
                    db.books.remove( { _id : db.ObjectId(id) }, function(error) {
                        if (error) throw error;

                        // Clear other cache
                        books_cache = [];
                        tags_cache = [];
                        authors_cache = [];

                        // Clear cache for id
                        for (var i in book_cache) {
                            if (book_cache[i].hash.indexOf(id) === 0) {
                                delete book_cache[i];
                            }
                        }

                        callback(result);
                    });
                } else {
                    
                    // Nope not valid id
                    callback(formatResult('NOTFND', 'Book not found'));
                }
            });

        } else {
            
            // Token not valid
            callback(formatResult('TOKENERR', 'Invalid access token'));
        }
    });
}

// Get all books
function getBooks(options, callback) {
    resetResult();

    // Get a hash for uniqueness in cache
    var hash = doMd5(JSON.stringify(options));
    var found = false;

    // Look for hash in cache
    for (var i in books_cache) {
        if (hash === books_cache[i].hash) {
            callback(JSON.parse(books_cache[i].result));
            found = true;
            break;
        }
    }

    // Generate a cache if not found
    if (!found) {

        // Book array
        var books = [];

        // Sorting query
        var sort = {};
        sort[options.sortby] = options.sortorder === 'asc' ? 1 : -1;

        // Searching, somewhat like the hard part of optimization
        var query = {};

        // Check if there's a search performed
        if (!options.all) {

            // Escape keyword
            var keyword = options.keyword
                                 .replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g,
                                         "\\$&");
            
            // Create query object
            query[options.searchby] = { $regex : keyword, $options : 'i' };
        }

        // Check for a tag search
        if (options.tag.length > 0) {
            
            // Rebuild the query
            query['tags'] = options.tag;
        }

        // We need this same as tags
        if (options.author.length > 0) {
            query['authors'] = options.author;
        }

        db.books.count(query, function(error, count) {
            if (error) throw error;

            // For unlimited
            var nlimit = options.limit <= 0 ? options.limit : options.limit + 1;

            // Get all books in the database
            db.books.find(query).skip(options.offset).limit(nlimit).sort(sort, function(error, data) {
                books = [];

                // Get the length, if it's limit + 1, then we have a next page
                var len = data.length;
                
                for (var i in data) {
                    delete data[i].reviews;

                    // Replace _id with book_id
                    data[i]['book_id'] = data[i]._id;
                    delete data[i]._id;

                    var filtered = {};

                    // Then we need to filter the fields
                    for (var x in options.fields) {
                        filtered[options.fields[x]] = data[i][options.fields[x]];
                    }
                    
                    // Re-assign the filetered data
                    books.push(filtered);
                }

                // Pop the extra
                if (len > options.limit) {
                    books.pop();

                    result['has_next'] = true;
                } else {
                    result['has_next'] = false;
                }

                // Append prev validator
                if (options.offset <= 0) {
                    result['has_prev'] = false;
                } else {
                    result['has_prev'] = true;
                }

                // Add books array
                result['data'] = books;

                result['count'] = count;

                books_cache.push({ hash: hash, result: JSON.stringify(result) });
                callback(result);
            });
        });
    }
}

// Get specific book
function getBook(id, fields, callback) {
    resetResult();

    // We need to hash the fields + id
    var hash = id + doMd5(id + JSON.stringify({ fields : fields }));
    var found = false;

    // Then let's look for the hash in the cache
    for (var i in book_cache) {
        if (hash === book_cache[i].hash) {
            callback(JSON.parse(book_cache[i].result));
            found = true;
            break;
        }
    }

    // Generate if not found
    if (!found) {

        // Look for our book
        db.books.find({ _id : db.ObjectId(id) }).limit(1, function(error, data) {
            if (error) throw error;

            var book = {};

            // Check if there's a record
            if (data.length > 0) {
                
                // Filter fields
                if (fields.length > 0) {

                    // Filter per field
                    for (var i in fields) {
                        if (fields[i] === 'book_id')
                            fields[i] = '_id';
                        book[fields[i]] = data[0][fields[i]];
                    }
                } else {
                    
                    // Return all
                    book = data[0];
                }

                // Rename the id
                book['book_id'] = book['_id'];
                delete book._id;

                // Remove reviews, if any
                if (book.reviews !== undefined)
                    delete book.reviews;
                 
                // Add book to the result
                result['data'] = book;
                
                // Push result to cache
                book_cache.push({ hash : hash, result : JSON.stringify(result) });
                callback(result);
            } else {
                
                // ID doesn't exist
                callback(formatResult('INVID', 'Book not found'));
            }
        });
    }
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

            // Let's save
            db.books.save(book, function(error, data) {
                if (error) throw error;
                
                // Update the token expiration
                updateTokenExp(token);

                // We should include the book id on the result
                result['data'] = {
                    book_id : data._id
                };
                
                // Clear cache
                books_cache = [];
                tags_cache = [];
                authors_cache = [];
                callback(result);
            });
        } else {
            
            // Token not valid
            callback(formatResult('INVTOKEN', 'Token not valid'));
        }
    });
}

// Checks for admin authentication, and returns a token
function adminAuth(username, password, callback) {
    resetResult();

    // Let's hash the password
    var hash = doMd5(password);

    db.admins.find({ _id : username, password : hash }).limit(1, function(error, data) {
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
    db.admins.find({ token : token, token_exp : { $gt : Date.now() } })
             .limit(1, function(error, data) {
        if (error) throw error;

        // Length will return 1 if there's a token
        // Or the token is not yet expired
        if (data.length > 0) {
            callback(true);
        } else {
            callback(false);
        }
    });
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
exports.getBooks = getBooks;
exports.getBook = getBook;
exports.getReviews = getReviews;
exports.getTags = getTags;
exports.getAuthors = getAuthors;

exports.getDownLink = getDownLink;

exports.getViewCounts = getViewCounts;
exports.getDownCounts = getDownCounts;
exports.updateViews = updateViews;
exports.updateDown = updateDown;

exports.addReview = addReview;
exports.removeReview = removeReview;
exports.authUser = authUser;

exports.updateBook = updateBook;
exports.deleteBook = deleteBook;
exports.insertBook = insertBook;
exports.insertAdmin = insertAdmin;
exports.adminAuth = adminAuth;
