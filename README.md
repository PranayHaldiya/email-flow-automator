# Email Automator Flow

A visual email sequence builder and automation tool for creating, managing, and scheduling email campaigns with an intuitive drag-and-drop interface.
### 1. Dashboard
![dashboard snap](https://github.com/PranayHaldiya/email-flow-automator/blob/main/public/Screenshot%202025-04-03%20200313.png)

### 2. Diffrent Flow Creation
![dashboard snap](https://github.com/PranayHaldiya/email-flow-automator/blob/main/public/Screenshot%202025-04-03%20200325.png)

### 3. Cold Email Node Config
![cold email snap](https://github.com/PranayHaldiya/email-flow-automator/blob/main/public/Screenshot%202025-04-03%20200358.png)

### 4. Cold Email Template Creation 
![email template snap](https://github.com/PranayHaldiya/email-flow-automator/blob/main/public/Screenshot%202025-04-03%20200410.png)

### 5. Email Schedule Selection
![template snap](https://github.com/PranayHaldiya/email-flow-automator/blob/main/public/Screenshot%202025-04-03%20200334.png)

### 6. Mail Snapshot 
![dashboard snap](https://github.com/PranayHaldiya/email-flow-automator/blob/main/public/Screenshot%202025-04-03%20200436.png)

### 7. MongoDB Database 
![dashboard snap](https://github.com/PranayHaldiya/email-flow-automator/blob/main/public/Screenshot%202025-04-03%20200454.png)

### 8. Login Page
![dashboard snap](https://github.com/PranayHaldiya/email-flow-automator/blob/main/public/Screenshot%202025-04-03%20200513.png)

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for fast development and building
- React Router for client-side routing
- React Flow for the visual workflow builder
- Tailwind CSS for styling
- Shadcn UI components (based on Radix UI)
- React Hook Form with Zod validation
- React Query for data fetching

### Backend
- Node.js with Express
- MongoDB for database storage
- Agenda.js for job scheduling
- JWT for authentication
- Nodemailer for email sending
- bcrypt for password hashing

## Features

- **Visual Email Flow Builder**: Create complex email sequences with a drag-and-drop interface
- **Email Campaign Management**: Design, save, and edit email campaigns
- **Scheduling System**: Schedule emails with customizable delays and conditions
- **User Authentication**: Secure user registration and login system
- **Real-time Preview**: Preview emails as you build them
- **Analytics Dashboard**: Track email performance metrics (opens, clicks, conversions)
- **Template Library**: Save and reuse email templates
- **Responsive Design**: Works across desktop and mobile devices
- **API Integration**: Connect with other services via API endpoints

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local installation or MongoDB Atlas account)
- npm or yarn package manager
- SMTP server access for sending emails

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/flow-email-automator.git
   cd flow-email-automator
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create environment configuration:
   - Copy `.env.example` to `.env`
   - Update the following variables:
   
   ```
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # MongoDB Connection
   MONGODB_URI=your_mongodb_connection_string
   
   # Email Settings
   EMAIL_HOST=your_smtp_host
   EMAIL_PORT=your_smtp_port
   EMAIL_USER=your_email_user
   EMAIL_PASS=your_email_password
   
   # Authentication
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRY=24h
   ```

## Development

### Running in Development Mode

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

### Testing

Run the test suite:

```bash
npm test
```

## Production Deployment

1. Build the client:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

## API Documentation

### Authentication Endpoints

- `POST /api/register` - Register a new user
- `POST /api/login` - Log in an existing user

### Email Endpoints

- `POST /api/schedule-email` - Schedule a single email (requires authentication)
- `POST /api/schedule-sequence` - Schedule an email sequence (requires authentication)
- `GET /api/emails` - Get all emails for current user
- `PUT /api/emails/:id` - Update an email
- `DELETE /api/emails/:id` - Delete an email

### Utility Endpoints

- `GET /api/health` - Check server health

## Troubleshooting

### Server Connection Issues

If you encounter issues with the registration or login functionality:

1. Check if the server is running using the health check endpoint:
   - Access `http://localhost:5000/api/health` in your browser
   
2. Verify MongoDB connection:
   - Check your MongoDB URI in the `.env` file
   - Make sure MongoDB is running
   
3. Check for errors in the server console

### Email Delivery Issues

If emails are not being sent:

1. Verify SMTP settings in your `.env` file
2. Check if your email provider allows application access
3. Look for email sending errors in the server logs

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## License

MIT

