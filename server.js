require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const nodemailer = require("nodemailer");
const app = express();
app.use(cors({
  origin: ["http://127.0.0.1:5500", "http://localhost:5500"]
}));

app.use(express.json());

const { CONSUMER_KEY, CONSUMER_SECRET, SHORTCODE, PASSKEY, CALLBACK_URL, EMAIL_USER, EMAIL_PASS } = process.env;

let orders = [];

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

function sendConfirmation(email, amount){
  transporter.sendMail({
    from: "kips & shiks’",
    to: email,
    subject: "Order Confirmed",
    text: `We received your payment of KES ${amount}. Thank you for shopping with us.`
  });
}

async function getToken(){
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");
  const res = await axios.get("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", { headers:{ Authorization: `Basic ${auth}` } });
  return res.data.access_token;
}

app.post("/pay", async (req,res)=>{
  const { phone, amount } = req.body;
  const token = await getToken();
  const timestamp = new Date().toISOString().replace(/[^0-9]/g,"").slice(0,14);
  const password = Buffer.from(SHORTCODE + PASSKEY + timestamp).toString("base64");

  const response = await axios.post(
    "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
    {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: CALLBACK_URL,
      AccountReference: "kips&shiks",
      TransactionDesc: "Tote Bag Purchase"
    },
    { headers:{ Authorization: `Bearer ${token}` } }
  );

  res.json(response.data);
});

app.post("/callback", (req,res)=>{
  console.log("Payment Response:", req.body);
  const data = req.body.Body.stkCallback;
  if(data.ResultCode === 0){
    const metadata = data.CallbackMetadata.Item;
    const amount = metadata.find(i=>i.Name==="Amount").Value;
    const phone = metadata.find(i=>i.Name==="PhoneNumber").Value;
    orders.push({phone, amount});
  }
  res.sendStatus(200);
});

app.get("/orders", (req,res)=>{
  res.json(orders);
});

app.listen(3000,()=>console.log("M-Pesa backend running on port 3000"));
