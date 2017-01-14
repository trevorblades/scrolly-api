const jwt = require('jsonwebtoken');
const {TOKEN_SECRET} = require('../constants');

module.exports = function(passthrough) {
  return function(req, res, next) {
    let token;
    if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      if (!passthrough) {
        return res.sendStatus(401);
      }
      return next();
    }

    jwt.verify(token, TOKEN_SECRET, function(err, decoded) {
      if (err && !passthrough) {
        return res.sendStatus(401);
      }
      req.user = decoded;
      next();
    });
  };
};
