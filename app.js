var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    moment = require('moment'),
    mongoose = require('mongoose');

var Psychologist = require('./models/psychologist'),
    Student = require('./models/student');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/views"));
app.set("view engine", "ejs");

//mongoose.connect("mongodb://localhost/lbk");

app.get("/", function (req, res) {
    console.log(req.headers.host);
    console.log(req.originalUrl);
    res.render("index");
});

app.get("/login", function(req, res){
    if (req.query.ticket) {
        var service = "service=" + encodeURIComponent(req.headers.host + req.originalUrl);
        var ticket = "ticket=" + req.query.ticket;
        res.redirect("https://login.itb.ac.id/cas/serviceValidate?" + service + "&" + ticket);
    } else {
        var itbloginuri = "https://login.itb.ac.id/cas/"
        res.redirect(encodeURIComponent(itbloginuri + "login?service=" + req.headers.host + req.originalUrl))
    }
});


app.get("/services", function (req, res) {
    Psychologist.find({}, function(err, allPyschologists){
        if (err) {
            console.log(err);
        } else {
            res.render("services", {moment: moment, psychologists: allPyschologists});
        }
    });
});

app.listen(3120, function (req, res) {
    console.log("App is running");
})