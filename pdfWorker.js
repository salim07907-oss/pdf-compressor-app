importScripts('https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js');

self.onmessage = async function(e) {
  const { fileData } = e.data;
  
  try {
    // تحميل وقراءة الـ PDF
    const pdfDoc = await PDFLib.PDFDocument.load(fileData, { ignoreEncryption: true });
    
    // ضغط هيكل الملف والكائنات
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true
    });
    
    self.postMessage({ status: 'success', compressedBytes });
  } catch (error) {
    self.postMessage({ status: 'error', error: error.message });
  }
};
