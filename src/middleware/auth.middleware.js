const jwt = require('jsonwebtoken');

function createAuthMiddleware(roles = ['user']) {
  return (req, res, next) => {

    const token = req.cookies.token || req.header('Authorization')?.replace('Bearer ', '');
    

    if (!token) {
      return res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      req.seller = decoded.id || decoded._id; // Set seller for controllers

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ success: false, error: 'Access denied. Insufficient permissions.' });
      }

      next();
    } catch (error) {
      res.status(400).json({ success: false, error: 'Invalid token.' });
    }
  };
}


module.exports = createAuthMiddleware;