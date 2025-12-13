# TicketHive Server

Backend API for **TicketHive**, an Online Ticket Booking Platform built using **Node.js, Express, MongoDB, Firebase Admin SDK, and Stripe**.  
This server handles authentication, role-based access control, ticket management, bookings, payments, and dashboards for **Users, Vendors, and Admins**.

---

## 🚀 Project Purpose

The TicketHive Server powers a full-featured travel ticket booking system where:

- **Users** can book tickets and make secure payments
- **Vendors** can add, manage, and sell tickets
- **Admins** can approve tickets, manage users, and control advertisements

The API is protected using **Firebase Authentication** and supports **Stripe Checkout** for payments.

---

## 🌐 Live Site

[Live Site Link](https://ticket-hive-gilt.vercel.app)

---

## 🔐 Authentication & Security

- Firebase Authentication (ID Token verification)
- Role-based access control (`user`, `vendor`, `admin`)
- Secure credentials using environment variables
- Stripe payment verification
- Protected routes using middleware

---

## 🧠 User Roles

| Role   | Permissions                                               |
| ------ | --------------------------------------------------------- |
| User   | Book tickets, make payments, view bookings & transactions |
| Vendor | Add tickets, manage bookings, view revenue                |
| Admin  | Manage users, approve/reject tickets, advertise tickets   |

---

## 📦 Technologies Used

- **Node.js**
- **Express.js**
- **MongoDB (Atlas)**
- **Firebase Admin SDK**
- **Stripe**
- **dotenv**
- **CORS**

---

## 🗂 Database Collections

- `users`
- `tickets`
- `bookings`
- `transactions`

---

## 📌 API Endpoints Overview

### 🔑 Authentication / User

- `POST /register`
- `GET /profile` (protected)

### 🎟 Tickets

- `POST /add-ticket` (vendor)
- `GET /my-tickets` (vendor)
- `PATCH /my-tickets/:id` (vendor)
- `DELETE /my-tickets/:id` (vendor)
- `GET /all-tickets`
- `GET /recent-tickets`
- `GET /advertise-tickets`
- `PATCH /manage-tickets/:id` (admin)

### 📦 Bookings

- `POST /submit-booking` (user)
- `GET /my-booked-tickets` (user)
- `GET /requested-bookings` (vendor)
- `PATCH /requested-bookings/:id` (vendor)

### 💳 Payments

- `POST /create-checkout-session`
- `PATCH /payment-status`
- `GET /transactions-history`

### 👤 Admin

- `GET /manage-users`
- `PATCH /manage-users/:id`
- `GET /manage-tickets`
- `GET /advertise-tickets-admin`
- `PATCH /advertise-tickets/:id`

### 📊 Vendor Analytics

- `GET /revenue-overview`

---

## 💳 Stripe Payment Flow

1. User clicks **Pay Now**
2. Stripe Checkout session is created
3. User completes payment on Stripe
4. Server verifies payment
5. Booking status updates to `paid`
6. Ticket quantity decreases
7. Transaction saved to database

---

## 🛠 Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
DB_USER=your_mongodb_user
DB_PASS=your_mongodb_password
STRIPE_KEY=your_stripe_secret_key
YOUR_DOMAIN=http://localhost:5173
FIREBASE_SERVICE_KEY=base64_encoded_firebase_service_account
```

⚠️ **Important:**
`FIREBASE_SERVICE_KEY` must be **Base64 encoded** JSON of your Firebase service account.

---

## 🧠 Notes

- Advertised tickets are limited to **6 at a time**
- Fraud vendors have all tickets hidden automatically
- Vendors cannot edit rejected tickets
- Payments are blocked after departure time

---

## 📄 License

This project is developed for educational and assessment purposes.
