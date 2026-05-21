#!/bin/bash
# Run Prisma migrations then start the server
npx prisma migrate deploy
node src/app.js
