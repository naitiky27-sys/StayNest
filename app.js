// Core Module

require('dotenv').config();
const path = require('path');

// External Module
const express = require('express');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const DB_PATH = process.env.DB_PATH;

if (!DB_PATH) {
  console.error("Missing DB_PATH in environment variables. Check your .env file.");
  process.exit(1);
}

//Local Module
const storeRouter = require("./routes/storeRouter")
const hostRouter = require("./routes/hostRouter")
const authRouter = require("./routes/authRouter")
const paymentRouter = require("./routes/paymentRouter")
const rootDir = require("./utils/pathUtil");
const errorsController = require("./controllers/errors");
const { default: mongoose } = require('mongoose');

const app = express();

app.set('view engine', 'ejs');
app.set('views', 'views');

const store = new MongoDBStore({
  uri: DB_PATH,
  collection: 'sessions'
});

app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store
}));
const User = require("./models/user");
app.use(async (req, res, next) => {

    res.locals.isLoggedIn = req.session.isLoggedIn || false;
    res.locals.user = req.session.user || null;
    res.locals.favouriteCount = 0;

    if (req.session.isLoggedIn && req.session.user) {

        const user = await User.findById(req.session.user._id);

        if (user) {
            res.locals.favouriteCount = user.favourites.length;
        }

    }

    next();

});

app.use((req, res, next) => {
  req.isLoggedIn = req.session.isLoggedIn;
  next();
})

app.use(authRouter)
app.use(storeRouter);
app.use(paymentRouter);
app.use("/host", (req, res, next) => {
  if (!req.isLoggedIn) {
    return res.redirect("/login");
  }
  if (req.session.user && req.session.user.userType !== "host") {
    return res.status(403).send("Only hosts can access this page.");
  }
  next();
});
app.use("/host", hostRouter);

app.use(express.static(path.join(rootDir, 'public')))

app.use(errorsController.pageNotFound);

const PORT = process.env.PORT || 3003;

mongoose.connect(DB_PATH).then(() => {
  console.log('Connected to Mongo');
  app.listen(PORT, "0.0.0.0" , () => {
    console.log(`Server running on address http://localhost:${PORT}`);
  });
}).catch(err => {
  console.log('Error while connecting to Mongo: ', err);
});


