const axios = require('axios');

const normalizeMlServiceUrl = (rawUrl) => {
  if (!rawUrl) {
    return 'http://127.0.0.1:8000';
  }
  const url = rawUrl.trim().replace(/\/$/, '');
  return url.replace(/^http:\/\/localhost(?::(\d+))?/, 'http://127.0.0.1$1');
};

const mlEndpoint = normalizeMlServiceUrl(
  process.env.ML_SERVICE_URL || process.env.HF_SPACES_URL || process.env.HUGGING_FACE_URL
);

console.log('================================');
console.log('ML SERVICE ENDPOINT:', mlEndpoint);
console.log('================================');

async function sendToMlService(imagePath) {
  const formData = new (require('form-data'))();
  const fs = require('fs');
  formData.append('image', fs.createReadStream(imagePath));

  try {
    const response = await axios.post(`${mlEndpoint}/predict`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        Expires: '0',
      },
      timeout: 60000,
    });

    return response.data;
  } catch (error) {
    console.error('Error calling ML Service:', error.message);
    throw new Error(`ML Service error: ${error.message}`);
  }
}

async function generateHeatmap(imagePath) {
  const formData = new (require('form-data'))();
  const fs = require('fs');
  formData.append('image', fs.createReadStream(imagePath));

  try {
    const response = await axios.post(`${mlEndpoint}/generate-heatmap`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        Expires: '0',
      },
      timeout: 120000,
    });

    return response.data;
  } catch (error) {
    console.error('Error generating heatmap from ML Service:', error.message);
    throw new Error(`ML Service heatmap error: ${error.message}`);
  }
}

module.exports = { sendToMlService, generateHeatmap };