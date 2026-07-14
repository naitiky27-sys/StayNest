// External Module
const express = require("express");
const storeRouter = express.Router();

// Local Module
const storeController = require("../controllers/storeController");

function isAuth(req, res, next) {
    if (req.session.isLoggedIn) {
        return next();
    }
    res.redirect("/login");
  }

storeRouter.get("/", storeController.getIndex);
storeRouter.get("/homes", storeController.getHomes);
storeRouter.get("/bookings",isAuth, storeController.getBookings);
storeRouter.get("/favourites", isAuth , storeController.getFavouriteList);
storeRouter.post("/homes/:homeId/reviews", storeController.postReview);
storeRouter.get("/homes/:homeId", storeController.getHomeDetails);
storeRouter.post("/favourites", isAuth, storeController.postAddToFavourite);
storeRouter.post("/bookings",isAuth, storeController.postAddToBooking);
storeRouter.post("/favourites/delete/:homeId",isAuth, storeController.postRemoveFromFavourite);
storeRouter.post("/bookings/delete/:homeId",isAuth, storeController.postRemoveFromBooking);
storeRouter.get("/profile",isAuth,storeController.getProfile);


module.exports = storeRouter;