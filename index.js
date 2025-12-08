const express = require("express");
const app = express();
const admin = require("firebase-admin");
const cors = require("cors");
require("dotenv").config();
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_KEY);
const port = process.env.PORT || 3000;
const DOMAIN = "http://localhost:5173";

const decoded = Buffer.from(
  process.env.FIREBASE_SERVICE_KEY,
  "base64"
).toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(cors());
app.use(express.json());
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@bananacluster.d9hnwzy.mongodb.net/?appName=BananaCluster`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyFirebase = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Missing or invalid authorization header" });
    }

    const idToken = authHeader.split(" ")[1];
    try {
      const user = await admin.auth().verifyIdToken(idToken);
      req.user = user;
    } catch (error) {
      return res.status(401).json({ error: error.message });
    }
    next();
  } catch (error) {
    console.error("Error verifying Firebase token:", error);
    res.status(403).json({ error: "Unauthorized or invalid token" });
  }
};

async function run() {
  try {
    await client.connect();
    const db = client.db("tickethive_db");
    const usersCollection = db.collection("users");
    const ticketsCollection = db.collection("tickets");

    app.post("/register", async (req, res) => {
      try {
        const { name, email } = req.body;

        const existingUser = await usersCollection.findOne({ email });

        if (existingUser) {
          return res.send({
            success: false,
            message: "User already exists",
          });
        }

        const data = {
          name,
          email,
          role: "user",
        };

        await usersCollection.insertOne(data);

        res.status(201).send({
          success: true,
          message: "Registration successful!",
        });
      } catch (error) {
        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.post("/add-ticket", verifyFirebase, async (req, res) => {
      try {
        const { email, displayName } = req.user;
        const userData = await usersCollection.findOne({ email });

        if (userData.role !== "vendor") {
          return res.status(403).send({
            success: false,
            message: "Only vendors are allowed to add tickets.",
          });
        }

        const {
          title,
          from,
          to,
          transportType,
          pricePerUnit,
          quantity,
          departure,
          perks,
          imageUrl,
        } = req.body;

        const data = {
          email,
          displayName,
          title,
          from,
          to,
          transportType,
          pricePerUnit,
          quantity,
          departure,
          perks,
          imageUrl,
          createdAt: new Date(),
          verificationStatus: "pending",
        };

        await ticketsCollection.insertOne(data);

        res.status(201).send({
          success: true,
          message: "Ticket added successfully!",
        });
      } catch (error) {
        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.get("/my-tickets", verifyFirebase, async (req, res) => {
      try {
        const { email } = req.user;
        const userData = await usersCollection.findOne({ email });

        if (userData.role !== "vendor") {
          return res.status(403).send({
            success: false,
            message: "Only vendors are allowed to add tickets.",
          });
        }

        const tickets = await ticketsCollection
          .find({ email: email })
          .sort({ createdAt: -1 })
          .toArray();
        return res.status(200).send(tickets);
      } catch (error) {
        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.get("/manage-tickets", verifyFirebase, async (req, res) => {
      try {
        const { email } = req.user;
        const userData = await usersCollection.findOne({ email });

        if (userData.role !== "admin") {
          return res.status(403).send({
            success: false,
            message: "Only admins are allowed to view all tickets.",
          });
        }

        const tickets = await ticketsCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        return res.status(200).send(tickets);
      } catch (error) {
        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.get("/manage-users", verifyFirebase, async (req, res) => {
      try {
        const { email } = req.user;
        const userData = await usersCollection.findOne({ email });

        if (userData.role !== "admin") {
          return res.status(403).send({
            success: false,
            message: "Only admins are allowed to view users.",
          });
        }

        const users = await usersCollection.find().toArray();
        return res.status(200).send(users);
      } catch (error) {
        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.patch("/manage-users/:id", verifyFirebase, async (req, res) => {
      try {
        const { email } = req.user;

        const userData = await usersCollection.findOne({ email });

        if (userData.role !== "admin") {
          return res.status(403).send({
            success: false,
            message: "Only admins are allowed to edit any tickets.",
          });
        }
        const { id } = req.params;
        const { action } = req.body;
        const data = { role: action };
        const user = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: data }
        );

        if (user.matchedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: "Ticket not found." });
        }

        if (user.modifiedCount === 0) {
          return res
            .status(200)
            .send({ success: true, message: "No changes were made." });
        }

        return res
          .status(200)
          .send({ success: true, message: "User updated successfully." });
      } catch (error) {
        console.log(error);

        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.patch("/manage-tickets/:id", verifyFirebase, async (req, res) => {
      try {
        const { email } = req.user;

        const userData = await usersCollection.findOne({ email });

        if (userData.role !== "admin") {
          return res.status(403).send({
            success: false,
            message: "Only admins are allowed to edit any tickets.",
          });
        }
        const { id } = req.params;
        const { action } = req.body;
        const data = { verificationStatus: action };
        const ticket = await ticketsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: data }
        );

        if (ticket.matchedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: "Ticket not found." });
        }

        if (ticket.modifiedCount === 0) {
          return res
            .status(200)
            .send({ success: true, message: "No changes were made." });
        }

        return res
          .status(200)
          .send({ success: true, message: "Ticket updated successfully." });
      } catch (error) {
        console.log(error);

        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.get("/my-tickets/:id", verifyFirebase, async (req, res) => {
      try {
        const { email } = req.user;
        const { id } = req.params;
        const userData = await usersCollection.findOne({ email });

        if (userData.role !== "vendor") {
          return res.status(403).send({
            success: false,
            message: "Only vendors are allowed to view ticket",
          });
        }

        const ticket = await ticketsCollection.findOne({
          _id: new ObjectId(id),
          email: email,
        });
        return res.status(200).send(ticket);
      } catch (error) {
        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.patch("/my-tickets/:id", verifyFirebase, async (req, res) => {
      try {
        const { email } = req.user;
        const { id } = req.params;
        const data = req.body;
        const userData = await usersCollection.findOne({ email });

        if (userData.role !== "vendor") {
          return res.status(403).send({
            success: false,
            message: "Only vendors are allowed to edit ticket",
          });
        }

        const ticket = await ticketsCollection.updateOne(
          { _id: new ObjectId(id), email: email },
          { $set: data }
        );

        if (ticket.matchedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: "Ticket not found." });
        }

        if (ticket.modifiedCount === 0) {
          return res
            .status(200)
            .send({ success: true, message: "No changes were made." });
        }

        return res
          .status(200)
          .send({ success: true, message: "Ticket updated successfully." });
      } catch (error) {
        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.delete("/my-tickets/:id", verifyFirebase, async (req, res) => {
      try {
        const { email } = req.user;
        const userData = await usersCollection.findOne({ email });
        const { id } = req.params;

        if (userData.role !== "vendor") {
          return res.status(403).send({
            success: false,
            message: "Only vendors are allowed to delete tickets.",
          });
        }

        const result = await ticketsCollection.deleteOne({
          _id: new ObjectId(id),
          email: email,
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({
            success: false,
            message:
              "Ticket not found or you do not have permission to delete it.",
          });
        }

        res.status(200).send({
          success: true,
          message: "Ticket deleted successfully",
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.get("/profile", verifyFirebase, async (req, res) => {
      try {
        const User = await usersCollection.findOne({ email: req.user.email });
        if (User) {
          return res.send(User);
        }
      } catch (error) {
        res.status(500).send({ error: "Internal server error" });
      }
    });

    console.log("Database connected");
  } catch (err) {
    console.error(err);
  }
}

run();

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
