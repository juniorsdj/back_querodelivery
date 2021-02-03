const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAILUSER,
    pass: process.env.GMAILPASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

module.exports = transporter;
