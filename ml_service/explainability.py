import os
import time
from pathlib import Path

# Lazy-import OpenCV; fallback to PIL/numpy where possible for headless environments
try:
    import cv2
    _CV2_AVAILABLE = True
except Exception:
    cv2 = None
    _CV2_AVAILABLE = False

import numpy as np
import tensorflow as tf
from tensorflow.keras.applications.efficientnet import preprocess_input
from tensorflow.keras.preprocessing import image
from PIL import Image as PILImage

BASE_DIR = Path(__file__).resolve().parent
HEATMAP_DIR = BASE_DIR / 'heatmaps'
HEATMAP_DIR.mkdir(parents=True, exist_ok=True)


def find_last_conv_layer(model):
    for layer in reversed(model.layers):
        shape = getattr(layer, 'output_shape', None)
        if isinstance(shape, tuple) and len(shape) == 4 and 'conv' in layer.name.lower():
            return layer

    for layer in reversed(model.layers):
        shape = getattr(layer, 'output_shape', None)
        if isinstance(shape, tuple) and len(shape) == 4:
            return layer

    raise ValueError('Tidak menemukan layer konvolusi terakhir pada model.')


def rgba_to_rgb_with_pil(img_array: np.ndarray) -> np.ndarray:
    pil = PILImage.fromarray(img_array.astype('uint8'), 'RGBA').convert('RGB')
    return np.array(pil)


def preprocess_image_for_model(image_path, target_size=(180, 180)):
    img = image.load_img(image_path, target_size=target_size)
    img_array = image.img_to_array(img)
    if img_array.shape[-1] == 4:
        if _CV2_AVAILABLE:
            img_array = cv2.cvtColor(img_array.astype('uint8'), cv2.COLOR_RGBA2RGB)
        else:
            img_array = rgba_to_rgb_with_pil(img_array)

    img_array = np.expand_dims(img_array, axis=0)
    return preprocess_input(img_array)


def build_gradcam_heatmap(img_tensor, model, last_conv_layer):
    grad_model = tf.keras.models.Model(
        [model.inputs], [last_conv_layer.output, model.output]
    )

    with tf.GradientTape() as tape:
        conv_outputs, predictions = grad_model(img_tensor)
        pred_index = tf.argmax(predictions[0])
        class_channel = predictions[:, pred_index]

    grads = tape.gradient(class_channel, conv_outputs)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
    conv_outputs = conv_outputs[0]

    heatmap = conv_outputs * pooled_grads
    heatmap = tf.reduce_sum(heatmap, axis=-1)
    heatmap = tf.maximum(heatmap, 0)
    heatmap = heatmap / (tf.math.reduce_max(heatmap) + 1e-10)
    return heatmap.numpy()


def overlay_heatmap_on_image(original_path, heatmap, output_path, alpha=0.4):
    # If OpenCV is not available, use PIL to combine heatmap and original
    if _CV2_AVAILABLE:
        original = cv2.imread(original_path)
        if original is None:
            raise FileNotFoundError(f'Gambar asli tidak ditemukan: {original_path}')

        heatmap_img = cv2.resize(np.uint8(255 * heatmap), (original.shape[1], original.shape[0]))
        heatmap_img = cv2.applyColorMap(heatmap_img, cv2.COLORMAP_JET)
        overlay = cv2.addWeighted(heatmap_img, alpha, original, 1 - alpha, 0)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        cv2.imwrite(output_path, overlay)
        return output_path
    else:
        # PIL fallback: convert heatmap to RGB and blend
        original_pil = PILImage.open(original_path).convert('RGB')
        original_np = np.array(original_pil)
        heatmap_resized = np.array(PILImage.fromarray(np.uint8(255 * heatmap)).resize((original_np.shape[1], original_np.shape[0])))
        # Normalize heatmap to RGB jet-like coloring using matplotlib if available, otherwise grayscale
        try:
            import matplotlib
            import matplotlib.cm as mcm
            cmap = mcm.get_cmap('jet')
            heatmap_colored = (cmap(heatmap_resized / 255.0)[:, :, :3] * 255).astype('uint8')
        except Exception:
            heatmap_colored = np.stack([heatmap_resized] * 3, axis=-1)

        overlay = (alpha * heatmap_colored + (1 - alpha) * original_np).astype('uint8')
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        PILImage.fromarray(overlay).save(output_path)
        return output_path


def generate_heatmap_overlay(model, image_path, target_size=(180, 180), alpha=0.4):
    img_tensor = preprocess_image_for_model(image_path, target_size=target_size)
    predictions = model.predict(img_tensor, verbose=0)
    class_index = int(np.argmax(predictions[0]))

    last_conv_layer = find_last_conv_layer(model)
    heatmap = build_gradcam_heatmap(img_tensor, model, last_conv_layer)

    filename = f'heatmap-{int(time.time())}.png'
    output_path = HEATMAP_DIR / filename
    overlay_heatmap_on_image(image_path, heatmap, str(output_path), alpha=alpha)

    return str(output_path), float(predictions[0][class_index])
