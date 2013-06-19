Bookworm API
============

API for book repository, written in node.js

### Dependencies
* node.js (0.10.x)
* mongodb

### Required node modules
* express
* cron
* mongojs
* forever (optional -- If you want to daemonize the node application)

### Setup

Before starting, dependencies and modules must first be installed. Generate the necessary keys for HTTPS to work.

    mkdir keys
    cd keys
    openssl genrsa -out server-key.pem 1024
    openssl req -new -key server-key.pem -out server-csr.pem
    openssl x509 -req -in server-csr.pem -signkey server-key.pem -out server-cert.pem

**Please Note**: See the API call for /admins regarding admin creation

Demo API URL: http://node.ruel.me

API Reference
-----------------

### POST /admins
**HTTPS Required**. Creates a new administrator.

##### GET Parameters
* `access_token` -  Administrator token to recognize privilege. **NOTE**: In case of an empty database, this field can be omitted.

##### POST Parameters
* `username` - Username of the administrator to be created
* `password` - Password of the administrator to be created

##### Example
    https://node.ruel.me/admins
    
##### POST Data
    {
        "username" : "admin",
        "password" : "password"
    }

##### Output
    {
      "status": "OK",
      "message": "Operation completed successfully"
    }
    
### POST /admins/token
**HTTPS Required**. Retrieves a new administrator `access_token`.

##### POST Parameters
* `username` - Username of the administrator
* `password` - Password of the administrator

##### Example
    https://node.ruel.me/admins/token

##### POST Data
    {
        "username" : "admin",
        "password" : "password"
    }

##### Output
    {
      "status": "OK",
      "message": "Operation completed successfully",
      "data" : {
        "access_token" : "663ca8582b5cac6735409a960b2ed43d"
      }
    }

### POST /users/token
**HTTPS Required**. Retrieves a new user-level token.

##### POST Parameters
* `fb_token` - Valid Facebook access token
* `fb_id` - Facebook ID matching the Facebook access token

##### Example
    https://node.ruel.me/users/token

##### POST Data
    {
        "fb_token" : "CAACEdEose0cBAC4ebFclvDMzc1eKCa3Qf0baG2bYT8qxYqTqC1FGbfSj7ZCLLMnCP71isJayzZChYBzc5ZBxrTRk2VOsirg2jUDkcoLo4kaX6ee2dJo3SFPpADPR5SWgIxJt7ZBhsi1cNmdInoYww6I0oifI5kdyJHcP0eMBugZDZf",
        "fb_id" : "1269185054"
    }

### GET /books
Retrieves an array of all books

##### Parameters
* `searchby` (optional) - Required if `keyword` is present - Specifies the field name where to look at. Valid values are:
    * `title`
    * `description`
* `keyword` (optional) - Required if `searchby` is present - A string to search for.
* `sortby` (optional) - Required if `sortorder` is present - The field to sort. Default value is `date_created`. Valid values are:
    * `book_id`
    * `title`
    * `description`
    * `date_created`
    * `date_modified`
    * `year`
    * `view_count`
    * `download_count`
* `sortorder` (optional) - Required if `sortby` is present - Sorting order. Can be `asc` or `desc`. Default value is `asc`
* `fields` (optional) - Field names to include separated by comma. Default values are `book_id` and `title`. Valid values are:
    * `book_id`
    * `title`
    * `description`
    * `download_url`
    * `download_count`
    * `view_count`
    * `cover_image_url`
    * `date_modified`
    * `date_created`
    * `year`
    * `tags`
    * `authors`
* `tag` (optional) - Filters books under specified tag
* `author` (optional) - Filters books by specified author
* `offset` (optional) - Starting index where to begin showing results. Default value is `0`.
* `limit` (optional) - Limit of the number of results per page. Default value is `20`.

##### Example
    http://node.ruel.me/books?limit=3&searchby=title&keyword=life&sortby=title&sortorder=asc

##### Output
    {
      "status": "OK",
      "message": "Operation completed successfully",
      "has_next": true,
      "has_prev": false,
      "data": [
        {
          "book_id": "51b95eb41cc68a683f000005",
          "title": "World of Ryyah: Kerala, and Akenji's Adventure"
        },
        {
          "book_id": "51b95ee81cc68a683f000049",
          "title": "World Of Ryyah: Birth Of The Half Elves"
        },
        {
          "book_id": "51b95f461cc68a683f000073",
          "title": "Understanding Karate-do: A Guide to Unity of Body, Mind, and Soul"
        }
      ],
      "count": 16
    }

### POST /books
**HTTPS Required**. Creates a new book entry.

##### GET Parameters
* `access_token` - Administrator token to recognize privilege

##### POST Parameters
* `title` - Title of the book.
* `description` - Thorough information about the book.
* `download_url` - Link to the pdf/page of the e-book.
* `authors` - array of authors of the book.
* `tags` (optional) - An array of all tags related to the book.
* `cover_image_url` (optional) - Cover image of the books.
* `year` (optional) - Year when the book is published.

##### Example
    https://node.ruel.me/books?access_token=663ca8582b5cac6735409a960b2ed43d

##### POST data
    {
       "title":"101 Things To Know About Being An Introvert",
       "description":"Growing up my environment convinced me I was shy. I didn&#8217;t talk much, I liked to be on my own and I hated social gatherings and paries. As I grew older and became familiar with the term &#8216;introvert&#8217; I knew that I wasn&#8217;t shy but just an introvert. Many people belive that an introvert is a shy person but they are two different things.",
       "authors":[
          "Diane Corriette"
       ],
       "download_url":"http://www.getfreeebooks.com/wp-content/uploads/2012/06/101thingsbeinganintrovert.pdf",
       "cover_image_url":"http://www.getfreeebooks.com/wp-content/uploads/2012/06/whatisanintrovert.jpg",
       "tags":[
          "Short Stories"
       ]
    }

### Output
    {
       "status":"OK",
       "message":"Operation completed successfully.",
       "data":{
          "book_id":"51b95ecc1cc68a683f000026"
       }
    }

### GET /books/:book_id
Retrieves information based on specified `book_id`.

##### Parameters
* `fields` (optional) - Fields to display in the result. When ommitted, all fields are returned. Valid values are:
    * `book_id`
    * `title`
    * `description`
    * `download_url`
    * `download_count`
    * `view_count`
    * `cover_image_url`
    * `date_modified`
    * `date_created`
    * `year`
    * `tags`
    * `authors`

##### Example
    http://node.ruel.me/books/51b95ecc1cc68a683f000026

##### Output
    {
      "status": "OK",
      "message": "Operation completed successfully",
      "data": {
        "authors": [
          "Diane Corriette"
        ],
        "cover_image_url": "http://www.getfreeebooks.com/wp-content/uploads/2012/06/whatisanintrovert.jpg",
        "date_created": 1371102924304,
        "date_modified": 1371605491393,
        "description": "Growing up my environment convinced me I was shy. I didn&#8217;t talk much, I liked to be on my own and I hated social gatherings and paries. As I grew older and became familiar with the term &#8216;introvert&#8217; I knew that I wasn&#8217;t shy but just an introvert. Many people belive that an introvert is a shy person but they are two different things.",
        "download_count": 0,
        "download_url": "http://www.getfreeebooks.com/wp-content/uploads/2012/06/101thingsbeinganintrovert.pdf",
        "rating_average": 3.5,
        "tags": [
          "Short Stories"
        ],
        "title": "101 Things To Know About Being An Introvert",
        "view_count": 484,
        "year": "",
        "book_id": "51b95ecc1cc68a683f000026"
      }
    }

### PATCH /books/:book_id
**HTTPS Required**. Updates a certain book specified by it's id.

##### GET Parameters
* `access_token` - Administrator token to recognize privilege

##### PATCH Parameters
* `title` (optional) - Title of the book.
* `description` (optional) - Thorough information about the book.
* `download_url` (optional) - Link to the pdf/page of the e-book.
* `authors` (optional) - array of authors of the book.
* `tags` (optional) - An array of all tags related to the book.
* `cover_image_url` (optional) - Cover image of the books.
* `year` (optional) - Year when the book is published.

##### Example
    https://node.ruel.me/books/51b95ecc1cc68a683f000026?access_token=663ca8582b5cac6735409a960b2ed43d

##### PATCH Data
    {
        "title" : "100 Things To Know About Being An Introvert"
    }

##### Output
    {
      "status": "OK",
      "message": "Operation completed successfully"
    }

### DELETE /books/:book_id
**HTTPS Required**. Removes specified book

##### GET Parameters
* `access_token` - Administrator token to recognize privilege
    
##### Example
    https://node.ruel.me/books/51b95ecc1cc68a683f000026?access_token=663ca8582b5cac6735409a960b2ed43d

##### Output
    {
      "status": "OK",
      "message": "Operation completed successfully"
    }


### GET /books/:book_id/reviews
Get reviews of a specific book

##### Example
    http://node.ruel.me/books/51b95ecc1cc68a683f000026/reviews

##### Output
    {
      "status": "OK",
      "message": "Operation completed successfully",
      "data": {
        "book_id": "51b95ecc1cc68a683f000026",
        "review_count": 2,
        "reviews": [
          {
            "uid": "1269185054",
            "rating": "5",
            "comment": "Boo yeah!",
            "date_created": 1371372714151
          },
          {
            "uid": "1848653481",
            "rating": "2",
            "comment": "Boo yeah too!",
            "date_created": 1371434929509
          }
        ]
      }
    }


### POST /books/:book_id/reviews
**HTTPS Required**. Creates a new review for a book

##### GET Parameters
* `access_token` - Administrator token to recognize privilege

##### POST Parameters
* `rating` - A number (from one to five) that represents the rating of the user
* `comment` - The comment to be associated with the rating.

##### Example
    https://node.ruel.me/books/51b95ecc1cc68a683f000026/reviews?access_token=2713c551aa2a9270ad35646ac96613b8

##### POST Data
    {
        "rating" : 5,
        "comment" : "This is awesome!"
    }

##### Output
    {
      "status": "OK",
      "message": "Operation completed successfully"
    }
    
### DELETE /books/:book_id/reviews/:uid
**HTTPS Required**. Deletes specified review by user

##### GET Parameters
* `access_token` - Administrator token to recognize privilege


##### Example
    https://node.ruel.me/books/51b95ecc1cc68a683f000026/reviews/1269185054?access_token=2713c551aa2a9270ad35646ac96613b8


##### Output
    {
      "status": "OK",
      "message": "Operation completed successfully"
    }

### GET /tags
Retrieves an array with distinct tags

##### Example
    http://node.ruel.me/tags

##### Output
    {
      "status": "OK",
      "message": "Operation completed successfully",
      "data": [
        "Adult",
        "Adventure",
        "Classic Literature",
        "Computers and Technology",
        "Cooking and Recipes",
        "Crafts"
      ]
    }

### GET /authors
Retrieves an array with distinct authors

##### Example
    http://node.ruel.me/authors

##### Output
    {
      "status": "OK",
      "message": "Operation completed successfully",
      "data": [
        "Adam Alvarado",
        "Adam Kosloff",
        "Adrian Plitzco",
        "Akash kumar",
        "Alim Kanoukoev",
        "Amanda Lawrence Auverigne",
        "Amber Libra",
        "Amy Welborn",
        "Zelimir Komadina"
      ]
    }

Architecture Summary
--------------------

* All API output, including errors and results, are 100% JSON.

* The user base is dependent on Facebook, which can be a disadvantage when Facebook goes down.
Nevertheless, this provides painless authentication without signups, and valid (almost) user data.

* Administrators can be created without an access token for the first time (empty admins collection).

* Requests with sensitive data should be using https, thought it can be configured by removing the `checkSecure()`
functions in `payload.js`. It's still a major factor when it comes to packet sniffers (https provides encryption).

* Application and server level errors are handled in express. Dependent errors (caused by dependencies and environment
are not handled


Performance
-----------

* Caching (memory resident) is implemented on database functions (mostly on `database.js`)
* Current set-up (on AWS Micro Instance) gives ~9900 transactions per seconds in /books



