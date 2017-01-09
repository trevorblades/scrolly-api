const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const pg = require('pg');
const uniqid = require('uniqid');

const splitObject = require('./util/split-object');
const uploadAssets = require('./util/upload-assets');

const MAX_BODY_SIZE = '10mb';

pg.defaults.ssl = process.env.NODE_ENV === 'production';

const app = express();
app.enable('trust proxy');
app.use(bodyParser.json({
  limit: MAX_BODY_SIZE
}));
app.use(cors({
  origin: /^https?:\/\/((localhost(:\d{4})?)|((\w*\.)?scrol.ly))$/,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

app.route('/projects')
  .get(function(req, res) {
    pg.connect(process.env.DATABASE_URL, function(err, client, done) {
      if (err) {
        return res.sendStatus(500);
      }
      client.query('SELECT * FROM projects', function(err, result) {
        done();
        if (err) {
          return res.sendStatus(500);
        }
        res.send(result.rows);
      });
    });
  })
  .post(uploadAssets, function(req, res) {
    pg.connect(process.env.DATABASE_URL, function(err, client, done) {
      if (err) {
        return res.sendStatus(500);
      }

      const timestamp = new Date().toISOString();
      const project = {
        slug: uniqid.process(),
        name: req.body.name,
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

app.get('/projects/:slug', function(req, res) {
  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    if (err) {
      return res.sendStatus(500);
    }
    const query = 'SELECT id, slug, name, layers::json, assets::json, step, created_at, updated_at FROM projects WHERE slug = $1';
    client.query(query, [req.params.slug], function(err, result) {
      done();
      if (err) {
        return res.sendStatus(500);
      } else if (!result.rows.length) {
        return res.sendStatus(404);
      }
      res.send(result.rows[0]);
    });
  });
});

app.put('/projects/:id', uploadAssets, function(req, res) {
  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    if (err) {
      return res.sendStatus(500);
    }

    const project = {
      name: req.body.name,
      layers: req.body.layers,
      assets: req.body.assets,
      step: req.body.step,
      updated_at: new Date().toISOString()
    };
    const {keys, values} = splitObject(project, true);
    const expressions = keys.map((key, index) => `${key} = $${index + 1}`);
    const query = `UPDATE projects SET ${expressions.join(', ')}
        WHERE id = ${req.params.id}
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
