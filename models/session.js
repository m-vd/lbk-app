var mongoose = require('mongoose')

var sessionSchema = new mongoose.Schema({
    psychologist : {
        type: mongoose.Schema.Types.ObjectId,
        ref : "Psychologist"
    },
    student : {
        type: mongoose.Schema.Types.ObjectId,
        ref : "Student"
    },
    startTime: Date,
    endTime:Date,
    remarks : []

});

module.exports = mongoose.model("Session", sessionSchema);