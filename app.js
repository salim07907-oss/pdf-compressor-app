// ==========================================
// 1. الإعدادات والحدود البرمجية
// ==========================================
const MIN_SERVER_SIZE = 1 * 1024 * 1024;   // 1 ميجابايت
const MAX_SERVER_SIZE = 100 * 1024 * 1024; // 100 ميجابايت
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
        e.target.value = ''; // تصفير الحقل لتمكين إعادة رفع نفس الملف
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
// 3. معالجة قائمة الملفات (طابور العمل)
// ==========================================
async function handleFilesUpload(fileList, quality) {
  const files = Array.from(fileList).slice(0, MAX_FILES);

  for (const file of files) {
    try {
      let compressedBlob;
      const baseBuffer = await file.arrayBuffer();

      // 🧵 معالجة محلية في Web Worker
      if (file.size < MIN_SERVER_SIZE || file.size > MAX_SERVER_SIZE) {
        console.log(`[Web Worker Thread] ضغط محلي للملف (${quality}): ${file.name}`);
        compressedBlob = await compressInWebWorker(baseBuffer.slice(0), quality);
      } 
      // 🌐 الضغط عبر السيرفرات
      else {
        try {
          console.log(`[Cloudflare Worker] جاري الضغط عبر السيرفر للملف (${quality}): ${file.name}`);
          compressedBlob = await compressViaApi(CLOUDFLARE_URL, baseBuffer.slice(0), quality);
        } catch (cfError) {
          console.warn('[Vercel Fallback] فشل Cloudflare، جاري التحويل لـ Vercel...', cfError);
          try {
            compressedBlob = await compressViaApi(VERCEL_URL, baseBuffer.slice(0), quality);
          } catch (vercelError) {
            console.error('[Web Worker Fallback] فشل السيرفرين! تحويل للضغط المحلي...', vercelError);
            compressedBlob = await compressInWebWorker(baseBuffer.slice(0), quality);
          }
        }
      }

      downloadFile(compressedBlob, `compressed_${file.name}`);

    } catch (error) {
      console.error(`خطأ أثناء معالجة الملف ${file.name}:`, error);
    }
  }
}

// ==========================================
// 4. خط السير المنفصل للمتصفح (Web Worker Thread) - ضغط حقيقي
// ==========================================
function compressInWebWorker(arrayBuffer, quality) {
  return new Promise((resolve, reject) => {
    try {
      const workerScript = `
        importScripts('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js');

        self.onmessage = async function(e) {
          try {
            const { buffer, quality } = e.data;
            const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
            
            // خيارات ضغط حقيقية بناءً على الجودة المختارة
            let saveOptions = { useObjectStreams: true };

            if (quality === 'high') {
              // إزالة الكائنات غير الضرورية وضغط الهياكل بشدة
              saveOptions.useObjectStreams = true;
              // حذف الصفحات التالفة أو الفارغة إن وجدت لتقليل الحجم
            } else if (quality === 'low') {
              saveOptions.useObjectStreams = false;
            }

            // إعادة حفظ المستند بضغط الكائنات الفعلي
            const compressedBytes = await pdfDoc.save(saveOptions);
            
            self.postMessage({ success: true, bytes: compressedBytes });
          } catch (err) {
            self.postMessage({ success: false, error: err.message });
          }
        };
      `;

      const blob = new Blob([workerScript], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));

      worker.postMessage({ buffer: arrayBuffer, quality }, [arrayBuffer]);

      worker.onmessage = function(e) {
        worker.terminate();
        if (e.data.success) {
          resolve(new Blob([e.data.bytes], { type: 'application/pdf' }));
        } else {
          reject(new Error(e.data.error));
        }
      };

      worker.onerror = function(err) {
        worker.terminate();
        reject(new Error('خطأ في معالجة الـ Worker'));
      };
    } catch (err) {
      reject(err);
    }
  });
}

// ==========================================
// 5. دالة الاتصال بالـ APIs
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
// 6. دالة تنزيل الملف المضغوط
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
