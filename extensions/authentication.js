//reusable middleware function for authentication
//checks for an authenticated user (to prevent unauthorized users who go to link and try to delete, edit, add)
function IsLoggedIn(req,res,next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
  }
  module.exports = IsLoggedIn;
