require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const app = express();
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const joi = require('joi');

app.use(express.urlencoded({ extended: false })); // To parse the body from html post form
app.use(express.json()); // To parse the body of post/fetch request
app.use(cors()); // Enable all CORS requests

const DB_URI = process.env.DB_URI;
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const PORT = process.env.PORT || 5000;
const client = new MongoClient(DB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = joi.object({
    email: joi.string().email().required(),
    displayName: joi.string().required(),
    password: joi.string().required(),
    userLevel: joi.string(),
    creationDate: joi.number().integer()
})

app.post('/signup', (req, res) => {
    try {
        client.connect(async err => {
            if (err) throw err;
            const collection = client.db("rays").collection("users");
            
            try{
                const validatedUser = await userSchema.validateAsync(req.body);
            } catch(err) {
                res.status(500).json({ message: err.details[0].message });
                client.close();
                return;
            }

            // Check for duplicate emails
            const emailCount = await collection.countDocuments({ email:req.body.emailField.toLowerCase() })
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
                    email: req.body.emailField.toLowerCase(),
                    password: hashedPassword,
                    userLevel: 'user',
                    creationDate: Date.now()
                }
                
                // Insert user object
                await collection.insertOne(user);
                
                // Generate token
                const token = jwt.sign({ id: user._id }, ACCESS_TOKEN_SECRET);

                // Send success message
                res.status(201).json({
                    id: user._id,
                    token: token
                });
                client.close();
            }
        })
    } catch(err) {
        res.status(500).json({ message: 'Something went wrong. Please try again later.' });
        client.close();
    };
})

app.post('/login', (req, res) => {
    try {
        client.connect(async err => {
            if (err) throw err;
            const collection = client.db("rays").collection("users");
            
            // Get user object emails
            const user = await collection.findOne({ email:req.body.loginField.toLowerCase() })
            
            // If couldn't find the user
            if (user === null) {
                res.status(400).send({ message:'Wrong email address or password.' });
                client.close();
            }
            
            try {
                // If password matches
                if (await bcrypt.compare(req.body.passwordField, user.password)) {
                    // Generate token
                    const token = jwt.sign({ id: user._id }, ACCESS_TOKEN_SECRET);

                    // Send success message
                    res.status(200).json({
                        id: user._id,
                        token: token
                    });
                    client.close();
                } else {
                    res.status(400).send({ message:'Wrong email address or password.' });
                    client.close();
                }
            } catch {
                res.status(500).send({ message: 'Something went wrong. Please try again later.' })
                client.close();
            }
        })
    } catch(err) {
        res.status(500).json({ message: 'Something went wrong. Please try again later.' });
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

