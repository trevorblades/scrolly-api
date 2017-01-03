const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const fs = require('fs');
const jsonfile = require('jsonfile');
const uniqid = require('uniqid');

const MAX_BODY_SIZE = '10mb';
const PROJECT_DIR = __dirname + '/projects';

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
    fs.access(PROJECT_DIR, function(err) {
      if (err) {
        fs.mkdirSync(PROJECT_DIR);
      }

      fs.readdir(PROJECT_DIR, function(err, files) {
        res.send(files);
      });
    });
  })
  .post(function(req, res) {
    fs.access(PROJECT_DIR, function(err) {
      if (err) {
        fs.mkdirSync(PROJECT_DIR);
      }

      const id = uniqid.process();
      jsonfile.writeFile(`${PROJECT_DIR}/${id}.json`, req.body, function(err) {
        if (err) {
          return res.sendStatus(500);
        }
        res.send(id);
      });
    });
  });

app.listen(process.env.PORT || 8000);
