const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const cors = require("cors");

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// In-memory storage
let users = {}; // userId -> { id, name, socketId }
let userIds = new Set();

// Generate unique 4-digit ID
function generateUserId() {
  let id;
  do {
    id = Math.floor(1000 + Math.random() * 9000).toString();
  } while (userIds.has(id));
  return id;
}

// Default public rooms
const publicRooms = ["1", "2", "3"];

// Login endpoint
app.post("/api/login", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });
  const id = generateUserId();
  users[id] = { id, name, socketId: null, friends: new Set() };
  userIds.add(id);
  res.json({ id, name, publicRooms });
});

// Get user info by ID
app.get("/api/user/:id", (req, res) => {
  const user = users[req.params.id];
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ id: user.id, name: user.name });
});

// Add friend
app.post("/api/user/:id/add-friend", (req, res) => {
  const user = users[req.params.id];
  const friendId = req.body.friendId;
  if (!user) return res.status(404).json({ error: "User not found" });
  if (!users[friendId])
    return res.status(404).json({ error: "Friend ID not found" });
  if (friendId === user.id)
    return res.status(400).json({ error: "Cannot add yourself" });

  user.friends.add(friendId);
  res.json({ message: "Friend added" });
});

// Get friends list
app.get("/api/user/:id/friends", (req, res) => {
  const user = users[req.params.id];
  if (!user) return res.status(404).json({ error: "User not found" });

  const friendList = Array.from(user.friends).map((fid) => {
    const f = users[fid];
    return { id: f.id, name: f.name };
  });
  res.json(friendList);
});

// Socket.IO chat logic

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // When user registers their socket
  socket.on("register", ({ userId }) => {
    if (users[userId]) {
      users[userId].socketId = socket.id;
      socket.userId = userId;
      console.log(`User ${userId} registered with socket ${socket.id}`);
    }
  });

  // Join a room
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.userId} joined room ${roomId}`);
  });

  // Private message: data = { toUserId, message }
  socket.on("private-message", (data) => {
    const fromUserId = socket.userId;
    const toUser = users[data.toUserId];
    if (!toUser || !toUser.socketId) return;
    io.to(toUser.socketId).emit("private-message", {
      fromUserId,
      message: data.message,
    });
  });

  // Public message in room: data = { roomId, message }
  socket.on("public-message", (data) => {
    io.to(data.roomId).emit("public-message", {
      fromUserId: socket.userId,
      message: data.message,
      roomId: data.roomId,
    });
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
    if (socket.userId && users[socket.userId]) {
      users[socket.userId].socketId = null;
    }
  });
});

const PORT = 3000;
http.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
