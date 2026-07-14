const express = require("express");
const paymentController = require("../controllers/paymentController");
const isAuth = require("../middlewares/isAuth");

const router = express.Router();

router.get("/checkout/:homeId", isAuth, paymentController.getCheckout);

router.get("/pay/:homeId", isAuth, paymentController.getPaymentPage);

router.post("/pay/:homeId", isAuth, paymentController.postFakePayment);

router.get("/success", paymentController.getSuccess);

module.exports = router;