// ==========================================
// 1. الإعدادات والحدود البرمجية
// ==========================================
const MAX_FILES = 20;                      // الحد الأقصى 20 ملفاً

const CLOUDFLARE_URL = 'https://rough-unit-b715.salim07907.workers.dev';
const VERCEL_URL = 'https://pdf-compressor-app-tau.vercel.app/api/compress';

// ==========================================
// 2. ربط الأحداث بالواجهة (Input & Drag/Drop)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileInput');
  const dropZone = document.getElementById('dropZone');

  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const quality = document.getElementById('qualitySelect')?.value || 'medium';
        await handleFilesUpload(e.target.files, quality);
        e.target.value = ''; // تصفير الحقل لإتاحة رفع نفس الملف مجدداً
      }
    });
  }

  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => e.preventDefault());
    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const quality = document.getElementById('qualitySelect')?.value || 'medium';
        await handleFilesUpload(e.dataTransfer.files, quality);
      }
    });
  }
});

// ==========================================
// 3. معالجة قائمة الملفات (إرسال مباشر للسيرفر لضمان الضغط الفعلي)
// ==========================================
async function handleFilesUpload(fileList, quality) {
  const files = Array.from(fileList).slice(0, MAX_FILES);

  for (const file of files) {
    try {
      let compressedBlob;
      const baseBuffer = await file.arrayBuffer();

      console.log(`[Compression Server] جاري ضغط الملف عبر السيرفر (${quality}): ${file.name}`);

      // محاولة الضغط عبر Cloudflare أولاً
      try {
        compressedBlob = await compressViaApi(CLOUDFLARE_URL, baseBuffer.slice(0), quality);
      } catch (cfError) {
        console.warn('[Vercel Fallback] فشل Cloudflare، جاري التحويل لـ Vercel...', cfError);
        // التحويل الاحتياطي السريع إلى Vercel
        compressedBlob = await compressViaApi(VERCEL_URL, baseBuffer.slice(0), quality);
      }

      // تنزيل الملف المضغوط الحقيقي
      downloadFile(compressedBlob, `compressed_${file.name}`);

    } catch (error) {
      console.error(`خطأ أثناء معالجة الملف ${file.name}:`, error);
      alert(`عذراً، حدث خطأ أثناء ضغط الملف ${file.name}. تأكد من حجم الملف أو اتصال الإنترنت.`);
    }
  }
}

// ==========================================
// 4. دالة الاتصال بالـ APIs (السيرفر)
// ==========================================
async function compressViaApi(apiUrl, arrayBuffer, quality) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    body: arrayBuffer,
    headers: { 
      'Content-Type': 'application/pdf',
      'X-Compression-Quality': quality
    }
  });

  if (!response.ok) throw new Error(`HTTP Error Status: ${response.status}`);
  const compressedBuffer = await response.arrayBuffer();
  return new Blob([compressedBuffer], { type: 'application/pdf' });
}

// ==========================================
// 5. دالة تنزيل الملف المضغوط
// ==========================================
function downloadFile(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
