var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    moment = require('moment'),
    request = require('request'),
    cookieParser = require('cookie-parser'),

    parseXML = require('xml2js').parseString,
    stripNS = require('xml2js').processors.stripPrefix,
    mongoose = require('mongoose');

var Psychologist = require('./models/psychologist'),
    Student = require('./models/student'),
    Request = require('./models/request'),
    Session = require('./models/session');

app.use(cookieParser());
app.use(require("express-session")({
    key: "user_sid",
    secret: "II3120 - IT Services",
	resave: false,
    saveUninitialized: false,
    cookie: {
        expires: 600000
    }
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/views"));
app.set("view engine", "ejs");

app.use((req, res, next) => {
    if (req.cookies.user_sid && !req.session.user) {
        res.clearCookie('user_sid');        
    }
    next();
});

mongoose.connect(process.env.database_uri || "mongodb://localhost/lbk");

app.get("/", function (req, res) {
    res.render("index", {account: ""});
});

app.get("/login", function(req, res){
    if (!isEmpty(req.cookies)) {
        res.send("cookie detected");
    } else {
        if (req.query.ticket) {
            var service = "service=" + encodeURI("https://" + req.headers.host + "/login");
            var ticket = "ticket=" + req.query.ticket;
            request("https://login.itb.ac.id/cas/serviceValidate?" + service + "&" + ticket, function(err, response, body) {
                parseXML(body, {tagNameProcessors: [stripNS]}, function(err, result){
                    if (err) {
                        console.log(err);
                    } else {
                        if (result.serviceResponse.authenticationSuccess && result.serviceResponse.authenticationSuccess.length) {
                            var newStudent = {
                                name: result.serviceResponse.authenticationSuccess[0].attributes[0].cn,
                                nim: result.serviceResponse.authenticationSuccess[0].attributes[0].itbNIM[0],
                                prodi: result.serviceResponse.authenticationSuccess[0].attributes[0].ou[0],
                                email: result.serviceResponse.authenticationSuccess[0].attributes[0].mail[0]
                            }

                            Student.create(newStudent, function (err, newStudent){
                                if (err) {
                                    console.log(err);
                                } else {
                                    console.log("log    : Mahasiswa baru ditambahkan ke dalam database", newStudent.nim);
                                    req.session.user = newStudent;
                                    res.redirect("/");
                                }
                            });
                        } else {
                            res.redirect("/login");
                        }
                    }
                });
            });
        } else {
            res.redirect(encodeURI("https://login.itb.ac.id/cas/" + "login?service=" + "https://"+ req.headers.host + "/login"))
        }
    }
});

app.get("/services", isLoggedIn, function (req, res) {
    Psychologist.find({}, function(err, allPyschologists){
        if (err) {
            console.log(err);
        } else {
            res.render("services", {moment: moment});
            console.log(req.session.user);
            console.log(req.cookies.user_sid);
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

function isLoggedIn(req, res, next) {
	if (req.cookies.user_sid && !req.session.user) {
		return next();
	}
	res.redirect("/login");
}

app.listen(process.env.PORT || 3120, function (req, res) {
    console.log("App is running");
})