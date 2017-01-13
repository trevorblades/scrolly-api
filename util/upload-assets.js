const aws = require('aws-sdk');
const mime = require('mime');
const uniqid = require('uniqid');

const ASSET_REGEX = /^data:image\/([\w\+]+);base64,(.+)$/;

module.exports = function(req, res, next) {
  req.assets = [];

  let assetsRemaining = 0;
  const s3 = new aws.S3();
  req.body.assets.forEach(function(asset) {
    const matches = ASSET_REGEX.exec(asset.src);
    if (matches) {
      assetsRemaining++;

      const fileName = `${uniqid()}.${mime.extension(asset.mimeType)}`;
      s3.upload({
        Bucket: 'assets.scrol.ly',
        Key: fileName,
        Body: Buffer.from(matches[2], 'base64'),
        ContentType: asset.mimeType
      }, function(err, data) {
        if (err) {
          return res.sendStatus(500);
        }
        asset.src = `https://assets.scrol.ly/${data.Key}`;
        assetsRemaining--;
        if (!assetsRemaining) {
          next();
        }
      });
    }
  });

  if (!assetsRemaining) {
    next();
  }
};
