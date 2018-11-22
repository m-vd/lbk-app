var mongoose = require('mongoose')

var psychologistSchema = new mongoose.Schema({
    name    : String,
    nim     : Number,
    schedule: [{
        start   :Date,
        end     :Date
    }]
});

module.exports = mongoose.model("Psychologist", psychologistSchema);