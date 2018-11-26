var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    moment = require('moment'),
    request = require('request'),
    cookieParser = require('cookie-parser'),
    parseXML = require('xml2js').parseString,
    stripNS = require('xml2js').processors.stripPrefix,
    mongoose = require('mongoose'),
    LocalStrategy = require('passport-local'),
    passport = require('passport');

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

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(Psychologist.authenticate()));
passport.serializeUser(Psychologist.serializeUser());
passport.deserializeUser(Psychologist.deserializeUser());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/views"));
app.set("view engine", "ejs");

// app.use((req, res, next) => {
//     if (req.cookies.user_sid && !req.session.user) {
//         res.clearCookie('user_sid');
//     }
//     next();
// });

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
    var leastBusy;

    Psychologist.find({}, function(err, allPyschologists){
        if (err) {
            console.log(err); 
        } else {
            //Find available psychologists
            var availablePsychologists = []
            allPyschologists.forEach(function(eachPsychologist){
                eachPsychologist.schedule.forEach(function(eachPsychologistSchedule){
                    if (moment(req.body.request.date).isBetween(eachPsychologistSchedule.start, eachPsychologistSchedule.end)){
                        eachPsychologist.available = false
                    }
                console.log(eachPsychologist.available);
                })
                if (eachPsychologist.available) {
                    availablePsychologists.push(eachPsychologist);
                }
            })
            //Find least busy psychologists out of available psychologists
            var leastLength = 10000000;
            availablePsychologists.forEach(function (eachAvailablePsychologist){
                console.log(eachAvailablePsychologist);
                if (eachAvailablePsychologist.schedule.length < leastLength) {
                    leastLength = eachAvailablePsychologist.schedule.length;
                    leastBusy = eachAvailablePsychologist;
                }
            });
        }
    });
    //Create new request
    var newRequest = req.body.request;
    newRequest.psychologist = leastBusy.name;
    Request.create(newRequest, function (err, request) {
        if (err) {
            console.log(err);
        } else {
            console.log(request);
        }
    });
    res.redirect("/services");
});


//FUCK THESE CODES!
app.get("/requests", function (req, res) {
    Request.find({}, function (err, allRequests) {
        if (err) {
            console.log(err);
        } else {
            res.render("requests", { requests: allRequests, user: req.session.user });
        }
    });
});

app.post("/requests/:id", function (req, res) {
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

app.get("/sessions", function (req, res) {
    Session.find({}).populate('psychologist').populate('student').exec(function (err, allSessions) {
        if (err) {
            console.log(err);
        }
        res.render("sessions", { sessions: allSessions });
    });
})

app.post("/sessions/:id", function (req, res) {
    Session.findById(req.params.id, function (err, session) {
        if (err) {
            console.log(err);
        } else {
            if (req.body.remark.toLowerCase() == "selesai") {
                console.log("log    : sesi selesai");
            } else {
                session.remarks.push(req.body.remark);
                session.save();
                res.redirect("/");
            }
        }
    });
});






//LOGIN AND AUTH FOR PSYCHOLOGISTS
app.get("/registerps", function (req, res) {
    res.render("registerps");
});

app.post("/registerps", function (req, res) {
    Psychologist.register(new Psychologist({ username: req.body.a.name, name: req.body.a.name, id: req.body.a.id }), req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            return res.render("register");
        }
        passport.authenticate("local")(req, res, function () {
            res.redirect("catalog");
        });
    });
});

app.get("/loginps", function (req, res) {
    if (req.isAuthenticated()) {
        res.send("already login");
    } else {
        res.render("loginps");
    }
});

app.post("/loginps", passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/",
}), function (req, res) {
});

app.get("/scheduleps", isPsyLoggedIn, function (req, res) {
    res.render("scheduleps");
});

app.post("/scheduleps", isPsyLoggedIn, function (req, res) {
    Psychologist.findOne({ username: req.user.username }, function (err, psy) {
        if (err) {
            console.log(err);
        } else {
            if (!Array.isArray(psy.schedule) || !psy.schedule.length) {
                var newS = [{
                    start: req.body.startTime,
                    end: req.body.endTime
                }]
                psy.schedule = newS;
            } else {
                var newS = {
                    start: req.body.startTime,
                    end: req.body.endTime
                }
                psy.schedule.push(newS);
            }
            console.log(psy);
            psy.markModified('schedule')
            psy.save();
        }
        res.redirect("/");
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

function isPsyLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect("/loginps");
}

app.listen(process.env.PORT || 3120, function (req, res) {
    console.log("App is running");
    console.log("Database running: ", (process.env.database_uri || "mongodb://localhost/lbk"))
})