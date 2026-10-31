const jwt = require('jsonwebtoken');

function requireAuth(role) {
  return (req, res, next) => {
    const authorization = req.get('authorization');
    const [scheme, token] = authorization ? authorization.split(' ') : [];

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Authentication is required.' });
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (typeof payload !== 'object' || !payload.sub || !payload.role) {
        return res.status(401).json({ message: 'The authentication token is invalid.' });
      }
      if (role && payload.role !== role) {
        return res.status(403).json({ message: 'You do not have permission to perform this action.' });
      }

      req.auth = { userId: payload.sub, role: payload.role };
      return next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ message: 'The authentication token is invalid or expired.' });
      }
      return next(error);
    }
  };
}

module.exports = requireAuth;
