const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const path = require("path");
require("dotenv").config();
const multer = require("./multer-config"); // Import Multer configuration
const User = require("./DB/User"); // User model
const Product = require("./DB/Product"); // Product model
const nodemailer = require('nodemailer');
const crypto = require('crypto');


const app = express();

// Middleware
app.use(express.json());
const cors = require("cors");

const allowedOrigins = [
  "https://publicwebsite-pied.vercel.app",
  "https://adminpanel-ashen.vercel.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // Enable if using cookies or authentication
    methods: ["GET", "POST", "PUT", "DELETE"], // Allow these methods
    allowedHeaders: ["Content-Type", "Authorization"], // Customize if needed
  })
);

app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve static files from "uploads"

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Database connected"))
  .catch((err) => console.error("Database connection error:", err));

// Register API
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).send({ error: "All fields are required." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).send({ error: "Email is already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    const result = await user.save();

    res.status(201).send({
      message: "User registered successfully",
      user: { id: result._id, name: result.name, email: result.email },
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).send({ error });
  }
});

// Login API
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send({ result: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send({ result: "No user found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).send({ result: "Invalid credentials" });
    }

    res.status(200).send({ id: user._id, name: user.name, email: user.email });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).send({ error: "Server error" });
  }
});

// Add Product API
// Add Product API (Handle Multiple Images)
app.post("/add", multer.array("images", 10), async (req, res) => {  // multer.array allows multiple files, up to 10 in this case
  const { company, model, color, variant  , distanceCovered, modelYear, price  , registrationYear, fuelType , transmissionType ,bodyType } = req.body;
  const images = req.files ? req.files.map(file => `/uploads/${file.filename}`) : []; // Map each uploaded file to its path

  if (!company || !model || !color || !registrationYear || !fuelType || !transmissionType || !variant || !distanceCovered || !modelYear || !bodyType || !price || images.length === 0) {
    return res.status(400).send({ error: "All fields and at least one image are required." });
  }

  // Convert numeric fields to numbers
  const product = new Product({
    company,
    model,
    color,
    registrationYear,
    fuelType,
    transmissionType,
    variant,
    distanceCovered: Number(distanceCovered),
    modelYear: Number(modelYear),
    price: Number(price),
    bodyType,
    images,  // Storing the array of image paths
  });

  try {
    const result = await product.save();
    res.status(201).send(result);
  } catch (error) {
    console.error("Error saving product:", error);
    res.status(400).send({ error: error.message });
  }
});



app.get("/", (req, res) => {
  res.send("Welcome to the Product API!");
});


// Get Products API
app.get("/product", async (req, res) => {
  try {
    const products = await Product.find();
    if (products.length > 0) {
      res.send(products);
    } else {
      res.send({ result: "No products found" });
    }
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send({ error: error.message });
  }
});

// Product DELETE

app.delete('/product/:id',async(req,res)=>{
  const result =  await Product.deleteOne({_id:req.params.id})
  res.send(result);

});


//Auto fill form

app.get("/product/:id",async (req,res)=>{
  let result = await Product.findOne({_id:req.params.id});
  if(result){
    res.send(result)
  }else {
    res.send({result:"No Record Found."})
  }
})


// update Product


app.put("/product/:id" ,async (req,res) => {
  let result = await Product.updateOne(
    {_id: req.params.id},
    {
      $set : req.body 
    }
  )
  res.send(result)
})


// Search Product

// app.get("/search/:key",async(req,res)=>{
//   let result = await Product.find({
//     "$or":[
//       {name:{ $regex: req.params.key}},
//       {category:{ $regex: req.params.key}},
//       {company:{ $regex: req.params.key}}
//     ]
//   });
//   res.send(result)
// })

app.get("/search/:key", async (req, res) => {
  try {
      if (!req.params.key) {
          return res.status(400).send({ message: "Search key is required" });
      }

      let result = await Product.find({
          "$or": [
              { name: { $regex: req.params.key, $options: "i" } },
              { category: { $regex: req.params.key, $options: "i" } },
              { company: { $regex: req.params.key, $options: "i" } }
          ]
      });

      if (result.length > 0) {
          res.send(result); // Return matching products
      } else {
          res.status(404).send({ message: "No matching products found" });
      }
  } catch (error) {
      console.error("Error in search route:", error);
      res.status(500).send({ message: "Server error" });
  }
});

// Search by product name

app.get("/productlist", async (req, res) => {
  try {
    const { company } = req.query; // Get query parameter

    let products;
    if (company) {
      // Case-insensitive search for brand
      products = await Product.find({ company: { $regex: new RegExp(company, "i") } });
    } else {
      products = await Product.find(); // Fetch all products
    }

    // Handle no products found
    if (!products || products.length === 0) {
      return res.status(404).json({ message: "No products found" });
    }

    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}); 


// cartype filter

app.get("/productlist", async (req, res) => {
  try {
    const { bodyType } = req.query;
    console.log("Received bodyType:", bodyType); // Debugging

    let query = {};
    if (bodyType) {
      query.bodyType = bodyType; // ✅ Correct field name
    }

    console.log("Query being executed:", query); // Debugging
    const cars = await Product.find(query).limit(4); // Use Product model

    res.json(cars);
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


//***********************************Forgot password */

app.post('/forgot-password', async (req, res) => {
  try {
      console.log('Request body:', req.body);
      const { email } = req.body;

      if (!email) {
          console.log('Email is required');
          return res.status(400).json({ success: false, message: "Email is required" });
      }

      console.log('Finding user with email:', email);
      const user = await User.findOne({ email });

      if (!user) {
          console.log('Email not found:', email);
          return res.status(400).json({ success: false, message: "Email not found" });
      }

      console.log('Generating token');
      const token = crypto.randomBytes(20).toString('hex');

      console.log('Saving token to database');
      user.resetPasswordToken = token;
      user.resetPasswordExpires = Date.now() + 3600000; // 1 hour from now

      // Save the user and check for errors
      await user.save()
          .then(() => console.log("Token saved successfully:", token))
          .catch(err => console.error("Error saving user:", err));

      console.log('Sending email');
      const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
              user: 'ashish550chaubey@gmail.com',
              pass: 'octi ruyd dqoz nivp' // ⚠️ Never expose credentials in code
          }
      });

      const mailOptions = {
          to: user.email,
          from: 'ashish550chaubey@gmail.com',
          subject: 'Password Reset',
          text: `You requested a password reset.\n\n
          Click the link below to reset your password:\n
          http://localhost:3000/reset-password/${token}\n\n
          If you did not request this, please ignore this email.\n`
      };

      transporter.sendMail(mailOptions, (err) => {
          if (err) {
              console.error('Error sending email:', err);
              return res.status(500).json({ success: false, message: "Error sending email" });
          }
          console.log('Password reset email sent to:', user.email);
          res.status(200).json({ success: true, message: "Password reset link sent to your email." });
      });
  } catch (error) {
      console.error('Error in /forgot-password route:', error);
      res.status(500).json({ success: false, message: "Internal server error" });
  }
});
// Reset Password Route
app.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  console.log('Received Token:', token);
  console.log('Request Body:', req.body);

  if (!password) {
      console.log('❌ Password is missing');
      return res.status(400).json({ success: false, message: "Password is required" });
  }

  console.log('🔍 Searching for user with token:', token);
  const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
  });

  if (!user) {
      console.log('❌ Invalid or expired token:', token);
      return res.status(400).json({ success: false, message: "Invalid or expired token" });
  }

  console.log('🔐 Hashing new password');
  user.password = await bcrypt.hash(password, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  await user.save()
      .then(() => console.log("✅ Password updated successfully"))
      .catch(err => console.error("❌ Error saving new password:", err));

  console.log('✅ Password reset successfully for user:', user.email);
  res.status(200).json({ success: true, message: "Password reset successfully." });
});

// Start the server
const PORT = process.env.PORT || 9000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
