var mongoose = require('mongoose')

var requestSchema = new mongoose.Schema({
    psychologist: String,
    student: String,
    type: String,
    startTime: Date

});

module.exports = mongoose.model("Request", requestSchema);