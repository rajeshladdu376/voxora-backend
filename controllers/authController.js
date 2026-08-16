const supabase = require("../config/supabase");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

async function loginClient(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "Email and password are required.",
    });
  }

  // Find client by email
  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .single();

  console.log("CLIENT FOUND:", client);

  if (error || !client) {
    return res.status(401).json({
      error: "Invalid email or password.",
    });
  }

  // Compare password
  console.log("Entered Password:", password);
  console.log("Stored Hash:", client.password_hash);

  const passwordMatch = await bcrypt.compare(
    password,
    client.password_hash
  );

  console.log("Password Match:", passwordMatch);

  if (!passwordMatch) {
    return res.status(401).json({
      error: "Invalid email or password.",
    });
  }

  // Create JWT token
  const token = jwt.sign(
    {
      id: client.id,
      email: client.email,
      role: "client",
      agent_id: client.agent_id,
      display_name: client.display_name,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );

  res.json({
    message: "Login successful",
    token,
  });
}

module.exports = {
  loginClient,
};