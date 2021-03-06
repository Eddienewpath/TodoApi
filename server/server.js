//library import
let express = require('express');
let bodyparser = require('body-parser'); // bodyparser will send json to the api server
const _ = require('lodash');
const bcrypt = require('bcryptjs');
// local import
require('./config/config'); // load in different db for development and test
let {mongoose} = require('./db/mongoose');
let {Todo} = require('./models/todo');
let {User} = require('./models/user');
const {ObjectID} = require('mongodb');
const {authenticate} = require('./middleware/authenticate');
const port = process.env.PORT;


let app = express();
// bodyparser.json() will return a method which is our middleware. 
app.use(bodyparser.json()); 

// note: function is an object and if function contains a property is a function, that funtion is called method.
app.post('/todos', authenticate, (req, res)=> {
    // console.log(req.body); // body gets stored by bodyparser.
    // create an Todo object and add property to this obj. 
    let todo = new Todo({
        text: req.body.text,
        _creator: req.user._id
    }); 
    // this will send data with database _id to requestor
    todo.save().then((doc) => {
        res.send(doc);
    }, (e) => {
        res.status(400).send(e);
    });
});

app.get('/todos', authenticate,(req, res) => {
    // Todo function object contains a query property find method. 
    // then() method returns a promise 
    Todo.find({_creator: req.user._id}).then((todos) => {
        res.send({todos});
    }, (e) => {
        res.status(400).send(e);
    });
});

// id here is the id of the todo item, creator is the id of associated user
app.get('/todos/:id', authenticate, (req, res) => {
    let id = req.params.id;
    if(!ObjectID.isValid(id)){
        return res.status(404).send();
    }

    Todo.findOne({_id: id, _creator: req.user._id}).then((todo) =>{
        if(!todo){
            return res.status(404).send();
        }
        res.send({todo});   
    }).catch((err)=> {
        res.status(404).send();
    });
});

// .remove({}) this will remove all documents     
// .findByIdAndRemove() will remove and return removed results. 
// app.delete('/todos/:id', authenticate, (req, res) => {
//     let id = req.params.id;
//     if(!ObjectID.isValid(id)){
//        return res.status(404).send();
//     }
//     Todo.findOneAndRemove({_id: id, _creator: req.user._id}).then((todo) => {
//         if(!todo){
//            return res.status(404).send();
//         }
//         res.send({todo});
//     }).catch((err) => {
//         res.status(400).send();
//     });
// });

// async/await
app.delete('/todos/:id', authenticate, async (req, res) => {
    let id = req.params.id;
    if(!ObjectID.isValid(id)){
       return res.status(404).send();
    }
    try{
        const todo = await Todo.findOneAndRemove({_id: id, _creator: req.user._id});
        if(!todo){
            return res.status(404).send();
        }
         res.send({todo});
    }catch(e){
        res.status(400).send();
    }
});

app.patch('/todos/:id', authenticate, (req, res) => {
    let id = req.params.id;
    // limite user request update for given item using pick method
    // only allow subset of things user passed to us
    let body = _.pick(req.body, ['text', 'completed']);

    if(!ObjectID.isValid(id)){
        return res.status(404).send();
    }
// check if todo is completed
    if(_.isBoolean(body.completed) && body.completed){
        body.completedAt = new Date().getTime();
    }else{
        body.completed = false;
        body.completedAt = null;
    }
// {new: true} update with the new version
    Todo.findOneAndUpdate({_id: id, _creator: req.user._id}, {$set: body}, {new: true}).then((todo)=>{
        if(!todo){
            return res.status(404).send();
        }
        res.send({todo});
    }).catch((e)=>{
        res.status(400).send();
    });
});

// as the second argument to refer to the authenticate function
app.get('/users/me', authenticate, (req, res)=>{
    // console.log(res);
    res.send(req.user);

});

//delete user token from user tokens array.  logout 
// app.delete('/users/me/token', authenticate, (req, res) => {
//     req.user.removeToken(req.token).then(() => {
//         res.status(200).send();
//     }, () => {
//         res.status(400).send();
//     });
// });

// original way can be too many nesting or cannot access the previous chain function states at the latter chain. 
//using async/await to replace promise nesting. 
app.delete('/users/me/token', authenticate, async (req, res) => {
    try{
        await req.user.removeToken(req.token); // await can throw err if the err occurs. 
        res.status(200).send();
    }catch(e){
        res.status(400).send();
    }
});

// user sign up method. 
// app.post('/users', (req, res) => {
//     let body = _.pick(req.body, ['email', 'password']);
//     let user = new User(body);

//     user.save().then(() => {
//         return user.generateAuthToken();
//     }).then((token) => {
//         // we need to send token in http header back to user. 
//         // params are key-value pair, key is the custom header name and value is the token.
//         // x-... to create a custom header. 
//         res.header('x-auth', token).send(user);
//     }).catch((e) => {
//         res.status(400).send(e);
//     })
// });

//async/await

app.post('/users', async (req, res) => {
    let body = _.pick(req.body, ['email', 'password']);
    let user = new User(body);
    try{
       await user.save();
       const token = await user.generateAuthToken();
       res.header('x-auth', token).send(user);
    }catch (e) {
        res.status(400).send(e);
    }
});

// login 
// app.post('/users/login', (req, res) => {
//     let body = _.pick(req.body, ['email', 'password']);
//     User.findByCredential(body.email, body.password).then((user) => {
//         return user.generateAuthToken().then((token) => {
//             res.header('x-auth', token).send(user);
//         });
//     }).catch((err) => {
//         res.status(400).send();
//     });
// });

// async/await update 
app.post('/users/login', async (req, res) => {
    let body = _.pick(req.body, ['email', 'password']);
    try{
        const user = await User.findByCredential(body.email, body.password);
        const token = await user.generateAuthToken();
        res.header('x-auth', token).send(user);
    }catch(e){
        res.status(400).send();
    };
});



app.listen(port, () => {
    console.log('server is up on ' + port);
});


module.exports = {app};