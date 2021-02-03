const express = require('express');
const multer = require('multer');
const multerConfig = require('../config/multer');

const MotoboyController = require('../controllers/MotoboyController');
const routes = express.Router();

/* GET */
routes.get('/register/:cpf', MotoboyController.FindRegister);
routes.get('/register/', MotoboyController.AllRecords);
routes.get('/selfie', MotoboyController.SelfieAnalyses);

/* POST */
routes.post(
  '/register',
  multer(multerConfig).single('file'), // single represents the field name
  MotoboyController.Create,
);

routes.post(
  '/selfie',
  multer(multerConfig).single('file'),
  MotoboyController.SelfieAnalyses,
);

/* PUT */
routes.put('/register', MotoboyController.UpdateStatus);

module.exports = routes;
