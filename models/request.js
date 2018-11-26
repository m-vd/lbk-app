var mongoose = require('mongoose')

var requestSchema = new mongoose.Schema({
    // student : {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref : "Student"
    // },
    psychologist : String,
    student  : String,
    type : String,
    startTime : Date

});

module.exports = mongoose.model("Request", requestSchema);