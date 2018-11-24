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
    res.render("index", { account: "" });
});

app.get("/login", function (req, res) {
    if (!isEmpty(req.cookies)) {
        res.send("cookie detected");
    } else {
        if (req.query.ticket) {
            var service = "service=" + encodeURI("https://" + req.headers.host + "/login");
            var ticket = "ticket=" + req.query.ticket;
            request("https://login.itb.ac.id/cas/serviceValidate?" + service + "&" + ticket, function (err, response, body) {
                parseXML(body, { tagNameProcessors: [stripNS] }, function (err, result) {
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

                            Student.create(newStudent, function (err, newStudent) {
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
            res.redirect(encodeURI("https://login.itb.ac.id/cas/" + "login?service=" + "https://" + req.headers.host + "/login"))
        }
    }
});

app.get("/services", isLoggedIn, function (req, res) {
    Psychologist.find({}, function (err, allPyschologists) {
        if (err) {
            console.log(err);
        } else {
            res.render("services", { moment: moment, user: req.session.user, psychologists: allPyschologists });
        }
    });
});

app.post("/services", isLoggedIn, function (req, res) {
    req.body.request.date = moment(req.body.request.date, "HH:mm MM-DD-YYYY").toDate();

    Request.create(req.body.request, function (err, request) {
        if (err) {
            console.log(err)
        } else {
            console.log(request);
        }
    });
    res.redirect("/services");
});

app.get("/requests", isPsychologist, function (req, res) {
    Request.find({}, function (err, allRequests) {
        if (err) {
            console.log(err);
        } else {
            res.render("requests", { requests: allRequests, user: req.session.user });
        }
    });
});

app.post("/requests/:id", isPsychologist, function (req, res) {
    Request.findById(req.params.id, function (err, request) {
        if (err) {
            console.log(err);
        } else {
            if (req.body.accepted) {
                request.status = "accepted";

                Psychologist.find({ name: req.body.psychologist }, function (err, foundP) {
                    if (err) {
                        console.log(err)
                    } else {
                        var newSession = {
                            pscyhologist: foundP._id,
                            student: req.session.user._id,
                            startTime: request.date,
                            endTime: moment(request.date).add(2, "h")
                        }

                        Session.create(newSession, function (session) {
                            console.log("log    : new session created")
                        });
                    }
                })
            } else if (req.body.denied) {
                request.status = "denied";
            } else {
                console.log("log    : Error memproses request")
            }
            request.save();
        }
    });
});

app.get("/sessions", isPsychologist, function (req, res) {
    Session.find({}).populate('psychologist').populate('student').exec(function(allSessions){
        res.render("sessions", {sessions: allSessions});
    });
})

app.post("/sessions/:id", isPsychologist, function(req, res) {
    Session.findById(req.params.id, function(err, session){
        if (req.body.remark.toLowerCase() == "selesai"){
            console.log("log        : sesi selesai");
        } else {
            session.remarks.append(req.body.remark);
        }
    });
});

function isEmpty(obj) {
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop))
            return false;
    }
    return true;
}

function isLoggedIn(req, res, next) {
    if (req.cookies.user_sid && req.session.user) {
        return next();
    }
    res.redirect("/login");
}

function isPsychologist(req, res, next) {
    if (req.cookies.user_sid && req.session.user) {
        if (req.session.user.name == "Ivan"){
            console.log("log    : isPsychologist returning true")
            return next();
        }
    }
    console.log("log    : isPsychologist returning false")
    res.redirect("/");
}

app.listen(process.env.PORT || 3120, function (req, res) {
    console.log("App is running");
})