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
    Session = require('./models/session'),
    SessionHistory = require('./models/sessionhistory');

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

mongoose.connect(process.env.database_uri || "mongodb://localhost/lbk", { useNewUrlParser: true });

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
                            Student.findOne({ nim: newStudent.nim }, function (err, found) {
                                if (err) {
                                    console.log(err);
                                } else if (!found) {
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
                                    req.session.user = found;
                                    res.redirect("/");
                                }
                            })


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
    console.log(req.body.request);
    var leastBusy;

    Psychologist.find({}, function (err, allPyschologists) {
        if (err) {
            console.log(err);
        } else {
            //Find available psychologists
            var availablePsychologists = []
            allPyschologists.forEach(function (eachPsychologist) {
                eachPsychologist.schedule.forEach(function (eachPsychologistSchedule) {
                    if (moment(req.body.request.date).isBetween(eachPsychologistSchedule.start, eachPsychologistSchedule.end)) {
                        eachPsychologist.available = false
                    }
                })
                if (typeof (eachPsychologist.available) == "undefined") {
                    eachPsychologist.available = true;
                }
                if (eachPsychologist.available) {
                    availablePsychologists.push(eachPsychologist);
                }
            })
            //Find least busy psychologists out of available psychologists
            var leastLength = 10000000;
            availablePsychologists.forEach(function (eachAvailablePsychologist) {
                if (eachAvailablePsychologist.schedule.length < leastLength) {
                    leastLength = eachAvailablePsychologist.schedule.length;
                    leastBusy = eachAvailablePsychologist;
                }
            });
        }

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

        //Add request to the psychologist's schedule. 
        Psychologist.findOne({ username: leastBusy.username }, function (err, found) {
            if (err) {
                console.log(err);
            } else {
                var addSchedule = {
                    start: req.body.request.date,
                    end: moment(req.body.request.date).add(2, "h")
                }
                found.schedule.push(addSchedule);
                found.save();
            }
        });

        res.redirect("/services");
    });
});

app.get("/requests", function (req, res) {
    Request.find({}, function (err, allRequests) {
        if (err) {
            console.log(err);
        } else {
            res.render("requests", { requests: allRequests, moment: moment });
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

app.get("/sessionhistory", function (req, res) {
    SessionHistory.find({}, function (err, allSessionHistory) {
        if (err) {
            console.log(err);
        } else {
            res.render("sessions", { sessions: allSessionHistory });
        }
    });
});

app.post("/sessionhistory", function (req, res) {
    if (req.body.completed == "Completed") {
        Request.findById(req.body.rid, function (err, r) {
            if (err) {
                console.log(err);
            } else {
                var sh = {
                    psychologist: r.psychologist,
                    student: r.student,
                    type: r.type,
                    startTime: r.date,
                    endTime: moment().format(),
                    remark: ""
                }
                Psychologist.findOne({ username: r.pscyhologist }, function (err, found) {
                    if (err) { console.log(err); }
                    else {
                        console.log(found);
                        found.schedule.forEach(function (s, i) {
                            if (s.start == r.startTime) {
                                found.schedule.splice(i, 1);
                            }
                        });
                        SessionHistory.create(sh, function (err, newSH) {
                            if (err) {
                                console.log(err);
                            } else {
                                console.log("log    : new session history is made,", newSH);
                            }
                        });
                        Request.findByIdAndDelete(req.body.rid, function (err, dr) {
                            if (err) {
                                console.log(err);
                            } else {
                                res.redirect('back');
                            }
                        });
                    }
                });
            }
        });
    }
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

    Psychologist.findOne({ username: req.user.username }, function (err, psy) {
        if (err) {
            console.log(err);
        } else {
            res.render("scheduleps", { psychologist: psy })
        }
    })
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