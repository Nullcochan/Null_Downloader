const https = require('https');
const fs = require('fs');
const path = require('path');

const data = JSON.stringify({
    url: 'https://www.youtube.com/watch?v=RJXALPS3cl0',
    download_type: 'video',
    title: 'G4L_Live_Attempt'
});

const options = {
    hostname: 'null-downloader.onrender.com',
    port: 443,
    path: '/download',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    },
    timeout: 180000 // 3 minutes
};

const outputFilePath = path.join(__dirname, 'Live_Download_Result.mp4');
const fileStream = fs.createWriteStream(outputFilePath);

console.log('Attempting DOWNLOAD from LIVE SERVER (null-downloader.onrender.com)...');
console.log('Target URL: https://www.youtube.com/watch?v=RJXALPS3cl0');

const req = https.request(options, (res) => {
    console.log(`Response Status: ${res.statusCode}`);

    if (res.statusCode !== 200) {
        let errorBody = '';
        res.on('data', chunk => errorBody += chunk);
        res.on('end', () => {
            console.error('LIVE DOWNLOAD FAILED. Server Response:');
            console.error('---------------------------------------------------');
            console.error(errorBody);
            console.error('---------------------------------------------------');
            console.error('This proves the live server is rejecting the request.');
            process.exit(1);
        });
        return;
    }

    console.log('Live server accepted request! Receiving data...');
    res.pipe(fileStream);

    fileStream.on('finish', () => {
        fileStream.close();
        const stats = fs.statSync(outputFilePath);
        if (stats.size < 1000) {
            console.error('WARNING: File too small, likely an error page saved as mp4.');
        }
        console.log(`SUCCESS? Download finished. File size: ${stats.size} bytes`);
        process.exit(0);
    });
});

req.on('error', (e) => {
    console.error('Connection Error:', e.message);
    process.exit(1);
});

req.write(data);
req.end();
