var mongoose = require('mongoose')

var requestSchema = new mongoose.Schema({
    // student : {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref : "Student"
    // },
    name : String, 
    nim  : String,
    type : String,
    date : Date

});

module.exports = mongoose.model("Request", requestSchema);