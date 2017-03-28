const bcrypt = require('bcrypt');
const router = require('express').Router();
const jwt = require('jsonwebtoken');
const pg = require('pg');

const {TOKEN_EXPIRY} = require('../constants');
const splitObject = require('../util/split-object');

const SALT_ROUNDS = 10;

router.post('/', function(req, res) {
  if (!req.body.email ||
      !req.body.password ||
      req.body.password !== req.body.passwordConfirm) {
    return res.sendStatus(400);
  }

  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    if (err) {
      return res.sendStatus(500);
    }

    bcrypt.hash(req.body.password, SALT_ROUNDS)
      .then(function(hash) {
        const timestamp = new Date().toISOString();
        const user = {
          email: req.body.email,
          password: hash,
          created_at: timestamp,
          updated_at: timestamp
        };
        const {keys, values} = splitObject(user, true);
        const query = `INSERT INTO users(${keys.join(', ')})
            VALUES (${keys.map((key, index) => `$${index + 1}`).join(', ')})
            RETURNING id, email, created_at, updated_at`;
        client.query(query, values, function(err, result) {
          done();
          if (err) {
            return res.sendStatus(500);
          }

          const token = jwt.sign(result.rows[0], process.env.TOKEN_SECRET, {
            expiresIn: TOKEN_EXPIRY
          });
          res.send(token);
        });
      });
  });
});

module.exports = router;
