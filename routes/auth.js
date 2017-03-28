const bcrypt = require('bcrypt');
const router = require('express').Router();
const jwt = require('jsonwebtoken');
const pg = require('pg');

const {TOKEN_EXPIRY} = require('../constants');

router.post('/', function(req, res) {
  if (!req.body.email || !req.body.password) {
    return res.sendStatus(400);
  }
  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    if (err) {
      return res.sendStatus(500);
    }

    const query = 'SELECT id, password, email, created_at, updated_at FROM users WHERE email LIKE $1';
    client.query(query, [req.body.email], function(err, result) {
      done();
      if (err) {
        return res.sendStatus(500);
      } else if (!result.rows.length) {
        return res.sendStatus(401);
      }

      const user = result.rows[0];
      bcrypt.compare(req.body.password, user.password)
        .then(function(success) {
          if (!success) {
            throw new Error();
          }

          delete user.password;
          const token = jwt.sign(user, process.env.TOKEN_SECRET, {expiresIn: TOKEN_EXPIRY});
          res.send(token);
        })
        .catch(function() {
          return res.sendStatus(401);
        });
    });
  });
});

module.exports = router;
