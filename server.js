import express from 'express';
import { Sequelize, DataTypes } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());

// --- Database Connection ---
// In Docker, the host will be the service name 'db'
const dbUrl = process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/splitbill';

const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  logging: false, // Disable logging for cleaner production output
  retry: {
    match: [/SequelizeConnectionError/],
    max: 5,
  }
});

// --- Models ---
const Bill = sequelize.define('Bill', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  items: {
    type: DataTypes.JSON, // Use JSON for flexibility
    allowNull: false
  },
  users: {
    type: DataTypes.JSON, // Store users participating
    allowNull: true
  },
  tax: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  serviceCharge: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  discount: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  total: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  }
});

// --- Initialization ---
const initDb = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    await sequelize.sync({ alter: true }); // Automatically update schema
    console.log('Database synced.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    // In production, you might want to exit or retry
  }
};

initDb();

// --- API Routes ---

app.get('/health', (req, res) => res.send('OK'));

// Save a new bill
app.post('/api/bills', async (req, res) => {
  try {
    const { items, users, tax, serviceCharge, discount, total } = req.body;
    const bill = await Bill.create({ items, users, tax, serviceCharge, discount, total });
    res.status(201).json(bill);
  } catch (error) {
    console.error('Error saving bill:', error);
    res.status(500).json({ error: 'Failed to save bill' });
  }
});

// Get recent bills
app.get('/api/bills', async (req, res) => {
  try {
    const bills = await Bill.findAll({
      order: [['createdAt', 'DESC']],
      limit: 20
    });
    res.json(bills);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

// --- Serve Static Frontend (Production) ---
// When running in Docker, we copy 'dist' and set NODE_ENV=production
if (process.env.NODE_ENV === 'production' || process.env.SERVE_STATIC) {
  app.use(express.static(path.join(__dirname, 'dist')));

  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
