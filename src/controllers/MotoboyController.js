const fs = require('fs');
const vision = require('@google-cloud/vision');
const aws = require('aws-sdk');

const s3 = new aws.S3();

const transporter = require('../config/smtp');
const Motoboy = require('../models/Motoboy');

class MotoboyController {
  /** Create new register **/
  async Create(req, res) {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: 'File precisa conter uma imagem.' });
    }

    const { name, cpf, cnpj, address, telephone, email } = req.body;
    const { originalname: img_name, key, location: url = '' } = req.file;

    // Regex
    const regexCPF = /\d{3}\.\d{3}\.\d{3}\-\d{2}/;
    const regexCNPJ = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
    const regexTelephone = /(?:\+?55\s?)?(?:\(?\d{2}\)?[-\s]?)?\d{4,5}[-\s]?\d{4}/g;

    // Cannot be blank validation
    if (!name)
      return res.status(400).json({ message: 'O nome não pode estar vazio.' });
    if (!email)
      return res
        .status(400)
        .json({ message: 'O e-mail não pode estar vazio.' });
    if (!cpf.length)
      return res.status(400).json({ message: 'O CPF não pode estar vazio.' });
    if (!cnpj.length)
      return res.status(400).json({ message: 'O CNPJ não pode estar vazio.' });
    if (!address)
      return res
        .status(400)
        .json({ message: 'O endereço não pode estar vazio.' });
    if (!telephone.length)
      return res
        .status(400)
        .json({ message: 'O Número telefone não pode estar vazio.' });

    // Regex validation
    if (regexCPF.test(cpf) === false) {
      return res.status(400).json({
        message: 'CPF inválido, deve seguir o formato 000.000.000-00.',
      });
    }
    if (regexCNPJ.test(cnpj) === false) {
      return res.status(400).json({
        message: 'CNPJ inválido, deve seguir o formato 00.000.000/0000-00.',
      });
    }
    if (regexTelephone.test(telephone) === false) {
      return res.status(400).json({
        error:
          'Número de telefone inválido, deve seguir o formato (00) 90000-0000.',
      });
    }

    // Conflict validation
    try {
      const existentRegister = await Motoboy.findRegister([
        { cpf },
        { cnpj },
        { email },
        { telephone },
      ]);

      // If redo_test equals to false show conflict message
      if (existentRegister && existentRegister.redo_test === false) {
        if (existentRegister.cpf === cpf) {
          return res.status(409).json({ message: 'CPF já cadastrado.' });
        } else if (existentRegister.cnpj === cnpj) {
          return res.status(409).json({ message: 'CNPJ já cadastrado.' });
        } else if (existentRegister.email === email) {
          return res.status(409).json({ message: 'E-mail já cadastrado.' });
        } else if (existentRegister.telephone === telephone) {
          return res
            .status(409)
            .json({ message: 'Número de telefone já cadastrado.' });
        }
      } else if (existentRegister && existentRegister.redo_test === true) {
        // if redo_test equals to true delete the existent document and proceed to register a new one.
        try {
          await Motoboy.deleteById(existentRegister._id);
        } catch (error) {
          console.log(error);
          return res.status(500).json({
            message: 'Um erro inesperado ocorreu. Por favor, tente novamente.',
          });
        }
      }
    } catch (error) {
      console.log(error);
    }

    // Proceed to creation
    const result = await Motoboy.CreateRegister(
      name,
      cpf,
      cnpj,
      address,
      telephone,
      email,
      img_name,
      key,
      url,
    );

    return result
      ? res.status(200).json({ message: 'Cadastro realizado com sucesso' })
      : res.status(500).json({
          message: 'Um erro inesperado ocorreu. Por favor, tente novamente.',
        });
  }

  /** Search register by CPF **/
  async FindRegister(req, res) {
    const { cpf } = req.params;
    const regexCPF = /\d{3}\.\d{3}\.\d{3}\-\d{2}/;

    // CPF validation
    if (!cpf.length) return res.status(400).json('O CPF não pode estar vazio.');
    if (regexCPF.test(cpf) === false) {
      return res.status(400).json({
        message: 'CPF inválido, deve seguir o formato 000.000.000-00.',
      });
    }

    try {
      const register = await Motoboy.findRegister([{ cpf }]);
      return register
        ? res.status(200).json(register)
        : res.status(404).json({ message: 'CPF não encontrado.' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        message: 'Um erro inesperado ocorreu. Por favor, tente novamente.',
      });
    }
  }

  /** Update registration status **/
  async UpdateStatus(req, res) {
    const { id, status } = req.body;
    let result;

    // Status validation
    if (!status || !status.length)
      return res
        .status(400)
        .json({ message: 'O status não pode estar vazio.' });
    if (
      status !== 'pendente' &&
      status !== 'aprovado' &&
      status !== 'reprovado'
    ) {
      return res.status(400).json({
        error:
          'O status deve ser um dos seguintes valores: pendente, aprovado ou reprovado.',
      });
    }

    // Proceed to update
    if (status === 'reprovado') {
      try {
        result = await Motoboy.updateRegister(id, {
          status,
          disapproval_time: new Date(),
        });

        if (result) {
          setTimeout(async () => {
            await Motoboy.updateRegister(id, { redo_test: true });
          }, 600000); // 10 min
        }
      } catch (error) {
        console.log(error);
        return res.status(500).json({
          message: 'Um erro inesperado ocorreu. Por favor, tente novamente.',
        });
      }
    } else {
      try {
        result = await Motoboy.updateRegister(id, { status });
      } catch (error) {
        console.log(error);
        return res.status(500).json({
          message: 'Um erro inesperado ocorreu. Por favor, tente novamente.',
        });
      }
    }

    if (result) {
      let message = '';

      if (status === 'pendente') {
        message = ` 
          <h2 style="color:#293E52; font-size:24px">Olá, ${result.name}</h2>
          <p style="color:#7F8B97; font-size:20px">O seu status está <span style="color:#9B4DEE;">pendente</span>.</p>
          <p style="color:#7F8B97; font-size:20px">Enviaremos um e-mail para você assim que atualizarmos. Obrigado por se cadastrar 💜</p>
        `;
      } else if (status === 'aprovado') {
        message = ` 
          <h2 style="color:#293E52; font-size:24px">Obaaa!</h2>
          <p style="color:#7F8B97; font-size:20px">O seu cadastro foi <span style="color:#9B4DEE;">aprovado</span>, ${result.name}.</p>
          <p style="color:#7F8B97; font-size:20px">Estamos extremamente ansiosos para trabalhar contigo. Vamos entregar felicidade!!</p>
        `;
      } else if (status === 'reprovado') {
        message = ` 
          <h2 style="color:#293E52; font-size:24px">Olá, ${result.name}</h2>
          <p style="color:#7F8B97; font-size:20px; margin: 10px 0 30px 0;">Infelizmente o seu cadastro foi <span style="color:#9B4DEE;">recusado</span> ):</p>
          <p style="color:#7F8B97; font-size:18px">Por favor, não desanime. Você poderá se cadastrar novamente em 10 minutos 💜</p>
        `;
      }

      // Send e-mail
      transporter
        .sendMail({
          from: `QueroDelivery <${process.env.GMAILUSER}>`,
          to: result.email,
          subject: 'Atualização de status do seu cadastro.',
          text: ``,
          html: message,
        })
        .then(() => {})
        .catch((error) => {
          console.log(error);
        });

      res.status(200).json({ message: 'Atualização feita com sucesso.' });
    } else {
      res.status(404).json({ message: 'ID inexistente.' });
    }
  }

  /** Get all records **/
  async AllRecords(req, res) {
    try {
      const result = await Motoboy.getAllRecords();
      result
        ? res.json(result)
        : res.status(404).json({ message: 'Não encontrado.' });
    } catch (error) {
      return res.status(500).json({
        message: 'Um erro inesperado ocorreu. Por favor, tente novamente.',
      });
    }
  }

  async SelfieAnalyses(req, res) {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: 'File precisa conter uma imagem.' });
    }

    const { key, location: url = '', path } = req.file;
    let faceDetection = [];

    async function quickstart() {
      // Creates a client
      const client = new vision.ImageAnnotatorClient();

      try {
        if (process.env.STORAGE_TYPE === 's3') {
          const [result] = await client.faceDetection(url);
          const face = result.faceAnnotations;
          faceDetection = face.length;
        } else {
          const [result] = await client.faceDetection(path);
          const face = result.faceAnnotations;
          faceDetection = face.length;
        }
      } catch (error) {
        console.log(error);
        return res.status(401).json({
          message: 'Falha ao autenticar.',
        });
      }
    }

    await quickstart();

    if (process.env.STORAGE_TYPE === 's3') {
      s3.deleteObject({
        Bucket: process.env.BUCKET_NAME,
        Key: key,
      })
        .promise()
        .then((response) => {})
        .catch((response) => {});
    } else {
      try {
        fs.unlinkSync(path);
      } catch (error) {
        console.log(error);
      }
    }

    return faceDetection === 1
      ? res.status(200).json({ message: true })
      : res.status(200).json({ message: false });
  }
}

module.exports = new MotoboyController();
