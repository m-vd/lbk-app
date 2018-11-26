var mongoose = require('mongoose'),
    passportLocalMongoose = require('passport-local-mongoose');

var psychologistSchema = new mongoose.Schema({
    name: String,
    id: Number,
    schedule: [{
        start: Date,
        end: Date
    }],
    request: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Request"
    }
});


psychologistSchema.plugin(passportLocalMongoose);
module.exports = mongoose.model("Psychologist", psychologistSchema);