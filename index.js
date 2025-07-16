import dotenv from 'dotenv'
dotenv.config();
import express from 'express';
import db from './config/db.js';
import IdentityRoutes from './routes/identity.routes.js';

const app = express();
app.use(express.json())
app.use('/identity',IdentityRoutes)

const PORT = process.env.PORT

app.listen(PORT,()=>{
    console.log(`Server running on ${PORT}`);
})