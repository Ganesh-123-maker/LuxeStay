#  LuxeStay ✨ Web Project Installation Guide

This guide will walk you through the installation process for the # LuxeStay ✨ web project. Follow the steps below to set up the project locally on your machine.

## Prerequisites

Before you begin, make sure you have the following installed on your system:

- Node.js (version 18 recommended)
- MongoDB
- Nodemon (installed globally)

## Installation Steps

1. Clone the  LuxeStay ✨ repository from GitHub:

   ```
   git clone https://github.com/Ganesh-123-maker/LuxeStay-Major-Project.git
   ```

2. Set up the database:
   - Create a `.env` file in the root directory of the project.

3. Set up Cloudinary:
   - Go to [Cloudinary](https://cloudinary.com/) and sign up for a free account.
   - Once logged in, obtain your Cloudinary `CLOUD_NAME`, `CLOUD_API_KEY`, and `CLOUD_API_SECRET`.
   - Add these values to the `.env` file:

     ```
     CLOUD_NAME=your_cloud_name
     CLOUD_API_KEY=your_api_key
     CLOUD_API_SECRET=your_api_secret
     ```

4. Set the secret for your Cloudinary storage:
   - Add a `SECRET` key to your `.env` file and set it to a secure value:

     ```
     SECRET=your_cloudinary_secret
     ```

5. Install project dependencies using npm:

   ```
   npm install
   ```

6. Run the application using Nodemon:

   ```
   nodemon app.js
   ```

7. Access the project:
   - Once the server is running, you can access the project at [http://localhost:3000](http://localhost:3000).

That's it! You have successfully installed and set up the LuxeStay web project on your local machine. If you encounter any issues during the installation process, feel free to reach out for assistance. Happy traveling! 🌍✈️
