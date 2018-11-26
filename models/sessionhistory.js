var mongoose = require('mongoose')

var sessionHistorySchema = new mongoose.Schema({
    psychologist: String,
    student: String,
    type: String,
    startTime: Date,
    endTime: Date,
    remark: String
});

module.exports = mongoose.model("SessionHistory", sessionHistorySchema);