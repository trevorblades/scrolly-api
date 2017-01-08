const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const fs = require('fs');
const jsonfile = require('jsonfile');
const s3 = require('s3');
const uniqid = require('uniqid');

const MAX_BODY_SIZE = '10mb';
const PROJECT_DIR = __dirname + '/projects';

var client = s3.createClient({
  s3Options: {
    accessKeyId: 'AKIAJIK2TJKA7EQZPO2Q',
    secretAccessKey: '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'
  }
});

const app = express();
app.enable('trust proxy');
app.use(bodyParser.json({
  limit: MAX_BODY_SIZE
}));
app.use(cors({
  origin: /^https?:\/\/(localhost(:\d{4})?)$/,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

app.post('/assets', function(req, res) {
  const uploader = client.uploadFile({
    localFile: req.params.file,
    s3Params: {
      Bucket: 'assets.scrol.ly'
    }
  });
  uploader.on('error', function() {
    res.sendStatus(500);
  });
  uploader.on('end', function() {
    res.send('Complete!');
  });
});

app.route('/projects')
  .get(function(req, res) {
    fs.readdir(PROJECT_DIR, function(err, files) {
      res.send(files);
    });
  })
  .post(function(req, res) {
    const id = uniqid.process();
    jsonfile.writeFile(`${PROJECT_DIR}/${id}.json`, req.body, function(err) {
      if (err) {
        return res.sendStatus(500);
      }
      res.send(id);
    });
  });

app.route('/projects/:id')
  .get(function(req, res) {
    jsonfile.readFile(`${PROJECT_DIR}/${req.params.id}.json`, function(err, file) {
      if (err) {
        return res.sendStatus(404);
      }
      res.send(file);
    });
  })
  .put(function(req, res) {
    jsonfile.writeFile(`${PROJECT_DIR}/${req.params.id}.json`, function(err) {
      if (err) {
        return res.sendStatus(500);
      }
      res.send(req.params.id);
    });
  });

app.listen(process.env.PORT || 8000);
