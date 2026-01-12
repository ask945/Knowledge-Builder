const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

dotenv.config();
connectDB();
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const auth = require('./middleware/auth');

app.use('/api/auth', require('./routes/auth'));
app.use('/api/notes', auth, require('./routes/notes'));
app.use('/api/links', auth, require('./routes/links'));
app.use('/api/topics', auth, require('./routes/topics'));
app.use('/api/graph', auth, require('./routes/graph'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
