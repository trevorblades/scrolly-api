const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const jwt = require('jsonwebtoken');
const pg = require('pg');
const uniqid = require('uniqid');

const {TOKEN_SECRET} = require('./constants');
const authorize = require('./middleware/authorize');
const uploadAssets = require('./middleware/upload-assets');

const MAX_BODY_SIZE = '10mb';
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7 days';

function splitObject(object, stringify) {
  const keys = Object.keys(object);
  return {
    keys,
    values: keys.map(function(key) {
      let value = object[key];
      if (stringify && typeof value === 'object') {
        return JSON.stringify(value);
      }
      return value;
    })
  };
}

pg.defaults.ssl = process.env.NODE_ENV === 'production';

const app = express();
app.enable('trust proxy');
app.use(bodyParser.json({limit: MAX_BODY_SIZE}));
app.use(cors({
  origin: /^https?:\/\/((localhost(:\d{4})?)|((\w*\.)?scrol.ly))$/,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

app.post('/auth', function(req, res) {
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
          const token = jwt.sign(user, TOKEN_SECRET, {expiresIn: TOKEN_EXPIRY});
          res.send(token);
        })
        .catch(function() {
          return res.sendStatus(401);
        });
    });
  });
});

app.post('/users', function(req, res) {
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

          const token = jwt.sign(user, TOKEN_SECRET, {expiresIn: TOKEN_EXPIRY});
          res.send(token);
        });
      });
  });
});

app.route('/projects')
  .get(authorize(), function(req, res) {
    if (!req.user) {
      return res.sendStatus(401);
    }

    pg.connect(process.env.DATABASE_URL, function(err, client, done) {
      if (err) {
        return res.sendStatus(500);
      }

      const query = 'SELECT id, slug, name, width, height, layers::json, assets::json, step, created_at, updated_at FROM projects WHERE user_id = $1';
      client.query(query, [req.user.id], function(err, result) {
        done();
        if (err) {
          return res.sendStatus(500);
        }
        res.send(result.rows);
      });
    });
  })
  .post(authorize(), uploadAssets, function(req, res) {
    pg.connect(process.env.DATABASE_URL, function(err, client, done) {
      if (err) {
        return res.sendStatus(500);
      }

      const timestamp = new Date().toISOString();
      const project = {
        user_id: req.user.id,
        slug: uniqid.process(),
        name: req.body.name,
        width: req.body.width,
        height: req.body.height,
        layers: req.body.layers,
        assets: req.body.assets,
        step: req.body.step,
        created_at: timestamp,
        updated_at: timestamp
      };
      const {keys, values} = splitObject(project, true);
      const query = `INSERT INTO projects(${keys.join(', ')})
          VALUES (${keys.map((key, index) => `$${index + 1}`).join(', ')})
          RETURNING id`;
      client.query(query, values, function(err, result) {
        done();
        if (err) {
          return res.sendStatus(500);
        }
        project.id = result.rows[0].id;
        res.send(project);
      });
    });
  });

app.get('/projects/:slug', authorize(true), function(req, res) {
  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    if (err) {
      return res.sendStatus(500);
    }

    const columns = [
      'name',
      'width',
      'height',
      'layers::json',
      'assets::json',
      'step',
      'created_at',
      'updated_at'
    ];
    if (req.user) {
      columns.push('id', 'user_id', 'slug');
    }
    const query = `SELECT ${columns.join(', ')} FROM projects WHERE slug = $1`;
    client.query(query, [req.params.slug], function(err, result) {
      done();
      if (err) {
        return res.sendStatus(500);
      } else if (!result.rows.length) {
        return res.sendStatus(404);
      }

      const project = result.rows[0];
      res.send(project);
    });
  });
});

app.put('/projects/:id', authorize(), uploadAssets, function(req, res) {
  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    if (err) {
      return res.sendStatus(500);
    }

    const project = {
      name: req.body.name,
      width: req.body.width,
      height: req.body.height,
      layers: req.body.layers,
      assets: req.body.assets,
      step: req.body.step,
      updated_at: new Date().toISOString()
    };
    const {keys, values} = splitObject(project, true);
    const expressions = keys.map((key, index) => `${key} = $${index + 1}`);
    const query = `UPDATE projects SET ${expressions.join(', ')}
        WHERE id = ${req.params.id} AND user_id = ${req.user.id}
        RETURNING slug, created_at`;
    client.query(query, values, function(err, result) {
      done();
      if (err) {
        return res.sendStatus(500);
      }

      const row = result.rows[0];
      res.send(Object.assign(project, {
        id: parseInt(req.params.id),
        slug: row.slug,
        created_at: row.created_at
      }));
    });
  });
});

app.listen(process.env.PORT || 8000);
