const fs = require('fs');
const path = require('path');

async function testJob() {
  try {
    const filePath = path.join(__dirname, 'test_upload.txt');
    if (!fs.existsSync(filePath)) {
       fs.writeFileSync(filePath, 'This is a test document containing some information. The capital of France is Paris. Water boils at 100 degrees Celsius.');
    }

    const fileContent = fs.readFileSync(filePath);
    
    const formData = new FormData();
    formData.append('file', new Blob([fileContent], { type: 'text/plain' }), 'test_upload.txt');

    console.log('Uploading document...');
    const uploadRes = await fetch('http://localhost:5000/api/upload-document', {
      method: 'POST',
      body: formData
    });

    const uploadDataText = await uploadRes.text();
    console.log('Upload response raw:', uploadDataText);
    const uploadData = JSON.parse(uploadDataText);

    if (uploadData.jobId) {
       console.log('Polling job status...');
       for (let i = 0; i < 5; i++) {
         const statusRes = await fetch(`http://localhost:5000/api/jobs/${uploadData.jobId}`);
         const statusData = await statusRes.json();
         console.log(`Poll ${i+1}:`, { status: statusData.status, progress: statusData.progress, parsedCount: statusData.parsedQuestions?.length });
         if (statusData.status === 'completed' || statusData.status === 'failed') {
            break;
         }
         await new Promise(resolve => setTimeout(resolve, 2000));
       }
    }
  } catch (err) {
    console.error('Test failed:', err);
  }
}

testJob();
