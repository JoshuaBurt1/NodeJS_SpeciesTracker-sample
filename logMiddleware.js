//Middleware to log the current route for both GET and POST requests
function logMiddleware(req, res, next) {
  console.log('Current Route: ' + req.originalUrl);
  res.locals.currentRoute = req.originalUrl; // Pass the route to the template
  next();
}

module.exports = logMiddleware;

