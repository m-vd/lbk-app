var mongoose = require('mongoose')

var studentSchema = new mongoose.Schema({
    name    : String,
    nim     : Number,
});

module.exports = mongoose.model("Student", studentSchema);