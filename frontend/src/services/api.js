import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/+$|\/$/, '') || 'https://batik-klasifikasi.onrender.com';
export const API_ROOT = API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`;
export const ML_BASE = import.meta.env.VITE_ML_URL || `${API_ROOT}/ml`;

export const api = axios.create({
  baseURL: API_ROOT,
});

// Interceptor untuk menangani SEMUA request sebelum dikirim
api.interceptors.request.use((config) => {
  // 1. Ambil token langsung dari storage SETIAP KALI ada request
  const token = localStorage.getItem('admin_token');

  // 2. Jika token ada, suntikkan ke header
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // 3. Tambahkan header cache tanpa merusak struktur objek bawaan Axios
  config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  config.headers['Pragma'] = 'no-cache';
  config.headers['Expires'] = '0';

  // 4. Tambahkan cache busting untuk admin routes dengan timestamp
  if (config.url?.includes('/admin')) {
    const separator = config.url?.includes('?') ? '&' : '?';
    config.url = `${config.url}${separator}_t=${Date.now()}`;
  }

  // 5. Hapus content-type jika data berupa FormData (agar browser set boundary otomatis)
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Fungsi ini tetap dipertahankan untuk kompatibilitas jika ada komponen yang memanggilnya,
// tapi logika utamanya kita ubah untuk update localStorage juga.
export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('admin_token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem('admin_token');
    delete api.defaults.headers.common['Authorization'];
  }
}