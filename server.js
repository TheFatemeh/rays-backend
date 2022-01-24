require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const app = express();
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const joi = require('joi');
const authorization = require('./authorization');
const { func } = require('joi');

app.use(express.urlencoded({ extended: false })); // To parse the body from html post form
app.use(express.json()); // To parse the body of post/fetch request
app.use(cors()); // Enable all CORS requests

const DB_URI = process.env.DB_URI;
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const PORT = process.env.PORT || 5000;
const client = new MongoClient(DB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = joi.object({
    emailField: joi.string().email().required(),
    displayNameField: joi.string().required(),
    passwordField: joi.string().required(),
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
            
            // Get user object
            const user = await collection.findOne({ email:req.body.loginField.toLowerCase() })
            
            // If couldn't find the user
            if (user === null) {
                res.status(400).send({ message:'Wrong email address or password.' });
                client.close();
                return;
            }
            
            try {
                // If password matches
                if (await bcrypt.compare(req.body.passwordField, user.password)) {
                    // Generate token
                    const token = jwt.sign({ id: user._id }, ACCESS_TOKEN_SECRET);

                    // Send success message
                    res.status(200).json({
                        token: token
                    });
                    client.close();
                } else {
                    res.status(400).send({ message: 'Wrong email address or password.' });
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

app.post('/addCollection', authorization, (req, res) => {
    try {
        client.connect(async err => {

            if (err) throw err;
            const usersDB = client.db("rays").collection("users");

            // Get user object
            const user = await usersDB.findOne({ _id: ObjectId(req.userId) })

            // If couldn't find the user or the user was not an admin
            if (user === null || user.userLevel !== 'admin') {
                res.status(403).send({ message: 'You don\'t have access to this section.' });
                client.close();
                return;
            }

            const collectionsDB = client.db("rays").collection("collections");
            const pollsDB = client.db("rays").collection("polls");
            const choicesDB = client.db("rays").collection("choices");
            
            const collection = req.body;

            const pollIds = [];
            for (const [_, poll] of Object.entries(collection.polls)) {
                
                const choiceIds = [];
                for (const [_, choice] of Object.entries(poll.choices)) {
                    const choiceObject = {
                        name: choice,
                        votes: []
                    }
                    const choiceId = await choicesDB.insertOne(choiceObject);
                    choiceIds.push(choiceId.insertedId);
                }

                const pollObject = {
                    name: poll.name,
                    colorA: poll.colorA,
                    colorB: poll.colorB,
                    choices: choiceIds,
                    lastVote: {}
                }
                const pollId = await pollsDB.insertOne(pollObject);
                pollIds.push(pollId.insertedId);
            }
            
            const collectionObject = {
                name: collection.name,
                description: collection.description,
                colorA: collection.colorA,
                colorB: collection.colorB,
                polls: pollIds,
                comments: [],
                creationDate: Date.now()
            }
            const collectionId = await collectionsDB.insertOne(collectionObject);

            console.log(req.body);
            res.status(201).send(collectionId);
            client.close();
        })
    } catch(err) {
        res.status(500).json({ message: 'Something went wrong. Please try again later.' });
        client.close();
    };
})


app.get('/getCollections', (req, res) => {
    try {
        client.connect(async err => {
            if (err) throw err;
            const collectionsDB = client.db("rays").collection("collections");

            // Get collection objects
            await collectionsDB.find({}, {projection: {polls: 0, comments: 0}})
            .sort({creationDate: -1}).limit(10).toArray((err, result) => {
                if (err) throw err;
                console.log(result);
                res.status(200).json(result);
            });
            client.close();
        })
    } catch(err) {
        res.status(500).json({ message: 'Something went wrong. Please try again later.' });
        client.close();
    };
})

app.post('/getCollectionById', (req, res) => {
    try {
        client.connect(async err => {
            if (err) throw err;
            const collectionsDB = client.db("rays").collection("collections");
            const pollsDB = client.db("rays").collection("polls");

            // Get collection objects
            const collection = await collectionsDB.findOne({ _id: ObjectId(req.body.collectionId) });

            // Get poll objects by their IDs
            let polls = [];
            for (var i = 0; i < collection.polls.length; i++) {
                polls.push(await pollsDB.findOne({ _id: collection.polls[i] }, {projection: {choices: 0, lastVote: 0}}));
            }
            collection.polls = polls;

            console.log(collection);
            res.status(200).json(collection);
            client.close();
        })
    } catch(err) {
        res.status(500).json({ message: 'Something went wrong. Please try again later.' });
        client.close();
    };    
})

app.post('/getPollById', authorization, (req, res) => {
    try {
        client.connect(async err => {
            if (err) throw err;
            const pollsDB = client.db("rays").collection("polls");
            const choicesDB = client.db("rays").collection("choices");

            // Get collection objects
            const poll = await pollsDB.findOne({ _id: ObjectId(req.body.pollId) });

            // Get choice objects by their IDs
            let choices = [];
            for (var i = 0; i < poll.choices.length; i++) {
                let choice = await choicesDB.findOne({ _id: poll.choices[i] });
                choice.voteCount = choice.votes.length; // Let the user just see the number of votes, not voters
                delete(choice.votes);
                choices.push(choice);
            }
            poll.choices = choices;

            // Check if user can vote (It's been more than a day since its last vote)
            if (!poll.lastVote[req.userId] || Date.now() - poll.lastVote[req.userId] > 86400) {
                poll.canVote = true;
            } else {
                poll.canVote = false;
            }
            delete(poll.lastVote);

            console.log(poll);
            res.status(200).json(poll);
            client.close();
        })
    } catch(err) {
        res.status(500).json({ message: 'Something went wrong. Please try again later.' });
        client.close();
    };    
})



app.get('/', (req, res) => {
    client.connect(err => {
        // const collection = client.db("test").collection("devices");
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

