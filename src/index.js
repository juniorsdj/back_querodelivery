require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');

const routes = require('./routes/routes');
const app = express();

// cors
app.use(cors());

// body-parser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Routes
app.use('/', routes);
app.use(
  '/files',
  express.static(path.resolve(__dirname, '..', 'tmp', 'uploads')),
); // Local file's route

// Database
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.set('useFindAndModify', false);

// Server
app.listen(8080);
