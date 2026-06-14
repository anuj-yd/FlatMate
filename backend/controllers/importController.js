const csvParser = require('csv-parser');
const fs = require('fs');

const uploadCsvPreview = async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No CSV file uploaded' });
  }

  // Double check mimetype or extension, though multer can also handle this
  if (file.mimetype !== 'text/csv' && !file.originalname.endsWith('.csv')) {
    fs.unlinkSync(file.path);
    return res.status(400).json({ error: 'Please upload a valid CSV file' });
  }

  try {
    const previewRows = [];
    let rowCount = 0;

    const stream = fs.createReadStream(file.path).pipe(csvParser());

    for await (const row of stream) {
      if (rowCount < 10) {
        previewRows.push(row);
        rowCount++;
      } else {
        stream.destroy(); // Stop reading after 10 rows to save memory/processing
        break;
      }
    }

    // Always clean up the uploaded file as this is just a preview
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    res.json({
      fileName: file.originalname,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      previewRows
    });

  } catch (error) {
    console.error('CSV Preview Upload Error:', error);
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.status(500).json({ error: 'Internal server error while processing CSV' });
  }
};

module.exports = {
  uploadCsvPreview
};
