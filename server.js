require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const app = express();

const DB_URI = process.env.DB_URI;
const PORT = process.env.PORT || 5000;
const db = new MongoClient(DB_URI, { useNewUrlParser: true, useUnifiedTopology: true });


app.get('/', (req, res) => {
    db.connect(err => {
        const collection = db.db("test").collection("devices");
        res.send('Hello World!');
        db.close();
    });
})

app.listen(PORT,
    console.log(`Listening on port ${PORT}...`)
);
