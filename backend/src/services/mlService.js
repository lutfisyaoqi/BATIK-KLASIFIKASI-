const axios = require('axios');
const path = require('path');

const DEFAULT_ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'https://flora2121-batik-classification-api.hf.space';

const normalizeMlServiceUrl = (rawUrl) => {
  if (!rawUrl) {
    rawUrl = DEFAULT_ML_SERVICE_URL;
  }
  const url = rawUrl.trim().replace(/\/$/, '');
  return url.replace(/^http:\/\/localhost(?::(\d+))?/, 'http://127.0.0.1$1');
};

const mlEndpoint = normalizeMlServiceUrl(
  process.env.ML_SERVICE_URL || process.env.HF_SPACES_URL || process.env.HUGGING_FACE_URL || DEFAULT_ML_SERVICE_URL
);

console.log('================================');
console.log('ML SERVICE URL:', mlEndpoint);
console.log('================================');

async function sendToMlService(imagePath) {
  const formData = new (require('form-data'))();
  const fs = require('fs');
  const requestUrl = `${mlEndpoint}/predict`;
  const fileStream = fs.createReadStream(imagePath);

  formData.append('image', fileStream);

  console.log('[ML SERVICE] Final request URL:', requestUrl);
  console.log('[ML SERVICE] Uploaded filename:', path.basename(imagePath));
  console.log('[ML SERVICE] Upload field:', 'image');

  try {
    const response = await axios.post(requestUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        Expires: '0',
      },
      timeout: 60000,
    });

    console.log('[ML SERVICE] Response status:', response.status);
    console.log('[ML SERVICE] Response body:', response.data);

    return response.data;
  } catch (error) {
    console.error('Error calling ML Service:', error.message);
    if (error.response) {
      console.error('[ML SERVICE] Response status:', error.response.status);
      console.error('[ML SERVICE] Response body:', error.response.data);
    }
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