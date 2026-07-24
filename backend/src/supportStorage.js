const fs = require('fs');
const os = require('os');
const path = require('path');

const supportDirectory = process.env.SUPPORT_UPLOAD_DIR
  ? path.resolve(process.env.SUPPORT_UPLOAD_DIR.replace(/^~(?=$|\/)/, os.homedir()))
  : path.join(os.homedir(), 'workspace/lab/hotube_data/support');

const ensureSupportDirectory = () => {
  fs.mkdirSync(supportDirectory, { recursive: true });
};

module.exports = { ensureSupportDirectory, supportDirectory };
