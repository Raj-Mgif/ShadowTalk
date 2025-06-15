const socket = io();

const usernameSpan = document.getElementById("username");
const userIdSpan = document.getElementById("user-id");
const friendsList = document.getElementById("friends");
const friendIdInput = document.getElementById("friend-id-input");
const addFriendBtn = document.getElementById("add-friend-btn");
const messagesDiv = document.getElementById("messages");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const publicRoomInput = document.getElementById("public-room-id");
const joinPublicRoomBtn = document.getElementById("join-public-room-btn");

let currentChat = null; // friendId or public room id
let isPrivateChat = false;

const userId = localStorage.getItem("userId");
const username = localStorage.getItem("username");
if (!userId || !username) {
  alert("Not logged in! Redirecting to login page.");
  window.location.href = "index.html";
}

usernameSpan.textContent = username;
userIdSpan.textContent = userId;

// Register user socket
socket.emit("register", { userId });

// Load friends from server
async function loadFriends() {
  const res = await fetch(`/api/user/${userId}/friends`);
  if (!res.ok) return alert("Failed to load friends");
  const friends = await res.json();
  friendsList.innerHTML = "";
  friends.forEach((friend) => {
    const li = document.createElement("li");
    li.textContent = `${friend.name} (${friend.id})`;
    li.style.cursor = "pointer";
    li.onclick = () => {
      startPrivateChat(friend.id, friend.name);
    };
    friendsList.appendChild(li);
  });
}

// Add friend
addFriendBtn.onclick = async () => {
  const friendId = friendIdInput.value.trim();
  if (friendId.length !== 4) return alert("Enter valid 4-digit friend ID");
  if (friendId === userId) return alert("You can't add yourself");

  const res = await fetch(`/api/user/${userId}/add-friend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ friendId }),
  });

  if (res.ok) {
    alert("Friend added!");
    friendIdInput.value = "";
    loadFriends();
  } else {
    const error = await res.json();
    alert(error.error || "Failed to add friend");
  }
};

// Chat helpers

function addMessage(text, from, isMe = false) {
  const div = document.createElement("div");
  div.className = "message";
  div.innerHTML = `<strong>${from}:</strong> ${text}`;
  if (isMe) div.style.color = "green";
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function clearMessages() {
  messagesDiv.innerHTML = "";
}

// Start private chat
function startPrivateChat(friendId, friendName) {
  currentChat = friendId;
  isPrivateChat = true;
  clearMessages();
  addMessage(`Private chat with ${friendName}`, "System");
}

// Start public chat room
function joinPublicRoom(roomId) {
  currentChat = roomId;
  isPrivateChat = false;
  clearMessages();
  addMessage(`Joined public room ${roomId}`, "System");
  socket.emit("join-room", roomId);
}

// Send message
sendBtn.onclick = () => {
  const message = chatInput.value.trim();
  if (!message) return;
  if (!currentChat) return alert("Select a friend or join a room first");

  if (isPrivateChat) {
    socket.emit("private-message", { toUserId: currentChat, message });
    addMessage(message, "Me", true);
  } else {
    socket.emit("public-message", { roomId: currentChat, message });
    addMessage(message, "Me", true);
  }
  chatInput.value = "";
};

// Receive private messages
socket.on("private-message", (data) => {
  if (currentChat === data.fromUserId && isPrivateChat) {
    addMessage(data.message, "Friend");
  }
});

// Receive public messages
socket.on("public-message", (data) => {
  if (!isPrivateChat && currentChat === data.roomId) {
    addMessage(data.message, `User ${data.fromUserId}`);
  }
});

// Join public room button
joinPublicRoomBtn.onclick = () => {
  const roomId = publicRoomInput.value.trim();
  if (!["1", "2", "3"].includes(roomId)) {
    return alert("Enter a valid public room ID: 1, 2, or 3");
  }
  joinPublicRoom(roomId);
};

// Initialize
loadFriends();
