const ONE_MB = 1 * 1024 * 1024;
const HUNDRED_MB = 100 * 1024 * 1024;

const pdfInput = document.getElementById('pdfInput');
const fileListContainer = document.getElementById('fileList');
const compressBtn = document.getElementById('compressBtn');

let selectedFiles = [];

pdfInput.addEventListener('change', (e) => {
  selectedFiles = Array.from(e.target.files);
  renderFiles();
});

function renderFiles() {
  fileListContainer.innerHTML = '';
  if (selectedFiles.length > 0) {
    compressBtn.style.display = 'block';
  }

  selectedFiles.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <div>
        <strong>${file.name}</strong> (${(file.size / (1024 * 1024)).toFixed(2)} MB)
        <div class="progress-bar" id="progress-${index}"></div>
      </div>
      <span id="status-${index}">جاهز</span>
    `;
    fileListContainer.appendChild(item);
  });
}

compressBtn.addEventListener('click', async () => {
  compressBtn.disabled = true;

  for (let i = 0; i < selectedFiles.length; i++) {
    const file = selectedFiles[i];
    const statusElem = document.getElementById(`status-${i}`);
    const progressElem = document.getElementById(`progress-${i}`);

    statusElem.innerText = 'جاري الضغط...';
    progressElem.style.width = '50%';

    try {
      const compressedBlob = await processFileSmart(file);
      
      // تجهيز رابط التنزيل
      const downloadUrl = URL.createObjectURL(compressedBlob);
      statusElem.innerHTML = `<a href="${downloadUrl}" download="compressed_${file.name}" style="color: #16a34a; font-weight: bold;">تحميل</a>`;
      progressElem.style.width = '100%';
    } catch (err) {
      statusElem.innerText = 'حدث خطأ';
      statusElem.style.color = '#dc2626';
    }
  }
});

// الخوارزمية الذكية للتوجيه
async function processFileSmart(file) {
  const size = file.size;

  // أقل من 1MB أو أكثر من 100MB -> المتصفح مباشرة عبر الـ Worker
  if (size < ONE_MB || size > HUNDRED_MB) {
    return await compressWithWorker(file);
  }

  // بين 1MB و 100MB -> المحاولة عبر السيرفر أولاً ثم المتصفح
  try {
    return await compressViaServer(file);
  } catch (e) {
    return await compressWithWorker(file);
  }
}

// المعالجة عبر Web Worker
function compressWithWorker(file) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('pdfWorker.js');
    const reader = new FileReader();

    reader.onload = function() {
      worker.postMessage({ fileData: reader.result });
    };

    worker.onmessage = function(e) {
      if (e.data.status === 'success') {
        const blob = new Blob([e.data.compressedBytes], { type: 'application/pdf' });
        resolve(blob);
      } else {
        reject(e.data.error);
      }
      worker.terminate();
    };

    reader.readAsArrayBuffer(file);
  });
}

// دالة وهمية للسيرفر (سيتم ربطها بـ Cloudflare لاحقاً)
async function compressViaServer(file) {
  // حالياً تحول للـ Worker حتى نربط الـ API
  return await compressWithWorker(file);
}
