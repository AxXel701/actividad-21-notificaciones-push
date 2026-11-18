const fs = require('node:fs');
const path = require('node:path');

module.exports = ({ config }) => {
  const firebaseConfig = './google-services.json';
  if (!fs.existsSync(path.resolve(__dirname, firebaseConfig))) return config;

  return {
    ...config,
    android: { ...config.android, googleServicesFile: firebaseConfig },
  };
};
