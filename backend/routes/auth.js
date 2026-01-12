const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Verify token endpoint
router.get('/verify', auth, async (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        _id: req.user._id,
        uid: req.user.uid,
        email: req.user.email,
        name: req.user.name,
        picture: req.user.picture,
      },
    },
  });
});

module.exports = router;

