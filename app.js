// دالة إرسال الملف للضغط عبر Cloudflare Worker
async function compressViaServer(file) {
  const workerApiUrl = 'https://rough-unit-b715.salim07907.workers.dev';

  const response = await fetch(workerApiUrl, {
    method: 'POST',
    body: await file.arrayBuffer(),
    headers: {
      'Content-Type': 'application/pdf'
    }
  });

  if (!response.ok) {
    throw new Error('فشل الضغط عبر السيرفر');
  }

  const compressedBuffer = await response.arrayBuffer();
  return new Blob([compressedBuffer], { type: 'application/pdf' });
}
