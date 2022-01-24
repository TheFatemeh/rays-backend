const jwt = require("jsonwebtoken");

module.exports = (req, _, next) => {
    const authHeader = req.get("Authorization");
    
    if (!authHeader) {
        const error = new Error("Not authenticated.");
        error.statusCode = 401;
        throw error;
    }
    token = authHeader;
    let decodedToken;

    try {
        decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
        err.statusCode = 403;
        throw err;
    }
    
    if (!decodedToken) {
        const err = new Error("Not authenticated.");
        err.statusCode = 401;
        throw err;
    }
    
    next();
};
