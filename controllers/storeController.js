const Home = require("../models/home");
const User = require("../models/user");
const Review = require("../models/review");

exports.getIndex = async (req, res, next) => {
  const search = req.query.search || "";
  const price = req.query.price || "";

  let query = {};

  if (search.trim() !== "") {
    query.$or = [
      {
        location: {
          $regex: search,
          $options: "i",
        },
      },

      {
        houseName: {
          $regex: search,
          $options: "i",
        },
      },
    ];
  }

  if (price) {
    query.price = {
      $lte: Number(price),
    };
  }

  const registeredHomes = await Home.find(query);

  res.render("store/index", {
    registeredHomes,
    search,
    price,
    pageTitle: "Airbnb Home",
    currentPage: "index",
    isLoggedIn: req.isLoggedIn,
    user: req.session.user,
    search,
  });
};

exports.getHomes = (req, res, next) => {
  Home.find().then((registeredHomes) => {
    res.render("store/home-list", {
      registeredHomes: registeredHomes,
      pageTitle: "Homes List",
      currentPage: "Home",
      isLoggedIn: req.session.isLoggedIn,
      user: req.session.user,
    });
  });
};

/* Favourites */

exports.getFavouriteList = async (req, res, next) => {
  const userId = req.session.user._id;
  const user = await User.findById(userId).populate("favourites");
  res.render("store/favourite-list", {
    favouriteHomes: user.favourites,
    pageTitle: "My Favourites",
    currentPage: "favourites",
  });
};

exports.postAddToFavourite = async (req, res, next) => {
  const homeId = req.body.homeId;
  const userId = req.session.user._id;
  const user = await User.findById(userId);
  if (!user.favourites.some((fav) => fav && fav.toString() === homeId)) {
    user.favourites.push(homeId);
    await user.save();
  }
  res.redirect("/favourites");
};

exports.postRemoveFromFavourite = async (req, res, next) => {
  const homeId = req.params.homeId;
  const userId = req.session.user._id;
  const user = await User.findById(userId);
  if (user.favourites.includes(homeId)) {
    user.favourites = user.favourites.filter((fav) => fav != homeId);
    await user.save();
  }
  res.redirect("/favourites");
};

/*bookings*/

const Booking = require("../models/booking"); 

// controllers/storeController.js
exports.getBookings = async (req, res, next) => {
  try {
  
    let userBookings = await Booking.find({ userId: req.session.user._id })
                                    .populate({
                                      path: 'homeId',
                                      options: { strictPopulate: false }
                                      
                                    });

    
    userBookings = userBookings.filter(booking => booking.homeId !== null);

    
    res.render('store/bookings', {
      BookedHomes: userBookings,
      pageTitle: 'My Bookings',
      isLoggedIn: true
    });
  } catch (err) {
    console.error("Error in getBookings controller:", err);
    next(err);
  }
};

exports.postAddToBooking = async (req, res) => {
  const homeId = req.body.id;
  const userId = req.session.user._id;

  const alreadyBooked = await Booking.findOne({
    userId,
    homeId,
  });

  if (!alreadyBooked) {
    await Booking.create({
      userId,
      homeId,
      paymentStatus: "Pending",
    });
  }

  res.redirect("/bookings");
};
exports.postRemoveFromBooking = async (req, res, next) => {
  const homeId = req.params.homeId;
  const Booking = require("../models/booking");

  const userId = req.session.user._id;

  await Booking.findOneAndDelete({
    userId: userId,
    homeId: homeId,
  });

  res.redirect("/bookings");
};

/*end*/


const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const geocoder = mbxGeocoding({ accessToken: process.env.MAPBOX_TOKEN });

// Safely serializes a value for direct embedding inside a <script> tag.
// Plain JSON.stringify() is not safe here: if the value (e.g. a host-supplied
// houseName or location) contains a backtick or "</script>", it can break out
// of the surrounding JS and inject arbitrary script that runs for every
// visitor of the page (stored XSS). Escaping "<" neutralizes both cases.
function toScriptJSON(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

exports.getHomeDetails = async (req, res, next) => {
  try {
    const homeId = req.params.homeId;
    const home = await Home.findById(homeId);

    
    if (!home) {
      console.error(`CRITICAL: No home found in database for ID: ${homeId}`);
      return res
        .status(404)
        .send(
          "Home not found. Go back to the homepage and click the listing again.",
        );
    }

    
    if (
      !home.geometry ||
      !home.geometry.coordinates ||
      home.geometry.coordinates[0] === 0
    ) {
      try {
        console.log(
          `Geocoding lookup for home "${home.houseName}" using location: "${home.location}"`,
        );

        const geoData = await geocoder
          .forwardGeocode({
            query: home.location, // Using 'location' to match your schema
            limit: 1,
          })
          .send();

        if (geoData.body.features.length > 0) {
          home.geometry = geoData.body.features[0].geometry;
          console.log(
            "Geocoding succeeded. Coordinates:",
            home.geometry.coordinates,
            "| Matched place name:",
            geoData.body.features[0].place_name,
          );
          // Permanently save it so next time it loads instantly
          await Home.findByIdAndUpdate(homeId, { geometry: home.geometry });
        } else {
          console.warn(
            `Geocoding found NO results for location: "${home.location}". Try a more specific/real place name for this home.`,
          );
        }
      } catch (geoErr) {
        console.error("Failed to dynamically fetch map coordinates:", geoErr);
      }
    }
    // Work out whether this home is in the logged-in user's favourites,
    // and whether we were redirected here from a failed booking attempt.
    let isFavourite = false;
    if (req.session.user) {
      const user = await User.findById(req.session.user._id);
      isFavourite = user.favourites.some(
        (fav) => fav && fav.toString() === homeId,
      );
    }

    // Render page - matching your schema's 'houseName'
    res.render("store/home-detail", {
      home: home,
      pageTitle: home.houseName,
      isFavourite,
      bookingError: req.query.bookingError === "1",
      mapCoordinatesJSON: toScriptJSON(
        home.geometry && home.geometry.coordinates ? home.geometry.coordinates : null
      ),
      homeTitleJSON: toScriptJSON(home.houseName),
      homeAddressJSON: toScriptJSON(home.location),
      mapboxToken: process.env.MAPBOX_TOKEN || "",
    });
  } catch (err) {
    next(err);
  }
};
exports.postReview = async (req, res, next) => {
  try {
    const homeId = req.params.homeId;

    const { rating, comment } = req.body;

    const review = new Review({
      username: req.session.user.firstName,

      rating,

      comment,

      home: homeId,
    });

    await review.save();

    const home = await Home.findById(homeId);

    home.reviews.push(review._id);

    await home.save();

    res.redirect("/homes/" + homeId);
  } catch (err) {
    console.log(err);

    next(err);
  }
};
exports.getProfile = async (req, res) => {
  const user = await User.findById(req.session.user._id);

  res.render("store/profile", {
    pageTitle: "My Profile",
    currentPage: "profile",
    user,
  });
};
