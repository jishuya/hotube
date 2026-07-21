const fs = require('fs');
const os = require('os');
const path = require('path');

const mediaDirectory = process.env.MEDIA_UPLOAD_DIR
  ? path.resolve(process.env.MEDIA_UPLOAD_DIR.replace(/^~(?=$|\/)/, os.homedir()))
  : path.join(os.homedir(), 'workspace/lab/hotube_data/media');

const ensureMediaDirectory = () => {
  fs.mkdirSync(mediaDirectory, { recursive: true });
};

module.exports = {
  ensureMediaDirectory,
  mediaDirectory,
};
