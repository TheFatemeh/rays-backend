require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const app = express();
const bcrypt = require('bcrypt');

app.use(express.urlencoded({ extended: false })); // To parse the body from html post form
app.use(express.json()); // To parse the body of post/fetch request

const DB_URI = process.env.DB_URI;
const PORT = process.env.PORT || 5000;
const client = new MongoClient(DB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

app.post('/signup', (req, res) => {
    try {
        client.connect(async err => {
            if (err) throw err;
            const collection = client.db("rays").collection("users");
            
            // Check for duplicate emails
            const emailCount = await collection.countDocuments({email:"saeed.ahmadnia@outlook.com"})
            if (emailCount > 0) {
                res.status(400).json({ message: 'An account associated with this email address already exists.' });
            }
            // If everything was okay
            else {
                // Hash the password
                const salt = await bcrypt.genSalt();
                const hashedPassword = await bcrypt.hash(req.body.passwordField, salt);

                // Prepare user object
                const user = {
                    displayName: req.body.displayNameField,
                    email: req.body.emailField,
                    password: hashedPassword,
                    userLevel: 'user',
                    creationDate: Date.now()
                }

                // Insert user object
                await collection.insertOne(user);

                // Send success message
                res.status(201).json(user);
                client.close();
            }
        })
    } catch(err) {
        res.status(500).json({ message: 'Something went wrong. Please try again later.' });
        console.log(err);
        client.close();
    };
})

app.get('/', (req, res) => {
    client.connect(err => {
        const collection = client.db("test").collection("devices");
        res.send('Hello World!');
        client.close();
    });
})

// app.get('/test', (req, res) => {
//     client.connect(async err => {
//         if (err) throw err;
//         const collection = client.db("rays").collection("users");
        
//         // Send success message
//         res.status(201).json({ message: emailCount });
//         client.close();
//     })
// })

app.listen(PORT,
    console.log(`Listening on port ${PORT}...`)
);
