const aws = require('aws-sdk');
const router = require('express').Router();
const mime = require('mime');
const multer = require('multer');
const uniqid = require('uniqid');

router.post('/', multer().single('file'), function(req, res) {
  if (req.file) {
    const s3 = new aws.S3();
    return s3.upload({
      Bucket: 'assets.scrol.ly',
      Key: `${uniqid()}.${mime.extension(req.file.mimetype)}`,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    }, function(err, data) {
      if (err) {
        return res.sendStatus(500);
      }
      return res.send(`https://assets.scrol.ly/${data.Key}`);
    });
  }
  return res.sendStatus(400);
});

module.exports = router;
