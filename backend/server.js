require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

app.listen(3000, () => {
    console.log('Server started on port 3000');
});
