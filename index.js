const express = require('express');
const cors = require('cors');
const User = require('./models/user');
const Post = require('./models/post');
const app = express();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
var cookieParser = require('cookie-parser')
const multer = require('multer');
const uploadMiddleWare = multer({ dest: 'uploads/' });
const fs = require('fs');
require('dotenv').config();


const saltRounds = process.env.SALTROUNDS;
const secretKey = process.env.SECRETKEY;
const port = process.env.PORT;
const uri = process.env.URI;

app.use(cors({ credentials: true, origin: 'https://myblog-api.onrender.com' }));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));
mongoose.connect('mongodb+srv://aalishan69raza:5wUfuLqElBiT60eY@cluster0.dwruyrs.mongodb.net/?retryWrites=true&w=majority');


app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const salt = bcrypt.genSaltSync(saltRounds);
    const hash = bcrypt.hashSync(password, salt);
    try {
        const userDoc = await User.create({ username, password: hash });
        res.json(userDoc);
    } catch (error) {
        res.status(400).json(error);
    }
})


app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userDoc = await User.findOne({ username });
        const passOk = bcrypt.compareSync(password, userDoc.password);
        if (passOk) {
            //logged in
            jwt.sign({ username, id: userDoc._id }, secretKey, {}, (err, token) => {
                if (err) res.status(400).json(err);
                res.cookie('token', token).json({
                    id: userDoc._id,
                    username
                });
            });

        } else {
            res.status(400).json('wrong credentials');
        }
    } catch (error) {
        res.status(400).json(error);
    }
})

app.get('/profile', (req, res) => {
    const { token } = req.cookies;
    try {
        jwt.verify(token, secretKey, {}, (err, info) => {
            if (err) res.status(400).json(err);
            res.json(info);
        });
    } catch (error) {
        console.log("/profile error");
    }

})

app.post('/logout', (req, res) => {
    try {
        res.cookie('token', '').json('ok')
    } catch (error) {
        console.log(error);
    }

})

app.post('/post', uploadMiddleWare.single('file'), async (req, res) => {
    const { originalname, path } = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    const newPath = path + '.' + ext
    fs.renameSync(path, newPath);

    const { title, summary, content } = req.body;
    const { token } = req.cookies;

    try {
        jwt.verify(token, secretKey, {}, async (err, info) => {
            if (err) res.status(400).json(err);
            const postDoc = await Post.create({
                title,
                summary,
                content,
                cover: newPath,
                author: info.id
            })
            res.json(postDoc);
        });
    } catch (error) {
        console.log("post /post error");
    }

})

app.get('/post', async (req, res) => {
    const posts = await Post.find()
        .populate('author', 'username')
        .sort({ createdAt: -1 });
    res.json(posts);
})

app.get('/post/:id', async (req, res) => {
    const { id } = req.params
    const postDoc = await Post.findById(id).populate('author', 'username');
    res.json(postDoc);
})

app.put('/post', uploadMiddleWare.single('file'), async (req, res) => {
    let newPath = null;
    if (req.file) {
        const { originalname, path } = req.file;
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        newPath = path + '.' + ext;
        fs.renameSync(path, newPath);
    }
    const { token } = req.cookies;
    jwt.verify(token, secretKey, {}, async (err, info) => {
        if (err) res.status(400).json(err);
        const { id, title, summary, content } = req.body;
        const postDoc = await Post.findById(id);
        const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
        if (!isAuthor) {
            return res.status(400).json('you are not the author');
        }
        await postDoc.updateOne({
            title,
            summary,
            content,
            cover: newPath ? newPath : postDoc.cover,
        });

        res.json(postDoc);
    });

})

app.listen(port, () => {
    console.log(`app running on Port ${port}`)
});
