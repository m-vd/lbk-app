var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    moment = require('moment'),
    request = require('request'),
    cookieParser = require('cookie-parser'),
    parseXML = require('xml2js').parseString,
    mongoose = require('mongoose');

var Psychologist = require('./models/psychologist'),
    Student = require('./models/student'),
    Request = require('./models/request'),
    Session = require('./models/session');

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/views"));
app.set("view engine", "ejs");

//mongoose.connect("mongodb://localhost/lbk");

app.get("/", function (req, res) {
    res.render("index");
});

app.get("/login", function(req, res){
    if (!isEmpty(req.cookies)) {
        res.send("cookie detected");
    } else {
        if (req.query.ticket) {
            console.log(req.headers);
            var service = "service=" + encodeURI("https://" + req.headers.host + "/login");
            var ticket = "ticket=" + req.query.ticket;
            request("https://login.itb.ac.id/cas/serviceValidate?" + service + "&" + ticket, function(err, response, body) {
                a = parseXML(body);
                res.send(a);

            });
        } else {
            res.redirect(encodeURI("https://login.itb.ac.id/cas/" + "login?service=" + "https://"+ req.headers.host + "/login"))
        }
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

app.post("/services", function(req, res) {
    req.body.request.date = moment(req.body.request.date, "hh:mm DD-MM-YYYY").toDate();
    Request.create(req.body.request, function(err, request){
        if (err) {
            console.log(err)
        } else {
            console.log(request);
        }
    });
    res.redirect("/services");
});

function isEmpty(obj) {
    for(var prop in obj) {
        if(obj.hasOwnProperty(prop))
            return false;
    }
    return true;
}

app.listen(process.env.PORT || 3120, function (req, res) {
    console.log("App is running");
})