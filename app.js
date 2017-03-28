const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const pg = require('pg');

const assetRoute = require('./routes/asset');
const authRoute = require('./routes/auth');
const projectsRoute = require('./routes/projects');
const usersRoute = require('./routes/users');

const MAX_BODY_SIZE = '10mb';

pg.defaults.ssl = process.env.NODE_ENV === 'production';

const app = express();
app.enable('trust proxy');
app.use(bodyParser.json({limit: MAX_BODY_SIZE}));
app.use(cors({
  origin: /^https?:\/\/((localhost(:\d{4})?)|((\w*\.)?scrol.ly))$/,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

app.use('/asset', assetRoute);
app.use('/auth', authRoute);
app.use('/projects', projectsRoute);
app.use('/users', usersRoute);

app.listen(process.env.PORT || 8000);
