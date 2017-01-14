const jwt = require('jsonwebtoken');
const {TOKEN_SECRET} = require('../constants');

module.exports = function(req, res, next) {
  let token;
  if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.sendStatus(401);
  }
  jwt.verify(token, TOKEN_SECRET, function(err, decoded) {
    if (err) {
      return res.sendStatus(401);
    }
    req.user = decoded;
    next();
  });
};
