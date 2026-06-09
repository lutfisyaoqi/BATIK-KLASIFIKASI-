const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { existsSync } = require('fs');
const os = require('os');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../services/supabaseClient');
const { sendToMlService, generateHeatmap } = require('../services/mlService');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeAdmin } = require('../middleware/adminMiddleware');

const router = express.Router();

// Use memory storage - file stays in RAM, not on disk
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// PUBLIC: User bisa klasifikasi gambar tanpa login
router.post('/', upload.single('image'), async (req, res, next) => {
  let tempFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Gambar batik harus diunggah.' });
    }

    // Simpan ke temp file hanya untuk ML Service processing
    const uniqueFileName = `${Date.now()}-${uuidv4()}${path.extname(req.file.originalname)}`;
    tempFilePath = path.join(os.tmpdir(), uniqueFileName);
    await fs.writeFile(tempFilePath, req.file.buffer);
    
    console.log(`[Prediction] Processing image: ${uniqueFileName}`);
    
    const mlResponse = await sendToMlService(tempFilePath);
    console.log(`[Prediction] ML Response:`, mlResponse);

    if (!mlResponse || !mlResponse.label || mlResponse.confidence === undefined) {
      console.error('[Prediction] Invalid ML response:', mlResponse);
      return res.status(500).json({
        message: 'ML Service mengembalikan data tidak valid.',
        received: mlResponse,
      });
    }

    const lowConfidenceWarning = parseFloat(process.env.LOW_CONFIDENCE_WARNING || '0.35');

    // Upload ke Supabase Storage
    const storagePath = `predictions/${uniqueFileName}`;
    console.log(`[Prediction] Uploading to Supabase: ${storagePath}`);
    
    const { error: uploadError } = await supabase.storage
      .from('dataset')
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error('[Prediction] Supabase upload error:', uploadError);
      throw new Error(`Storage Error: ${uploadError.message}`);
    }

    // Ambil public URL dari Supabase
    const { data: urlData } = supabase.storage
      .from('dataset')
      .getPublicUrl(storagePath);

    const imageUrl = urlData?.publicUrl;
    console.log(`[Prediction] Public URL: ${imageUrl}`);

    const prediction = {
      image_url: imageUrl,
      prediction_label: mlResponse.label,
      confidence_score: mlResponse.confidence,
      created_at: new Date().toISOString(),
    };

    console.log(`[Prediction] Saving to DB:`, prediction);
    const { error } = await supabase.from('batik_predictions').insert([prediction]);

    if (error) {
      console.error('[Prediction] DB Error:', error);
      throw error;
    }

    const responsePayload = {
      ...prediction,
      low_confidence: mlResponse.confidence < lowConfidenceWarning,
      warning_message: mlResponse.confidence < lowConfidenceWarning
        ? 'Confidence rendah — hasil mungkin kurang pasti.'
        : null,
    };

    console.log(`[Prediction] Success: ${prediction.prediction_label} (${prediction.confidence_score})`);
    res.json(responsePayload);
  } catch (error) {
    console.error('[Prediction] Route error:', error.message);
    next(error);
  } finally {
    // Clean up temp file
    if (tempFilePath && existsSync(tempFilePath)) {
      await fs.unlink(tempFilePath).catch(() => {});
    }
  }
});

function resolveUploadPath(imageUrl) {
  try {
    const url = new URL(imageUrl, 'http://example.com');
    // Check if URL is from Supabase storage
    if (url.hostname.includes('supabase')) {
      return imageUrl;
    }
  } catch (err) {
    return null;
  }
  return null;
}

async function downloadRemoteImage(imageUrl) {
  const fileName = path.basename(new URL(imageUrl).pathname) || `heatmap-${uuidv4()}.jpg`;
  const tempPath = path.join(os.tmpdir(), `${uuidv4()}-${fileName}`);
  const response = await axios.get(imageUrl, { responseType: 'stream', timeout: 60000 });

  await new Promise((resolve, reject) => {
    const fsSync = require('fs');
    const writer = fsSync.createWriteStream(tempPath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  return tempPath;
}

router.post('/heatmap', async (req, res, next) => {
  try {
    const { image_url: imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ message: 'Parameter image_url diperlukan.' });
    }

    let imagePath = resolveUploadPath(imageUrl);
    let tempFile = null;

    // If not a valid local path, download from remote URL (including Supabase)
    if (!imagePath || !existsSync(imagePath)) {
      tempFile = await downloadRemoteImage(imageUrl);
      imagePath = tempFile;
    }

    const heatmapResponse = await generateHeatmap(imagePath);

    if (tempFile) {
      const fsSync = require('fs');
      fsSync.unlink(tempFile, () => {});
    }

    res.json(heatmapResponse);
  } catch (error) {
    console.error('[Prediction Heatmap] Route error:', error.message);
    next(error);
  }
});

// ADMIN: Get riwayat klasifikasi semua
router.get('/history', async (req, res, next) => {
  try {
    console.log('[History] Fetching predictions from DB...');
    
    const { data, error } = await supabase
      .from('batik_predictions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[History] Supabase error:', error);
      throw error;
    }

    // Filter out invalid records (missing required fields)
    const validPredictions = (data || []).filter(item => {
      return item && item.prediction_label && item.confidence_score !== null && item.confidence_score !== undefined;
    });

    console.log(`[History] Found ${data?.length || 0} records, ${validPredictions.length} valid`);
    res.json(validPredictions);
  } catch (error) {
    console.error('[History] Route error:', error.message);
    res.status(500).json({ message: 'Gagal mengambil riwayat', error: error.message });
  }
});

module.exports = router;
