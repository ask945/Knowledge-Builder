const admin = require('../config/firebase');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];

    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Find or create user in MongoDB
    let user = await User.findOne({ uid: decodedToken.uid });
    
    if (!user) {
      user = await User.create({
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email,
        picture: decodedToken.picture,
      });
    } else {
      // Update user info if changed
      user.email = decodedToken.email;
      user.name = decodedToken.name || decodedToken.email;
      user.picture = decodedToken.picture;
      await user.save();
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

module.exports = auth;

