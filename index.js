const express = require("express");
const app = express();
const admin = require("firebase-admin");
const cors = require("cors");
require("dotenv").config();
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_KEY);
const port = process.env.PORT || 3000;
const YOUR_DOMAIN = process.env.YOUR_DOMAIN || "http://localhost:5173";

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
    const db = client.db("tickethive_db");
    const usersCollection = db.collection("users");
    const ticketsCollection = db.collection("tickets");
    const bookingsCollection = db.collection("bookings");
    const transactionsCollection = db.collection("transactions");

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
          advertiseStatus: "hide",
          hideForFraud: false,
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

    app.get("/my-booked-tickets", verifyFirebase, async (req, res) => {
      try {
        const tickets = await bookingsCollection
          .find({ email: req.user.email })
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

    app.get("/advertise-tickets", async (req, res) => {
      try {
        const tickets = await ticketsCollection
          .find({ advertiseStatus: "show", hideForFraud: false })
          .sort({ createdAt: -1 })
          .toArray();
        return res.status(200).send(tickets);
      } catch (error) {
        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.get("/advertise-tickets-admin", verifyFirebase, async (req, res) => {
      const { email } = req.user;

      const userData = await usersCollection.findOne({ email });

      if (userData.role !== "admin") {
        return res.status(403).send({
          success: false,
          message: "Only admins are allowed to view advertise tickets.",
        });
      }

      try {
        const tickets = await ticketsCollection
          .find({ verificationStatus: "approved", hideForFraud: false })
          .sort({ createdAt: -1 })
          .toArray();
        return res.status(200).send(tickets);
      } catch (error) {
        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.get("/recent-tickets", async (req, res) => {
      try {
        const tickets = await ticketsCollection
          .find({ verificationStatus: "approved", hideForFraud: false })
          .sort({ createdAt: -1 })
          .limit(8)
          .toArray();
        return res.status(200).send(tickets);
      } catch (error) {
        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.get("/all-tickets", async (req, res) => {
      const { total = 0, page = 1 } = req.query;
      const perPage = 6;

      try {
        if (Number(total) === 1) {
          const tickets = await ticketsCollection
            .find({ verificationStatus: "approved", hideForFraud: false })
            .toArray();
          return res
            .status(200)
            .send({ totalPage: Math.ceil(tickets.length / perPage) });
        }

        const tickets = await ticketsCollection
          .find({ verificationStatus: "approved", hideForFraud: false })
          .sort({ createdAt: -1 })
          .limit(perPage)
          .skip(Number(page - 1) * perPage)
          .toArray();
        return res.status(200).send(tickets);
      } catch (error) {
        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.get("/revenue-overview", verifyFirebase, async (req, res) => {
      const { email } = req.user;

      const userData = await usersCollection.findOne({ email });

      if (userData.role !== "vendor") {
        return res.status(403).send({
          success: false,
          message: "Only vendor are allowed to view revenue overview",
        });
      }

      try {
        const paidBookings = await bookingsCollection
          .aggregate([
            {
              $match: {
                status: "paid",
                vendorEmail: email,
              },
            },
            {
              $group: {
                _id: null,
                total_tickets_sold: { $sum: "$quantity" },
                total_revenue: {
                  $sum: {
                    $multiply: ["$pricePerUnit", "$quantity"],
                  },
                },
              },
            },
          ])
          .toArray();

        const allTickets = await ticketsCollection
          .aggregate([
            {
              $match: {
                verificationStatus: "approved",
                email,
              },
            },
            {
              $group: {
                _id: null,
                total_add: { $sum: 1 },
              },
            },
          ])
          .toArray();

        const { total_tickets_sold = 0, total_revenue = 0 } =
          paidBookings[0] || {};
        console.log(allTickets);

        return res.status(200).send([
          { name: "Total Revenue", value: total_revenue },
          { name: "Total Tickets Sold", value: total_tickets_sold },
          {
            name: "Total Tickets Added",
            value: allTickets?.[0]?.total_add || 0,
          },
        ]);
      } catch (error) {
        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.get("/transactions-history", verifyFirebase, async (req, res) => {
      const { email } = req.user;

      const userData = await usersCollection.findOne({ email });

      if (userData.role !== "user") {
        return res.status(403).send({
          success: false,
          message: "Only users are allowed to view transactions",
        });
      }

      try {
        const payments = await transactionsCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        return res.status(200).send(payments);
      } catch (error) {
        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.patch("/advertise-tickets/:id", verifyFirebase, async (req, res) => {
      try {
        const { email } = req.user;
        const { action } = req.body;

        const userData = await usersCollection.findOne({ email });

        if (userData.role !== "admin") {
          return res.status(403).send({
            success: false,
            message: "Only admins are allowed to edit any tickets.",
          });
        }

        if (action === "show") {
          const result = await ticketsCollection
            .aggregate([
              { $match: { advertiseStatus: "show" } },
              { $count: "showCount" },
            ])
            .toArray();
          const showCount = result[0]?.showCount || 0;

          if (showCount >= 6) {
            return res.status(200).json({
              success: false,
              message: "You can't show more than 1 ticket at a time.",
            });
          }
        }

        const { id } = req.params;
        const data = { advertiseStatus: action };
        const user = await ticketsCollection.updateOne(
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

        return res.status(200).send({
          success: true,
          message: "Ticket advertise status updated successfully.",
        });
      } catch (error) {
        console.log(error);

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

        if (action === "fraud") {
          const user = await usersCollection.findOne({ _id: new ObjectId(id) });
          await ticketsCollection.updateOne(
            { email: user.email },
            { $set: { hideForFraud: true } }
          );
        } else {
          const user = await usersCollection.findOne({ _id: new ObjectId(id) });
          await ticketsCollection.updateOne(
            { email: user.email },
            { $set: { hideForFraud: false } }
          );
        }

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
        const { id } = req.params;

        const ticket = await ticketsCollection.findOne({
          _id: new ObjectId(id),
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

    app.patch("/requested-bookings/:id", verifyFirebase, async (req, res) => {
      try {
        const { email } = req.user;

        const userData = await usersCollection.findOne({ email });

        if (userData.role !== "vendor") {
          return res.status(403).send({
            success: false,
            message: "Only vendor are allowed to edit any tickets.",
          });
        }

        const { id } = req.params;
        const { action } = req.body;
        const data = { status: action };
        const user = await bookingsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: data }
        );

        if (user.matchedCount === 0) {
          return res
            .status(404)
            .send({ success: false, message: "Booking not found." });
        }

        if (user.modifiedCount === 0) {
          return res
            .status(200)
            .send({ success: true, message: "No changes were made." });
        }

        return res.status(200).send({
          success: true,
          message: "Booking status updated successfully.",
        });
      } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.get("/requested-bookings", verifyFirebase, async (req, res) => {
      const { email } = req.user;
      const userData = await usersCollection.findOne({ email });

      if (userData.role !== "vendor") {
        return res.status(403).send({
          success: false,
          message: "Only vendors are allowed to delete tickets.",
        });
      }

      try {
        const bookings = await bookingsCollection
          .find({ vendorEmail: email })
          .sort({ createdAt: -1 })
          .toArray();
        return res.status(200).send(bookings);
      } catch (error) {
        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.post("/submit-booking", verifyFirebase, async (req, res) => {
      try {
        const { email } = req.user;
        const { ticketId, quantity } = req.body;

        const ticket = await ticketsCollection.findOne({
          _id: new ObjectId(ticketId),
        });

        await bookingsCollection.insertOne({
          imageUrl: ticket.imageUrl,
          title: ticket.title,
          from: ticket.from,
          to: ticket.to,
          transportType: ticket.transportType,
          pricePerUnit: ticket.pricePerUnit,
          departure: ticket.departure,
          email,
          vendorEmail: ticket.email,
          ticketId,
          quantity,
          status: "pending",
          createdAt: new Date(),
        });

        res.status(201).send({
          success: true,
          message: "Booking successful!",
        });
      } catch (error) {
        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.post("/create-checkout-session", verifyFirebase, async (req, res) => {
      const { ticketId, bookingId } = req.body;

      const ticketData = await ticketsCollection.findOne({
        _id: new ObjectId(ticketId),
      });

      const bookingData = await bookingsCollection.findOne({
        _id: new ObjectId(bookingId),
      });

      const amount =
        parseInt(ticketData.pricePerUnit) *
        parseInt(bookingData.quantity) *
        100;

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "USD",
              product_data: {
                name: ticketData.title || "Ticket Payment",
              },
              unit_amount: Math.round(Number(amount)),
            },
            quantity: 1,
          },
        ],
        metadata: {
          ticketId: String(ticketData._id),
          bookingId: String(bookingData._id),
          quantity: bookingData.quantity,
          title: ticketData.title,
        },
        mode: "payment",
        customer_email: bookingData.email,
        success_url: `${YOUR_DOMAIN}/dashboard/payment/${bookingData._id}?type=success&sessionId={CHECKOUT_SESSION_ID}`,
        cancel_url: `${YOUR_DOMAIN}/dashboard/payment/${bookingData._id}?type=cancel`,
      });

      res.send({ url: session.url });
    });

    app.patch("/payment-status", verifyFirebase, async (req, res) => {
      try {
        const { sessionId } = req.query;

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        console.log(session);
        const isSuccess = session.payment_status === "paid";

        if (isSuccess) {
          const update = { $set: { status: "paid" } };
          const result = await bookingsCollection.updateOne(
            { _id: new ObjectId(session.metadata.bookingId) },
            update
          );

          if (result.modifiedCount) {
            await ticketsCollection.updateOne(
              { _id: new ObjectId(session.metadata.ticketId) },
              { $inc: { quantity: -parseInt(session.metadata.quantity) } }
            );
            await transactionsCollection.insertOne({
              ...session.metadata,
              createdAt: new Date(),
              id: session.id,
              amount_total: Number(session.amount_total / 100),
            });
            return res.send({
              success: true,
              message: "Payment successful",
            });
          } else {
            return res.send({
              success: false,
              message: "Payment already verified",
            });
          }
        }

        const filter = { sessionId: session.id };
        const update = { $set: { paymentStatus: "failed" } };

        const result = await paymentCollection.updateOne(filter, update);

        return res.send({
          success: false,
          message: "Payment not completed",
        });
      } catch (error) {
        console.error("Payment check error:", error);
        return res.status(500).send({
          message: "Internal server error",
          error: error.message,
        });
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
