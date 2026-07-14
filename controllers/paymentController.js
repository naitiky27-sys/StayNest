const Home = require("../models/home");
const User = require("../models/user");
const Booking = require("../models/booking");

// Two date ranges [checkIn, checkOut) overlap if one starts before the
// other ends, on both sides. We look for any *existing* booking on this
// home whose range overlaps the range the guest is trying to book.
async function findConflictingBooking(homeId, checkInDate, checkOutDate) {
  return Booking.findOne({
    homeId,
    checkIn: { $lt: checkOutDate },
    checkOut: { $gt: checkInDate },
  });
}

// Checks that the fields required for the chosen payment method were
// actually filled in. Returns an error message string, or null if valid.
function validatePaymentDetails(paymentMethod, fields) {
  const { cardNumber, cardHolder, expiry, cvv, upiId, bank, wallet } = fields;

  if (!paymentMethod) {
    return "Please select a payment method.";
  }

  switch (paymentMethod) {
    case "card": {
      if (!cardNumber || !cardNumber.trim()) return "Card number is required.";
      if (!/^\d{13,19}$/.test(cardNumber.replace(/\s+/g, ""))) return "Enter a valid card number.";
      if (!cardHolder || !cardHolder.trim()) return "Cardholder name is required.";
      if (!expiry || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry.trim())) return "Enter a valid expiry (MM/YY).";
      if (!cvv || !/^\d{3,4}$/.test(cvv.trim())) return "Enter a valid CVV.";
      return null;
    }
    case "upi": {
      if (!upiId || !/^[\w.\-]+@[\w.\-]+$/.test(upiId.trim())) return "Enter a valid UPI ID.";
      return null;
    }
    case "netbanking": {
      if (!bank || !bank.trim() || bank.trim() === "Select Bank") return "Please select a bank.";
      return null;
    }
    case "wallet": {
      if (!wallet || !wallet.trim()) return "Please select a wallet.";
      return null;
    }
    default:
      return "Invalid payment method.";
  }
}

exports.getCheckout = async (req, res) => {
  const home = await Home.findById(req.params.homeId);

  if (!home) {
    return res.redirect("/");
  }

  const { checkIn, checkOut } = req.query;

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  const nights = Math.ceil(
    (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24),
  );

  if (nights <= 0) {
    return res.redirect("/homes/" + home._id);
  }

  const conflict = await findConflictingBooking(home._id, checkInDate, checkOutDate);
  if (conflict) {
    return res.redirect("/homes/" + home._id + "?bookingError=1");
  }

  const cleaningFee = 499;
  const serviceFee = 299;

  const roomPrice = home.price * nights;
  const totalPrice = roomPrice + cleaningFee + serviceFee;

  res.render("payment/checkout", {
    pageTitle: "Checkout",
    home,
    checkIn,
    checkOut,
    nights,
    roomPrice,
    cleaningFee,
    serviceFee,
    totalPrice,
  });
};

exports.getPaymentPage = async (req, res) => {
  const home = await Home.findById(req.params.homeId);

  if (!home) {
    return res.redirect("/");
  }

  const { checkIn, checkOut } = req.query;
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  const nights = Math.ceil(
    (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24),
  );

  if (nights <= 0) {
    return res.redirect("/checkout/" + home._id);
  }

  const conflict = await findConflictingBooking(home._id, checkInDate, checkOutDate);
  if (conflict) {
    return res.redirect("/homes/" + home._id + "?bookingError=1");
  }

  const cleaningFee = 499;
  const serviceFee = 299;

  const roomPrice = home.price * nights;

  const totalPrice = roomPrice + cleaningFee + serviceFee;

  res.render("payment/payment", {
    pageTitle: "Payment",
    home,
    checkIn,
    checkOut,
    nights,
    roomPrice,
    cleaningFee,
    serviceFee,
    totalPrice,
    paymentError: req.query.paymentError || null,
  });
};

exports.postFakePayment = async (req, res) => {

  const { paymentMethod, checkIn, checkOut, cardNumber, cardHolder, expiry, cvv, upiId, bank, wallet } = req.body;

  const home = await Home.findById(req.params.homeId);

  if (!home) {
    return res.redirect("/");
  }

  // Validate that the required fields for the chosen payment method were
  // actually filled in. Without this, the booking would be marked "Paid"
  // even if the guest submitted a blank form.
  const validationError = validatePaymentDetails(paymentMethod, {
    cardNumber, cardHolder, expiry, cvv, upiId, bank, wallet,
  });

  if (validationError) {
    return res.redirect(
      "/pay/" + home._id +
      "?checkIn=" + encodeURIComponent(checkIn) +
      "&checkOut=" + encodeURIComponent(checkOut) +
      "&paymentError=" + encodeURIComponent(validationError)
    );
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  const nights = Math.ceil(
    (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24),
  );

  const cleaningFee = 499;
  const serviceFee = 299;

  const roomPrice = home.price * nights;

  const totalPrice = roomPrice + cleaningFee + serviceFee;

  const alreadyBooked = await Booking.findOne({
    userId: req.session.user._id,
    homeId: home._id,
  });

  if (alreadyBooked) {
    return res.redirect("/bookings");
  }

  // Final check, right before we save. Someone else could have booked
  // these exact dates while this guest was filling in card details, so
  // we re-verify here instead of trusting the check done back at checkout.
  const conflict = await findConflictingBooking(home._id, checkInDate, checkOutDate);
  if (conflict) {
    return res.redirect("/homes/" + home._id + "?bookingError=1");
  }

  const paymentId = "PAY-" + Date.now() + Math.floor(Math.random() * 1000);

  const booking = new Booking({
    userId: req.session.user._id,
    homeId: home._id,
    paymentId,
    amount: totalPrice,
    paymentMethod,
    checkIn,
    checkOut,
    paymentStatus: "Paid",
  });

  await booking.save();

  setTimeout(() => {
    res.redirect("/success?paymentId=" + paymentId + "&amount=" + totalPrice);
  }, 2500);
};

exports.getSuccess = (req, res) => {
  res.render("payment/success", {
    pageTitle: "Payment Success",
    paymentId: req.query.paymentId,
    amount: req.query.amount,
  });
};