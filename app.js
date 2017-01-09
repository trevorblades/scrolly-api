const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const pg = require('pg');
const uniqid = require('uniqid');
const url = require('url');

const uploadAssets = require('./util/upload-assets');

const MAX_BODY_SIZE = '10mb';

pg.defaults.ssl = process.env.NODE_ENV === 'production';
const databaseUrl = url.parse(process.env.DATABASE_URL);
const pgOptions = {
  database: databaseUrl.path.slice(1),
  host: databaseUrl.host,
  port: databaseUrl.port
};
if (databaseUrl.auth) {
  const credentials = databaseUrl.auth.split(':');
  pgOptions.user = credentials[0];
  pgOptions.password = credentials[1];
}
const pool = new pg.Pool(pgOptions);

const app = express();
app.enable('trust proxy');
app.use(bodyParser.json({
  limit: MAX_BODY_SIZE
}));
app.use(cors({
  origin: /^https?:\/\/(localhost(:\d{4})?)$/,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

app.route('/projects')
  .get(function(req, res) {
    pool.connect(function(err, client, done) {
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
    pool.connect(function(err, client, done) {
      if (err) {
        return res.sendStatus(500);
      }

      const project = {
        slug: uniqid.process(),
        name: 'Untitled',
        layers: req.body.layers,
        assets: req.body.assets,
        step: req.body.step,
        created_at: new Date(),
        updated_at: new Date()
      };
      const keys = Object.keys(project);
      const values = keys.map(function(key) {
        let value = project[key];
        if (typeof value === 'object') {
          value = JSON.stringify(value);
        }
        return value;
      });
      const query = `INSERT INTO projects(${keys.join(', ')})
          values (${keys.map((key, index) => `$${index + 1}`).join(', ')})`;
      client.query(query, values, function(err, result) {
        done();
        if (err) {
          return res.sendStatus(500);
        }
        res.send(project);
      });
    });
  });

app.route('/projects/:slug')
  .get(function(req, res) {
    pool.connect(function(err, client, done) {
      if (err) {
        return res.sendStatus(500);
      }
      const query = 'SELECT slug, name, layers::json, assets::json, step, created_at, updated_at FROM projects WHERE slug=$1';
      client.query(query, [req.params.slug], function(err, result) {
        done();
        if (err) {
          return res.sendStatus(500);
        }
        res.send(result.rows[0]);
      });
    });
  })
  .put(function(req, res) {

  });

app.listen(process.env.PORT || 8000);
