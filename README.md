# Flow Email Automator

A visual email sequence builder and automation tool.

## Features

- Visual workflow builder for email sequences
- Drag-and-drop interface
- User authentication
- Email scheduling with delay options
- MongoDB database storage

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local installation or Atlas account)
- npm or yarn

## Environment Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and update the variables:
   ```
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   EMAIL_HOST=your_smtp_host
   EMAIL_PORT=your_smtp_port
   EMAIL_USER=your_email_user
   EMAIL_PASS=your_email_password
   JWT_SECRET=your_jwt_secret_key
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

## How to Run

### Development Mode

To run both the client and server simultaneously:

```bash
npm run dev:all
```

Or run them separately:

```bash
# Start the server
npm run dev:server

# In another terminal, start the client
npm run dev:client
```

### Production Mode

Build the client:

```bash
npm run build
```

Start the server:

```bash
npm start
```

## Troubleshooting

### Server Connection Issues

If you encounter issues with the registration or login functionality:

1. Check if the server is running using the health check endpoint:
   - Access `http://localhost:5000/api/health` in your browser
   
2. Verify MongoDB connection:
   - Check your MongoDB URI in the `.env` file
   - Make sure MongoDB is running
   
3. Check for errors in the server console

### API Endpoints

The server exposes these main endpoints:

- `POST /api/register` - Register a new user
- `POST /api/login` - Log in an existing user
- `POST /api/schedule-email` - Schedule a single email (requires authentication)
- `POST /api/schedule-sequence` - Schedule an email sequence (requires authentication)
- `GET /api/health` - Check server health

## License

MIT

