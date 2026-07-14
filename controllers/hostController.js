const Home = require("../models/home");
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const token = process.env.MAPBOX_TOKEN || 'dummy_token_to_prevent_startup_crash';
const geocoder = mbxGeocoding({ accessToken: token });

exports.getAddHome = (req, res, next) => {
  res.render("host/edit-home", {
    pageTitle: "Add Home to airbnb",
    currentPage: "addHome",
    editing: false,
    isLoggedIn: req.isLoggedIn, 
    user: req.session.user,
  });
};

exports.getEditHome = (req, res, next) => {
  const homeId = req.params.homeId;
  const editing = req.query.editing === "true";

  Home.findById(homeId).then((home) => {
    if (!home) {
      console.log("Home not found for editing.");
      return res.redirect("/host/host-home-list");
    }

    console.log(homeId, editing, home);
    res.render("host/edit-home", {
      home: home,
      pageTitle: "Edit your Home",
      currentPage: "host-homes",
      editing: editing,
      isLoggedIn: req.isLoggedIn, 
      user: req.session.user,
    });
  });
};

exports.getHostHomes = (req, res, next) => {
  Home.find().then((registeredHomes) => {
    res.render("host/host-home-list", {
      registeredHomes: registeredHomes,
      pageTitle: "Host Homes List",
      currentPage: "host-homes",
      isLoggedIn: req.isLoggedIn, 
      user: req.session.user,
    });
  });
};

// At the top of your file, import the Mapbox SDK



exports.postAddHome = async (req, res, next) => {
  try {
    console.log("--- DEBUGGING FORM DATA ---");
    console.log(req.body); 

    // Extract values flexibly from either naming convention
    const houseName = req.body.title || req.body.houseName;
    const price = req.body.price;
    const location = req.body.address || req.body.location;
    const rating = req.body.rating;
    const photoUrl = req.body.photoUrl;
    const description = req.body.description;

    // Validation Guard for Mapbox Geocoder
    if (!location || location.trim() === "") {
      return res.status(400).send("Error: Location field cannot be empty.");
    }

    // Contact Mapbox API safely
    const geoData = await geocoder.forwardGeocode({
      query: location, 
      limit: 1
    }).send();

    // Safe fallback configuration
    const geometry = geoData.body.features.length > 0 
      ? geoData.body.features[0].geometry 
      : { type: 'Point', coordinates: [0, 0] };

    // 🔑 THE FIX: Map the parameters precisely to your Mongoose Schema requirements
    const newHome = new Home({
      houseName: houseName, // Mongoose expects 'houseName'
      price: price,
      location: location,   // Mongoose expects 'location'
      rating: rating,
      photoUrl: photoUrl,
      description: description,
      geometry: geometry    // Storing the Mapbox coordinates cleanly
    });

    // Save cleanly to MongoDB
    await newHome.save();
    res.redirect('/host/host-home-list');
    
  } catch (err) {
    console.error("Error inside postAddHome handler:", err);
    next(err);
  }
};

exports.postEditHome = (req, res, next) => {
  const { id, houseName, price, location, rating, photoUrl, description } =
    req.body;
  Home.findById(id).then((home) => {
    home.houseName = houseName;
    home.price = price;
    home.location = location;
    home.rating = rating;
    home.photoUrl = photoUrl;
    home.description = description;
    home.save().then((result) => {
      console.log("Home updated ", result);
    }).catch(err => {
      console.log("Error while updating ", err);
    })
    res.redirect("/host/host-home-list");
  }).catch(err => {
    console.log("Error while finding home ", err);
  });
};

exports.postDeleteHome = (req, res, next) => {
  const homeId = req.params.homeId;
  console.log("Came to delete ", homeId);
  Home.findByIdAndDelete(homeId)
    .then(() => {
      res.redirect("/host/host-home-list");
    })
    .catch((error) => {
      console.log("Error while deleting ", error);
    });
};

