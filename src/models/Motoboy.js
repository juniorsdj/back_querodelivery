const mongoose = require('mongoose');
const aws = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const s3 = new aws.S3();

// Schema
const schema = new mongoose.Schema({
  name: String,
  cpf: String,
  cnpj: String,
  address: String,
  email: String,
  telephone: String,
  status: String,
  disapproval_time: String,
  redo_test: Boolean,
  img: {
    name: String,
    key: String,
    url: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Schema middleware
schema.pre('validate', function () {
  if (!this.img.url) {
    this.img.url = `${process.env.APP_URL}/files/${this.img.key}`;
  }
});

schema.pre('remove', function () {
  if (process.env.STORAGE_TYPE === 's3') {
    return s3
      .deleteObject({
        Bucket: process.env.BUCKET_NAME,
        Key: this.img.key,
      })
      .promise()
      .then((response) => {
        console.log(response.status);
      })
      .catch((response) => {
        console.log(response.status);
      });
  } else {
    return promisify(fs.unlink)(
      path.resolve(__dirname, '..', '..', 'tmp', 'uploads', this.img.key),
    );
  }
});

// Model
const Model = mongoose.model('Motoboy', schema);

class Motoboy {
  // Create new register
  async CreateRegister(
    name,
    cpf,
    cnpj,
    address,
    telephone,
    email,
    img_name,
    key,
    url,
  ) {
    const newRegister = new Model({
      name,
      cpf,
      cnpj,
      address,
      telephone,
      email,
      status: 'pendente',
      disapproval_time: '',
      redo_test: false,
      img: {
        name: img_name,
        key,
        url,
      },
    });

    try {
      await newRegister.save();
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  // Get all records
  async getAllRecords() {
    try {
      return await Model.find({});
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  // Find register
  async findRegister(conditions) {
    try {
      return await Model.findOne({ $or: conditions });
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  // Delete by id
  async deleteById(id) {
    try {
      const result = await Model.findById(id);
      await result.remove();
    } catch (error) {
      console.log(error);
    }
  }

  // Update register
  async updateRegister(id, object) {
    try {
      const result = await Model.findByIdAndUpdate(id, object);
      return result;
    } catch (error) {
      console.log(error);
      return false;
    }
  }
}

module.exports = new Motoboy();
