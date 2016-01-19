var path         = require('path');

var express      = require('express');
var favicon      = require('serve-favicon');
var logger       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');

var debug = require('debug')('OSMBC:app');
var passport     = require('passport');
var OpenStreetMapStrategy 
                 = require('passport-openstreetmap').Strategy;

var session      = require('express-session');
var FileStore    = require('session-file-store')(session);


var debug        = require('debug')('OSMBC:app');

var config     = require('./config.js');

var index      = require('./routes/index').router;
var users      = require('./routes/users').router;
var article    = require('./routes/article').router;
var changes    = require('./routes/changes').router;
var blog       = require('./routes/blog').router;
var tool       = require('./routes/tool').router;
var layout     = require('./routes/layout').router;

var userModule = require('./model/user.js');

var mailReceiver = require('../notification/mailReceiver.js');



// Initialise config Module
config.initialise();
var htmlRoot = config.getValue("htmlroot");
console.log("Express Routes set to: SERVER"+htmlRoot);

// taken from: https://github.com/jaredhanson/passport-openstreetmap/blob/master/examples/login/app.js
// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete OpenStreetMap profile is
//   serialized and deserialized.
// in OSMBC only the displayName is relevant (as long as there is no user database)
// so this is enough for serialising.
// if there will be a user database, this has to be integrated here
passport.serializeUser(function(user, done) {
  debug("passport.serializeUser CB");
  done(null, user.displayName);
});

passport.deserializeUser(function(name, done) {
  debug("passport.deserializeUser CB");
  var user = {};
  user.displayName = name;
  done(null, user);
});

// taken from https://github.com/jaredhanson/passport-openstreetmap/blob/master/examples/login/app.js
// Use the OpenStreetMapStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a token, tokenSecret, and OpenStreetMap profile), and
//   invoke a callback with a user object.


passport.use(new OpenStreetMapStrategy({
    consumerKey: config.getConfiguration().OPENSTREETMAP_CONSUMER_KEY,
    consumerSecret: config.getConfiguration().OPENSTREETMAP_CONSUMER_SECRET,
    callbackURL: config.getCallbackUrl()
  },
  function(token, tokenSecret, profile, done) {
    debug('passport.use Token Function');
    // asynchronous verification, for effect...
    process.nextTick(function () {
      debug('passport.use Token Function->prozess.nextTick');
      
      // To keep the example simple, the user's OpenStreetMap profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the OpenStreetMap account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
    });
  }
));


/*passport.use(new Strategy(
  function(username, password, cb) {
    debug('Strategy')
    var user = {};
     user.displayName = "TheFive"
      console.log(username," ",password);
      if (username =="TheFive") {
        console.log("User OK");
        return cb(null,user);
      }

    
      return cb(null, false);
    })
  );*/

function checkAuthentification(req,res,next) {
  debug('checkAuthentification');

  // Route / checks for authentification, so nothing has to be done,
  // just check authentification.

  if (req.isAuthenticated()) return next();
  req.session.returnTo = req.originalUrl; 
  res.redirect(htmlRoot+'/auth/openstreetmap');
}

function ensureAuthenticated(req, res, next) {
  debug("ensureAuthenticated");

  if (req.isAuthenticated()) { 
    // check User
    userModule.find({OSMUser:req.user.displayName},function(err,result){
      debug('ensureAuthenticated->userFind');
      if (err) return next(err);
      if (result.length==1) {
        for (var k in result[0]) {
          req.user[k] = result[0][k];
        }
        debug("User found");
        if (result[0].access == "full") {
          // save last access, ignore save callback
          var date = new Date();
          var lastStore = new Date(result[0].lastAccess);
          if (!result[0].lastAccess || (date.getTime()-lastStore.getTime()) > 1000*60*2) {
            result[0].lastAccess = new Date();
            result[0].save(function(err) {console.log(err);});            
          }
          if (!req.session.language) req.session.language = result[0].language;
          debug("User accepted");
          return next();
        }
      }
      debug("User Not Found %s(found)",result.length);
      if (result.length > 1) {
        err = new Error('OSM User >'+req.user.displayName+'< exists multiple times');
      }
      if (result.length == 1) {
        err = new Error('OSM User >'+req.user.displayName+'< has no access rights');
      }
      if (result.length === 0) {
        err = new Error('OSM User >'+req.user.displayName+'< does not exist.');
      }
      return next(err);
    });
    return;
  }
  req.session.returnTo = req.originalUrl; 
  res.redirect(htmlRoot+'/auth/openstreetmap');

}
 

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon(path.join(__dirname , 'public','images','favicon.ico')));


// take from https://github.com/jaredhanson/passport-openstreetmap/blob/master/examples/login/app.js
app.use(session({ store: new FileStore(),
                  secret: 'LvwnH}uHhDLxvAu3X6' ,
                  resave:true,
                  saveUninitialized:true,
                  cookie:{_expires : 1000*60*60*24*365}}));
// Initialize Passport!  Also use passport.session() middleware, to support
// persistent login sessions (recommended).
app.use(passport.initialize());
app.use(passport.session());





// uncomment after placing your favicon in /public
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(htmlRoot,express.static(path.join(__dirname, 'public')));



// GET /auth/openstreetmap
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in OpenStreetMap authentication will involve redirecting
//   the user to openstreetmap.org.  After authorization, OpenStreetMap will redirect the user
//   back to this application at /auth/openstreetmap/callback
app.get(htmlRoot + '/auth/openstreetmap',
  //passport.authenticate('openstreetmap'),
  passport.authenticate('openstreetmap'),
  function(req, res){
    debug('never come here function!!!');
    debug(req);
    debug(res);
    // The request will be redirected to OpenStreetMap for authentication, so this
    // function will not be called.
  });

// GET /auth/openstreetmap/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get(htmlRoot + '/auth/openstreetmap/callback', 
  passport.authenticate('openstreetmap', { failureRedirect: '/login'  }),
  function(req, res) {
    debug('passport.authenticate Function');
    res.redirect(req.session.returnTo || '/');
    //res.redirect('/');
  });

app.get(htmlRoot + '/logout', function(req, res){
  debug('logoutFunction');
  req.logout();
  res.redirect('/');
});


// layout does not render, but prepares the res.rendervar variable fro
// dynamic contend in layout.jade
app.use(htmlRoot + '/',ensureAuthenticated,layout);
app.use(htmlRoot + '/',checkAuthentification,index);
app.use(htmlRoot + '/usert',checkAuthentification, users);
app.use(htmlRoot + '/article',checkAuthentification, article);
app.use(htmlRoot + '/changes',checkAuthentification, changes);
app.use(htmlRoot + '/blog',checkAuthentification, blog);
app.use(htmlRoot + '/tool',checkAuthentification, tool);


// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.


// error handlers

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  debug('app.use Error Handler');
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});


// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) { // jshint ignore:line
    debug('app.use Error Handler for Debug');
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err,
      layout:{htmlroot:htmlRoot}
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {// jshint ignore:line
  debug('app.use status function');
  debug(JSON.stringify(err));
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {},
    layout:{htmlroot:htmlRoot}
  });
});

// Initialise Mail Module with all users

userModule.find({access:"full"},function initUsers(err,result) {
  if (err) {
    console.log("Error during Mail Receiver Initialising");
    console.dir(err);
    return;
  }
  mailReceiver.initialise(result);
});


module.exports = app;
