import dotenv from 'dotenv';
dotenv.config();

import { createPool } from 'mysql2/promise';

const pool = createPool({
    host : 'localhost',
    user : 'root',
    password : process.env.MYSQL_PASSWORD,
    database : process.env.MYSQL_DB,
    waitForConnections : true,
    connectionLimit:10,
    queueLimit : 0
})
export default pool;