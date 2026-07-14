const mongoose = require("mongoose");
const Booking = require("../models/booking");
const Home = require("../models/home");

const bookingSchema = new mongoose.Schema({

    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },

    homeId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Home",
        required:true
    },

    paymentId:String,

    amount:Number,

    checkIn:{
        type:Date,
        required:true
    },

    checkOut:{
        type:Date,
        required:true
    },

    paymentMethod:{
        type:String,
        required:true
    },

    paymentStatus:{
        type:String,
        default:"Paid"
    },

    bookedAt:{
        type:Date,
        default:Date.now
    }

});

module.exports = mongoose.model("Booking",bookingSchema);