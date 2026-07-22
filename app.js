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
        // تمرير الملفات للمعالجة
        await handleFilesUpload(e.target.files);
        
        // 💡 إصلاح هام: تصفير الحقل حتى يتمكن المستخدم من رفع نفس الملف مرة أخرى دون مشاكل
        e.target.value = ''; 
      }
    });
  }

  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => e.preventDefault());
    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        await handleFilesUpload(e.dataTransfer.files);
      }
    });
  }
});

// ==========================================
// 3. معالجة قائمة الملفات (طابور العمل لـ 20 ملفاً)
// ==========================================
async function handleFilesUpload(fileList) {
  const files = Array.from(fileList).slice(0, MAX_FILES);

  for (const file of files) {
    try {
      let compressedBlob;
      // قراءة الملف كـ ArrayBuffer لاستخدامه بأمان في كل السيناريوهات
      const baseBuffer = await file.arrayBuffer();

      // 🧵 الشرط الأول: ملف < 1MB أو > 100MB (Web Worker في خط سير منفصل)
      if (file.size < MIN_SERVER_SIZE || file.size > MAX_SERVER_SIZE) {
        console.log(`[Web Worker Thread] معالجة محلية للملف: ${file.name}`);
        compressedBlob = await compressInWebWorker(baseBuffer.slice(0));
      } 
      // 🌐 الشرط الثاني: بين 1MB و 100MB (التسلسل عبر السيرفرات)
      else {
        try {
          console.log(`[Cloudflare Worker] جاري الضغط عبر Cloudflare للملف: ${file.name}`);
          compressedBlob = await compressViaApi(CLOUDFLARE_URL, baseBuffer.slice(0));
        } catch (cfError) {
          console.warn('[Vercel Fallback] فشل Cloudflare، جاري التحويل لـ Vercel...', cfError);
          try {
            compressedBlob = await compressViaApi(VERCEL_URL, baseBuffer.slice(0));
          } catch (vercelError) {
            console.error('[Web Worker Fallback] فشل السيرفرين! تحويل للضغط المحلي...', vercelError);
            compressedBlob = await compressInWebWorker(baseBuffer.slice(0));
          }
        }
      }

      // تحميل الملف النهائي فور اكتماله
      downloadFile(compressedBlob, `compressed_${file.name}`);

    } catch (error) {
      console.error(`خطأ غير متوقع أثناء معالجة الملف ${file.name}:`, error);
    }
  }
}

// ==========================================
// 4. خط السير المنفصل للمتصفح (Web Worker Thread)
// ==========================================
function compressInWebWorker(arrayBuffer) {
  return new Promise((resolve, reject) => {
    try {
      const workerScript = `
        importScripts('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js');

        self.onmessage = async function(e) {
          try {
            const buffer = e.data;
            const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
            const compressedBytes = await pdfDoc.save({ useObjectStreams: true });
            
            self.postMessage({ success: true, bytes: compressedBytes });
          } catch (err) {
            self.postMessage({ success: false, error: err.message });
          }
        };
      `;

      const blob = new Blob([workerScript], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));

      // إرسال البيانات للعمل في الخلفية (Background Thread)
      worker.postMessage(arrayBuffer, [arrayBuffer]);

      worker.onmessage = function(e) {
        worker.terminate(); // تنظيف الذاكرة
        if (e.data.success) {
          resolve(new Blob([e.data.bytes], { type: 'application/pdf' }));
        } else {
          reject(new Error(e.data.error));
        }
      };

      worker.onerror = function(err) {
        worker.terminate();
        reject(new Error('حدث خطأ داخل المعالجة المحلية (Web Worker)'));
      };
    } catch (err) {
      reject(err);
    }
  });
}

// ==========================================
// 5. دالة الاتصال بالـ APIs (Fetch)
// ==========================================
async function compressViaApi(apiUrl, arrayBuffer) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    body: arrayBuffer,
    headers: { 'Content-Type': 'application/pdf' }
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
