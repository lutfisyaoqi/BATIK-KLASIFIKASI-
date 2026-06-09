const axios = require('axios');

async function testHfOpenApi() {
  const url = 'https://flora2121-batik-classification-api.hf.space/openapi.json';
  console.log('🧪 HF API Health Test');
  console.log('GET', url);

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        Accept: 'application/json',
      },
    });

    console.log('✅ Status:', response.status);
    console.log('✅ Content-Type:', response.headers['content-type']);
    console.log('✅ Paths available:', Object.keys(response.data.paths || {}).slice(0, 20));
    console.log('✅ /predict endpoint present:', response.data.paths && Object.prototype.hasOwnProperty.call(response.data.paths, '/predict'));
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response body:', error.response.data);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  testHfOpenApi().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
