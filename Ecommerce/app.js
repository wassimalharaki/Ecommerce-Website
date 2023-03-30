//customer to customer ecommerce website

const items = require('./models/items');
const users = require('./models/users');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const express = require('express');
const app = express();
var fs = require('fs');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname,"css")));
app.use(express.static(path.join(__dirname,"images")));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const mongoURI = "mongodb://127.0.0.1:27017/Items";
mongoose.connect(mongoURI).then(console.log("Connected to Database"));
var db = mongoose.connection;

app.use(session({
    secret: 'dont stop',
    resave: true,
    saveUninitialized: false,
    store: new MongoStore({
        mongooseConnection: db
    })
}));


var multer = require('multer');
var storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads')
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now())
    }
});
var upload = multer({ storage: storage });


app.get('/', (req, res) => {
    if (!req.session.isLoggedIn)
        req.session.isLoggedIn = false;
    if (!req.session.role)
        req.session.role = "User";
    if (!req.session.userID)
        req.session.userID = 0;
    
    res.render('home', {
        isLoggedIn: req.session.isLoggedIn,
        role: req.session.role
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.post('/login', async (req, res) => {
    var userInfo = req.body 

    var data = await users.findOne({username: userInfo.usernameLogin});

    if (!data) {
        res.send({"status": "Invalid username or password"});
        return;
    }

    var rightPass = await bcrypt.compare(userInfo.passwordLogin, data.password);

    if (!rightPass) {
        res.send({"status": "Invalid username or password"});
        return;
    }

    req.session.userID = data.userID;
    req.session.isLoggedIn = true;
    req.session.role = data.role;

    res.send({"status": "Logged In"});
})

app.post('/signup', async (req, res) => {
    var userInfo = req.body;

    var data = await users.findOne({username: userInfo.usernameSignup});

    if (data) {
        res.send({"status": "Username Taken"});
        return;
    }

    if (userInfo.passwordSignup != userInfo.passwordRSignup) {
        res.send({"status": "Password Error"});
        return;
    }
    
    var encPass = await bcrypt.hash(userInfo.passwordSignup, 10);

    var recent = await users.findOne().sort({_id: -1}).limit(1);

    var userID = 1;

    if (recent)
        userID = recent.userID + 1;

    await users.create({
        userID: userID,
        username: userInfo.usernameSignup,
        password: encPass,
        name: userInfo.nameSignup,
        phoneNumber: userInfo.numberSignup
    });
    req.session.userID = userID;
    req.session.isLoggedIn = true;
    req.session.role = "User";

    res.send({"status": "User Created"});
});

app.get('/users', async (req, res) => {
    var findUsers, allow;
    if (req.session.role == "Admin") {
        findUsers = await users.find({role: "User"});
        allow = "disabled";
    }
    else if (req.session.role = "Superadmin") {
        findUsers = await users.find({role: {$ne: "Superadmin"}}).sort({role: 1});
        allow = "";
    }

    res.render('users', {
        users: findUsers,
        allow: allow
    });
});

app.post('/updateUser', async (req, res) => {
    var user = req.body;
    await users.updateOne({
        userID: user.id
    }, {
        $set: {
            name: user.name,
            role: user.role,
            phoneNumber: user.phoneNumber
        }
    });

    var findUsers;
    if (req.session.role == "Admin")
        findUsers = await users.find({role: "User"});
    else if (req.session.role = "Superadmin")
        findUsers = await users.find({role: {$ne: "Superadmin"}}).sort({role: 1});

    res.send(findUsers);
});

app.post('/deleteUser', async (req, res) => {
    var user = req.body;

    await users.deleteOne({userID: user.id});

    var findUsers;
    if (req.session.role == "Admin")
        findUsers = await users.find({role: "User"});
    else if (req.session.role = "Superadmin")
        findUsers = await users.find({role: {$ne: "Superadmin"}}).sort({role: 1});

    res.send(findUsers);
});

app.post('/searchUsers', async (req, res) => {
    var string = req.body.search.trim();

    var usersSearched = await users.find({
        $and: [
            {
                $or: [
                    {name: new RegExp(string, 'i')},
                    {username: new RegExp(string, 'i')}
                ]
            },{
                role: {$ne: "Superadmin"}
            }
        ]
    });

    res.send(usersSearched);
});

app.get('/insert', (req, res) => {
    res.render('insert');
});

app.post('/insert', upload.single('imageItem'), async (req, res) => {
    var ext = "image/";
    var item = req.body;
    findExt(req.file.originalname, req.file.originalname.length - 1);
    function findExt(origName, index) {
        if (origName[index] == '.')
            return;
        findExt(origName, index - 1);
        ext += origName[index];
    }
    var user = await users.findOne({userID: req.session.userID});

    var recent = await items.findOne().sort({_id: -1}).limit(1);

    var itemID = 1;

    if (recent)
        itemID = recent.itemID + 1;

    await items.create({
        itemID: itemID,
        itemName: item.itemName,
        itemPrice: item.itemPrice,
        itemDescription: item.itemDescription,
        itemImage: {
            data: fs.readFileSync(path.join(__dirname + '/uploads/' + req.file.filename)),
            contentType: ext
        },
        userID: user.userID,
        name: user.name,
        phoneNumber: user.phoneNumber
    });
    setTimeout(() => {res.redirect('/myitems');}, 1500);
});

app.get('/myitems', async (req, res) => {
    var myitems = await items.find({userID: req.session.userID}).sort({itemID: -1});
    
    res.render('myItems', {myItems: myitems});
});

app.post('/searchmyitems', async (req, res) => {

    var string = req.body.search.trim();
    var itemsSearched = [];
    if (string.startsWith("item-name:")) {
        string = string.substring(10, string.length).trim();
        itemsSearched = await items.find({
            $and: [
                {
                    itemName: new RegExp(string, 'i')
                },{
                    userID: req.session.userID
                }
            ]
        }).sort({itemID: -1});
    }
    else if (string.startsWith("price-max:")) {
        string = string.substring(10, string.length).trim();
        if (isNaN(string)) {
            res.send("Input not a number");
            return;
        }
        string = parseInt(string);
        itemsSearched = await items.find({
            $and: [
                {
                    itemPrice: {$lte: string}
                },{
                    userID: req.session.userID
                }
            ]
        }).sort({itemID: -1});
    }
    else if (string.startsWith("price-min:")) {
        string = string.substring(10, string.length).trim();
        if (isNaN(string)) {
            res.send("Input not a number");
            return;
        }
        string = parseInt(string);
        itemsSearched = await items.find({
            $and: [
                {
                    itemPrice: {$gte: string}
                },{
                    userID: req.session.userID
                }
            ]
        }).sort({itemID: -1});
    }
    else
        itemsSearched = await items.find({
            $and: [
                {
                    $or: [
                        {itemName: new RegExp(string, 'i')},
                        {name: new RegExp(string, 'i')}
                    ]
                },
                {
                    userID: req.session.userID
                }
            ]
        }).sort({itemID: -1});

    var fixedItems = [];
    for (var i = 0; i < itemsSearched.length; i++)
        fixedItems.push({
            itemID: itemsSearched[i].itemID,
            itemName: itemsSearched[i].itemName,
            itemPrice: itemsSearched[i].itemPrice,
            itemDescription: itemsSearched[i].itemDescription,
            itemImage: {
                data: itemsSearched[i].itemImage.data.toString('base64'),
                contentType: itemsSearched[i].itemImage.contentType
            },
            userID: itemsSearched[i].userID,
            name: itemsSearched[i].name,
            phoneNumber: itemsSearched[i].phoneNumber
        });

    if (fixedItems.length == 0)
        res.send("No items were found");
    else
        res.send(fixedItems);
});

app.post('/updateItem', async (req, res) => {
    var updatedItem = req.body;
    await items.updateOne({
        _id: updatedItem._id
    }, {
        $set: {
            itemName: updatedItem.itemName,
            itemDescription: updatedItem.itemDescription
        }
    });

    var myitems = await items.find({userID: req.session.userID}).sort({itemID: -1});

    var fixedItems = [];
    for (var i = 0; i < myitems.length; i++)
        fixedItems.push({
            _id: myitems[i]._id,
            itemID: myitems[i].itemID,
            itemName: myitems[i].itemName,
            itemPrice: myitems[i].itemPrice,
            itemDescription: myitems[i].itemDescription,
            itemImage: {
                data: myitems[i].itemImage.data.toString('base64'),
                contentType: myitems[i].itemImage.contentType
            },
            userID: myitems[i].userID,
            name: myitems[i].name,
            phoneNumber: myitems[i].phoneNumber
        });

    res.send(fixedItems);
});

app.post('/deleteMyItem', async (req, res) => {
    var id = req.body.id;

    await items.findByIdAndDelete(id);

    var myitems = await items.find({userID: req.session.userID}).sort({itemID: -1});

    var fixedItems = [];
    for (var i = 0; i < myitems.length; i++)
        fixedItems.push({
            _id: myitems[i]._id,
            itemID: myitems[i].itemID,
            itemName: myitems[i].itemName,
            itemPrice: myitems[i].itemPrice,
            itemDescription: myitems[i].itemDescription,
            itemImage: {
                data: myitems[i].itemImage.data.toString('base64'),
                contentType: myitems[i].itemImage.contentType
            },
            userID: myitems[i].userID,
            name: myitems[i].name,
            phoneNumber: myitems[i].phoneNumber
        });

    res.send(fixedItems);
});

app.get('/browseitems', async (req, res) => {
    var myitems = await items.find({}).sort({itemID: -1});
    res.render('browseitems', {
        myItems: myitems,
        role: req.session.role
    });
});

app.post('/searchitems', async (req, res) => {

    var string = req.body.search.trim();
    var itemsSearched = [];
    if (string.startsWith("item-name:")) {
        string = string.substring(10, string.length).trim();
        itemsSearched = await items.find({
            itemName: new RegExp(string, 'i')
        }).sort({itemID: -1});
    }
    else if (string.startsWith("owner-name:")) {
        string = string.substring(11, string.length).trim();
        itemsSearched = await items.find({
            name: new RegExp(string, 'i')
        }).sort({itemID: -1});
    }
    else if (string.startsWith("price-max:")) {
        string = string.substring(10, string.length).trim();
        if (isNaN(string)) {
            res.send("Input not a number");
            return;
        }
        string = parseInt(string);
        itemsSearched = await items.find({
            itemPrice: {$lte: string}
        }).sort({itemID: -1});
    }
    else if (string.startsWith("price-min:")) {
        string = string.substring(10, string.length).trim();
        if (isNaN(string)) {
            res.send("Input not a number");
            return;
        }
        string = parseInt(string);
        itemsSearched = await items.find({
            itemPrice: {$gte: string}
        }).sort({itemID: -1});
    }
    else
        itemsSearched = await items.find({
            $or: [
                {itemName: new RegExp(string, 'i')},
                {name: new RegExp(string, 'i')}
            ]
        }).sort({itemID: -1});

    var fixedItems = [];
    for (var i = 0; i < itemsSearched.length; i++)
        fixedItems.push({
            _id: itemsSearched[i]._id,
            itemID: itemsSearched[i].itemID,
            itemName: itemsSearched[i].itemName,
            itemPrice: itemsSearched[i].itemPrice,
            itemDescription: itemsSearched[i].itemDescription,
            itemImage: {
                data: itemsSearched[i].itemImage.data.toString('base64'),
                contentType: itemsSearched[i].itemImage.contentType
            },
            userID: itemsSearched[i].userID,
            name: itemsSearched[i].name,
            phoneNumber: itemsSearched[i].phoneNumber
        });
    

    if (fixedItems.length == 0)
        res.send("No items were found");
    else
        res.send(fixedItems);
});

app.post('/deleteItem', async (req, res) => {
    var id = req.body.id;

    await items.findByIdAndDelete(id);

    var myitems = await items.find({}).sort({itemID: -1});

    var fixedItems = [];
    for (var i = 0; i < myitems.length; i++)
        fixedItems.push({
            _id: myitems[i]._id,
            itemID: myitems[i].itemID,
            itemName: myitems[i].itemName,
            itemPrice: myitems[i].itemPrice,
            itemDescription: myitems[i].itemDescription,
            itemImage: {
                data: myitems[i].itemImage.data.toString('base64'),
                contentType: myitems[i].itemImage.contentType
            },
            userID: myitems[i].userID,
            name: myitems[i].name,
            phoneNumber: myitems[i].phoneNumber
        });

    res.send(fixedItems);
});

app.listen(3000);