/**
 * Module dependencies
 */
const path = require('path');
const sharp = require('sharp');
const _ = require('lodash');

const config = require(path.resolve('./config'));
const errors = require(path.resolve('./lib/helpers/errors'));
const responses = require(path.resolve('./lib/helpers/responses'));
const UploadsService = require('../services/uploads.service');

/**
 * @desc Endpoint to get an upload by fileName
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.get = async (req, res) => {
  try {
    const stream = await UploadsService.getStream({ _id: req.upload._id });
    if (!stream) responses.error(res, 404, 'Not Found', 'No Upload with that identifier can been found')();
    stream.on('error', (err) => {
      responses.error(res, 422, 'Unprocessable Entity', errors.getMessage(err))(err);
    });
    res.set('Content-Type', req.upload.contentType);
    stream.pipe(res);
  } catch (err) {
    responses.error(res, 422, 'Unprocessable Entity', errors.getMessage(err))(err);
  }
};

/**
 * @desc Endpoint to get an upload by fileName with sharp options
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getSharp = async (req, res) => {
  try {
    const stream = await UploadsService.getStream({ _id: req.upload._id });
    if (!stream) responses.error(res, 404, 'Not Found', 'No Upload with that identifier can been found')();
    stream.on('error', (err) => {
      responses.error(res, 422, 'Unprocessable Entity', errors.getMessage(err))(err);
    });
    res.set('Content-Type', req.upload.contentType);
    switch (req.sharpOption) {
      case 'blur':
        stream.pipe(sharp().resize(req.sharpSize).blur(20)).pipe(res);
        break;
      case 'bw':
        stream.pipe(sharp().resize(req.sharpSize).grayscale()).pipe(res);
        break;
      case 'blur&bw':
        stream.pipe(sharp().resize(req.sharpSize).grayscale().blur(20)).pipe(res);
        break;
      default:
        stream.pipe(sharp().resize(req.sharpSize)).pipe(res);
    }
  } catch (err) {
    responses.error(res, 422, 'Unprocessable Entity', errors.getMessage(err))(err);
  }
};

/**
 * @desc Endpoint to delete an upload
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.delete = async (req, res) => {
  try {
    await UploadsService.delete({ _id: req.upload._id });
    responses.success(res, 'upload deleted')();
  } catch (err) {
    responses.error(res, 422, 'Unprocessable Entity', errors.getMessage(err))(err);
  }
};

/**
 * @desc MiddleWare to ask the service the uppload for this uploadName
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @param {String} filename - upload filename
 */
exports.uploadByName = async (req, res, next, uploadName) => {
  try {
    const upload = await UploadsService.get(uploadName);
    if (!upload) responses.error(res, 404, 'Not Found', 'No Upload with that name has been found')();
    else {
      req.upload = upload;
      req.isOwner = upload.metadata.user; // used if we proteck road by isOwner policy
      next();
    }
  } catch (err) {
    next(err);
  }
};

/**
 * @desc MiddleWare to ask the service the uppload for this uploadImageName
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @param {String} filename & params - upload filename & eventual params (two max) filename-maxSize-options.png
 */
exports.uploadByImageName = async (req, res, next, uploadImageName) => {
  try {
    // Name
    const imageName = uploadImageName.split('.');
    const opts = imageName[0].split('-');
    if (imageName.length !== 2) responses.error(res, 404, 'Not Found', 'Wrong name schema')();
    else if (opts.length > 3) responses.error(res, 404, 'Not Found', 'Too much params')();
    else {
      // data work
      const upload = await UploadsService.get(`${opts[0]}.${imageName[1]}`);
      if (!upload) responses.error(res, 404, 'Not Found', 'No Upload with that name has been found')();
      else {
        // options
        const sharp = _.get(config, `uploads.${upload.metadata.kind}.sharp`);
        if (opts[1] && (!sharp || !sharp.sizes)) responses.error(res, 422, 'Unprocessable Entity', 'Size param not available')();
        else if (opts[1] && (!/^\d+$/.test(opts[1]) || !sharp.sizes.includes(opts[1]))) responses.error(res, 422, 'Unprocessable Entity', 'Wrong size param')();
        else if (opts[2] && (!sharp || !sharp.operations)) responses.error(res, 422, 'Unprocessable Entity', 'Operations param not available')();
        else if (opts[2] && !sharp.operations.includes(opts[2])) responses.error(res, 422, 'Unprocessable Entity', 'Operation param not available')();
        else {
          // return
          req.upload = upload;
          req.isOwner = upload.metadata.user; // used if we proteck road by isOwner policy
          req.sharpSize = parseInt(opts[1], 0) || null;
          req.sharpOption = opts[2] || null;
          next();
        }
      }
    }
  } catch (err) {
    console.log('err', err);
    next(err);
  }
};