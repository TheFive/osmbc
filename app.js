var express      = require('express');
var path         = require('path');
var favicon      = require('serve-favicon');
var logger       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');
var passport     = require('passport');
var session = require('express-session');
 
var  OpenStreetMapStrategy = require('passport-openstreetmap').Strategy;

var routes = require('./routes/index');
var users = require('./routes/users');
var article = require('./routes/article');

var OPENSTREETMAP_CONSUMER_KEY = "oxzBk3Y2B6ZQjdu3r7o7pibQSSNHlzllG6v9iZUD"
var OPENSTREETMAP_CONSUMER_SECRET = "4nEEHKcQ9xSrMTQRJZjYjSHDVvKZHgF6ZZO31t3z";

// taken from: https://github.com/jaredhanson/passport-openstreetmap/blob/master/examples/login/app.js
// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete OpenStreetMap profile is
//   serialized and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

// taken from https://github.com/jaredhanson/passport-openstreetmap/blob/master/examples/login/app.js
// Use the OpenStreetMapStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a token, tokenSecret, and OpenStreetMap profile), and
//   invoke a callback with a user object.
passport.use(new OpenStreetMapStrategy({
    consumerKey: OPENSTREETMAP_CONSUMER_KEY,
    consumerSecret: OPENSTREETMAP_CONSUMER_SECRET,
    callbackURL: "http://127.0.0.1:3000/auth/openstreetmap/callback"
  },
  function(token, tokenSecret, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      
      // To keep the example simple, the user's OpenStreetMap profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the OpenStreetMap account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
    });
  }
));

function ensureAuthenticated(req, res, next) {

  if (req.isAuthenticated()) { 
    req.locals.user = req.user.displayName;

    return next(); }
  res.redirect('/auth/openstreetmap')
}


var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');



// take from https://github.com/jaredhanson/passport-openstreetmap/blob/master/examples/login/app.js
app.use(session({ secret: 'osmbc_secret' ,resave:false,saveUninitialized:true}));
// Initialize Passport!  Also use passport.session() middleware, to support
// persistent login sessions (recommended).
app.use(passport.initialize());
app.use(passport.session());


app.get('/', function(req, res){
  res.render('index', { user: req.user });
});

app.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', { user: req.user });
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user });
});


// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));



// GET /auth/openstreetmap
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in OpenStreetMap authentication will involve redirecting
//   the user to openstreetmap.org.  After authorization, OpenStreetMap will redirect the user
//   back to this application at /auth/openstreetmap/callback
app.get('/auth/openstreetmap',
  passport.authenticate('openstreetmap'),
  function(req, res){
    // The request will be redirected to OpenStreetMap for authentication, so this
    // function will not be called.
  });

// GET /auth/openstreetmap/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/openstreetmap/callback', 
  passport.authenticate('openstreetmap', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.use(ensureAuthenticated);

app.use('/', routes);
app.use('/users', users);
app.use('/article', article);


// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.


// error handlers

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});


// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
