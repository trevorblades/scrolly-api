const router = require('express').Router();
const pg = require('pg');
const uniqid = require('uniqid');

const authorize = require('../middleware/authorize');
const splitObject = require('../util/split-object');

router.route('/')
  .get(authorize(), function(req, res) {
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
  .post(authorize(), function(req, res) {
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

router.get('/:slug', authorize(true), function(req, res) {
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
      if (req.user && req.user.id !== project.user_id) {
        return res.sendStatus(401);
      }
      res.send(project);
    });
  });
});

router.put('/:id', authorize(), function(req, res) {
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

module.exports = router;
